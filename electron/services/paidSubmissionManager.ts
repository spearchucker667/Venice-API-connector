/** @fileoverview Provider-neutral durable paid-submission orchestration.
 *  Guarantees write-ahead intent, profile-scoped deduplication, conservative
 *  ambiguity handling, and restart recovery for any billable provider adapter.
 */

import type { BackgroundTask } from "../../src/types/background-task";
import {
  findActivePaidSubmission,
  markPaidSubmissionDispatching,
} from "./backgroundTaskManager";

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
  const key = submissionKey(profileId, provider, operation, requestFingerprint, payloadHash);

  // 1. Reuse an active persisted equivalent submission (restart or recent call).
  const existing = findActivePaidSubmission({ profileId, providerId: provider, operation, requestFingerprint });
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
  const inFlight = inFlightPaidSubmissions.get(key);
  if (inFlight) {
    return inFlight;
  }

  const promise = executeDurableSubmission(input);
  inFlightPaidSubmissions.set(key, promise);
  try {
    return await promise;
  } finally {
    inFlightPaidSubmissions.delete(key);
  }
}

async function executeDurableSubmission<TAccepted>(
  input: DurablePaidSubmissionInput<TAccepted>,
): Promise<DurablePaidSubmissionResult> {
  let task: BackgroundTask;

  // --- PHASE 1: Persist durable intent before any billable provider work. ---
  try {
    task = await input.persistIntent();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "pre_dispatch_failure", error: message };
  }

  // --- PHASE 2: Record that dispatch is starting. ---
  try {
    task = await markPaidSubmissionDispatching(task.id);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { kind: "pre_dispatch_failure", error: message };
  }

  // --- PHASE 3: Dispatch to the provider adapter. ---
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
    task = await input.persistAcceptanceUnknown(task.id, message);
    return { kind: "acceptance_unknown", task, error: message };
  }
}

/** Clears the in-flight submission map. Only for tests. */
export function __resetPaidSubmissionManagerForTests(): void {
  inFlightPaidSubmissions.clear();
}
