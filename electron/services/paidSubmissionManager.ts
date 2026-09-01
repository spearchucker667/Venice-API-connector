/** @fileoverview Provider-neutral durable paid-submission orchestration.
 *  Guarantees write-ahead intent, profile-scoped deduplication, conservative
 *  ambiguity handling, and restart recovery for any billable provider adapter.
 */

import type { BackgroundTask } from "../../src/types/background-task";
import {
  findActivePaidSubmission,
  markPaidSubmissionDispatching,
} from "./backgroundTaskManager";

/** FIFO mutex for a logical request fingerprint.  Acquiring this before the
 *  persisted lookup + intent-write prevents two concurrent calls with the same
 *  fingerprint but different payloads from both journaling intent and
 *  dispatching. */
const fingerprintLocks = new Map<string, Array<(release: () => void) => void>>();

async function acquireFingerprintLock(key: string): Promise<() => void> {
  const queue = fingerprintLocks.get(key);
  if (!queue) {
    fingerprintLocks.set(key, []);
    return () => {
      const q = fingerprintLocks.get(key);
      if (q && q.length > 0) {
        const nextResolve = q.shift()!;
        const nextReleaseFn = () => {
          const q2 = fingerprintLocks.get(key);
          if (q2 && q2.length > 0) {
            const following = q2.shift()!;
            following(nextReleaseFn);
          } else {
            fingerprintLocks.delete(key);
          }
        };
        nextResolve(nextReleaseFn);
      } else {
        fingerprintLocks.delete(key);
      }
    };
  }
  return new Promise((resolve) => {
    queue.push(resolve);
  });
}

export interface DurablePaidSubmissionInput<TAccepted> {
  provider: string;
  operation: string;
  profileId: string;
  requestFingerprint: string;
  payloadHash: string;
  metadata: Record<string, string | number | boolean>;
  persistIntent(): Promise<BackgroundTask>;
  dispatch(): Promise<TAccepted>;
  getRemoteTaskId(accepted: TAccepted): string;
  persistAccepted(taskId: string, remoteTaskId: string): Promise<BackgroundTask>;
  persistAcceptanceUnknown(taskId: string, message: string): Promise<BackgroundTask>;
}

export type DurablePaidSubmissionResult =
  | { kind: "submitted"; task: BackgroundTask }
  | { kind: "reused"; task: BackgroundTask }
  | { kind: "acceptance_unknown"; task: BackgroundTask; error: string }
  | { kind: "pre_dispatch_failure"; error: string }
  | { kind: "conflict"; error: string };

/** Thrown by an adapter when a failure is proven to occur before the request
 *  was transmitted to the provider. These failures are safe to surface as
 *  pre-dispatch failures and must not be classified as acceptance unknown. */
export class DispatchNotStartedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DispatchNotStartedError";
  }
}

/** In-flight submissions keyed by the compound idempotency identity. */
const inFlightPaidSubmissions = new Map<string, Promise<DurablePaidSubmissionResult>>();

function submissionKey(
  profileId: string,
  provider: string,
  operation: string,
  requestFingerprint: string,
  payloadHash: string,
): string {
  return `${profileId}:${provider}:${operation}:${requestFingerprint}:${payloadHash}`;
}

export async function submitDurablePaidTask<TAccepted>(
  input: DurablePaidSubmissionInput<TAccepted>,
): Promise<DurablePaidSubmissionResult> {
  const { provider, operation, profileId, requestFingerprint, payloadHash } = input;
  const fullKey = submissionKey(profileId, provider, operation, requestFingerprint, payloadHash);
  const fingerprintKey = `${profileId}:${provider}:${operation}:${requestFingerprint}`;

  // Serialize all calls sharing the same logical fingerprint so that a
  // persisted task with a conflicting payload is visible before a second intent
  // is written.
  const release = await acquireFingerprintLock(fingerprintKey);
  try {
    // 1. Reuse an active persisted equivalent submission (restart or recent call)
    //    or detect a same-fingerprint/different-payload conflict.
    const existing = findActivePaidSubmission({
      profileId,
      providerId: provider,
      operation,
      requestFingerprint,
    });
    if (existing) {
      if (existing.payloadHash !== payloadHash) {
        return {
          kind: "conflict",
          error: "IDEMPOTENCY_CONFLICT: same logical key used with different payload.",
        };
      }
      return { kind: "reused", task: existing };
    }

    // 2. Deduplicate concurrent equivalent calls.
    const inFlight = inFlightPaidSubmissions.get(fullKey);
    if (inFlight) {
      return inFlight;
    }

    // 3. Persist durable intent before any billable provider work.
    let task: BackgroundTask;
    try {
      task = await input.persistIntent();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return { kind: "pre_dispatch_failure", error: message };
    }

    // 4. Complete the lifecycle outside the fingerprint lock so later
    //    same-fingerprint callers can reuse the persisted intent.
    const promise = executeDurableSubmissionFromTask(input, task).finally(() => {
      inFlightPaidSubmissions.delete(fullKey);
    });
    inFlightPaidSubmissions.set(fullKey, promise);
    return promise;
  } finally {
    release();
  }
}

async function executeDurableSubmissionFromTask<TAccepted>(
  input: DurablePaidSubmissionInput<TAccepted>,
  task: BackgroundTask,
): Promise<DurablePaidSubmissionResult> {
  // --- PHASE 1: Record that dispatch is starting. ---
  try {
    task = await markPaidSubmissionDispatching(task.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "pre_dispatch_failure", error: message };
  }

  // --- PHASE 2: Dispatch to the provider adapter. ---
  try {
    const accepted = await input.dispatch();
    const remoteTaskId = input.getRemoteTaskId(accepted);
    task = await input.persistAccepted(task.id, remoteTaskId);
    return { kind: "submitted", task };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (err instanceof DispatchNotStartedError) {
      return { kind: "pre_dispatch_failure", error: message };
    }
    // Any failure after the dispatching transition is ambiguous: the provider
    // may or may not have accepted the charge.
    try {
      task = await input.persistAcceptanceUnknown(task.id, message);
    } catch {
      // Disk flush failed while recording the ambiguous state.  We still
      // report acceptance_unknown (without a persisted status update) rather
      // than a pre-dispatch failure, which could invite a user retry and
      // double spend.  Reflect the ambiguous status on the returned object so
      // callers see a consistent state.
      task = { ...task, status: "acceptance_unknown" as const, error: message, updatedAt: Date.now() };
    }
    return { kind: "acceptance_unknown", task, error: message };
  }
}

/** Clears the in-flight submission map and fingerprint locks. Only for tests. */
export function __resetPaidSubmissionManagerForTests(): void {
  inFlightPaidSubmissions.clear();
  fingerprintLocks.clear();
}
