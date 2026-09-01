/** @fileoverview Replicate media-generation IPC handlers.
 *  The renderer never touches the Replicate API token. This handler journals a
 *  durable write-ahead intent before dispatching a billable prediction to
 *  Replicate, then maps the durable result back to the renderer through the
 *  existing background-task store.
 */

import crypto from "crypto";
import { createReplicatePrediction, validateReplicateModel } from "../../services/replicateService";
import {
  markPaidSubmissionAccepted,
  markPaidSubmissionAcceptanceUnknown,
  persistPaidSubmissionIntent,
} from "../../services/backgroundTaskManager";
import { submitDurablePaidTask } from "../../services/paidSubmissionManager";
import { getProviderApiKey } from "../../services/secureStore";
import { getProfileSessionId } from "../../services/profileSession";
import { registerPrivilegedIpcChannel } from "./common";
import { redactErrorMessage } from "../../../src/shared/redaction";

export interface ReplicateGenerateImageInput {
  model: string;
  input: Record<string, unknown>;
}

function validateGenerateImageInput(raw: unknown): ReplicateGenerateImageInput {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Invalid Replicate generate-image input.");
  }
  const payload = raw as Record<string, unknown>;
  const model = validateReplicateModel(payload.model);
  if (!payload.input || typeof payload.input !== "object" || Array.isArray(payload.input)) {
    throw new Error("Replicate input must be an object.");
  }
  const input = payload.input as Record<string, unknown>;

  // Defensive size limits to avoid accidentally enormous payloads.
  const serialized = JSON.stringify(input);
  if (serialized.length > 100_000) {
    throw new Error("Replicate input payload exceeds 100 KB.");
  }
  if (typeof input.prompt === "string" && input.prompt.length > 5000) {
    throw new Error("Replicate prompt exceeds 5000 characters.");
  }

  return { model, input };
}

/** Deterministic canonicalization for { model, input }.
 *  Recursively sorts object keys, preserves array order, and rejects cyclic
 *  values so the fingerprint is stable and safe to hash. */
function canonicalizePayload(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((item) => canonicalizePayload(item, seen));
  }
  if (typeof value === "object") {
    if (seen.has(value)) {
      throw new Error("Replicate input contains a cyclic value and cannot be fingerprinted.");
    }
    seen.add(value);
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined) {
        result[key] = canonicalizePayload(val, seen);
      }
    }
    seen.delete(value);
    return result;
  }
  return String(value);
}

function hashCanonicalPayload(model: string, input: Record<string, unknown>): string {
  const canonical = canonicalizePayload({ model, input });
  const json = JSON.stringify(canonical);
  const digest = crypto.createHash("sha256").update(json, "utf8").digest("hex");
  return `sha256:${digest}`;
}

type ReplicateGenerateImageResult =
  | { ok: true; disposition: "submitted" | "reused"; task: unknown }
  | { ok: false; disposition: "acceptance_unknown"; task: unknown; error: string }
  | { ok: false; disposition: "pre_dispatch_failure" | "conflict"; error: string };

export function registerReplicateHandlers(): void {
  registerPrivilegedIpcChannel("replicate:generateImage", async (event, raw: unknown) => {
    try {
      const profileId = getProfileSessionId(event.sender);
      const apiToken = getProviderApiKey("replicate", profileId);
      if (!apiToken) {
        return { ok: false, disposition: "pre_dispatch_failure", error: "Replicate API token is not configured." };
      }

      const { model, input } = validateGenerateImageInput(raw);
      const fingerprint = hashCanonicalPayload(model, input);

      const result = await submitDurablePaidTask({
        provider: "replicate",
        operation: "image.generate",
        profileId,
        requestFingerprint: fingerprint,
        payloadHash: fingerprint,
        metadata: { model },
        persistIntent: () =>
          persistPaidSubmissionIntent({
            type: "image",
            providerId: "replicate",
            operation: "image.generate",
            modelId: model,
            profileId,
            requestFingerprint: fingerprint,
            payloadHash: fingerprint,
            metadata: { model },
          }),
        dispatch: () => createReplicatePrediction(apiToken, { model, input }),
        getRemoteTaskId: (prediction) => prediction.id,
        persistAccepted: (taskId, remoteTaskId) => markPaidSubmissionAccepted(taskId, remoteTaskId),
        persistAcceptanceUnknown: (taskId, message) => markPaidSubmissionAcceptanceUnknown(taskId, message),
      });

      switch (result.kind) {
        case "submitted":
        case "reused":
          return { ok: true, disposition: result.kind, task: result.task } as ReplicateGenerateImageResult;
        case "acceptance_unknown":
          return {
            ok: false,
            disposition: "acceptance_unknown",
            task: result.task,
            error: redactErrorMessage(result.error),
          } as ReplicateGenerateImageResult;
        case "pre_dispatch_failure":
        case "conflict":
          return {
            ok: false,
            disposition: result.kind,
            error: redactErrorMessage(result.error),
          } as ReplicateGenerateImageResult;
        default:
          return { ok: false, disposition: "pre_dispatch_failure", error: "Unexpected submission result." };
      }
    } catch (err: unknown) {
      return { ok: false, disposition: "pre_dispatch_failure", error: redactErrorMessage(err) } as ReplicateGenerateImageResult;
    }
  });
}
