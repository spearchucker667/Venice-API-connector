/** @fileoverview Replicate media-generation IPC handlers.
 *  The renderer never touches the Replicate API token. This handler creates
 *  a prediction, journals a durable background task, and returns the task so
 *  the renderer can monitor it through the existing background-task store.
 */

import { createReplicatePrediction, validateReplicateModel } from "../../services/replicateService";
import { createBackgroundTaskInMain } from "../../services/backgroundTaskManager";
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

export function registerReplicateHandlers(): void {
  registerPrivilegedIpcChannel("replicate:generateImage", async (event, raw: unknown) => {
    try {
      const profileId = getProfileSessionId(event.sender);
      const apiToken = getProviderApiKey("replicate", profileId);
      if (!apiToken) {
        return { ok: false, error: "Replicate API token is not configured." };
      }

      const { model, input } = validateGenerateImageInput(raw);
      const prediction = await createReplicatePrediction(apiToken, { model, input });

      const task = await createBackgroundTaskInMain({
        type: "image",
        providerId: "replicate",
        queueId: prediction.id,
        modelId: model,
        profileId,
        metadata: { model },
      });

      return { ok: true, task };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });
}
