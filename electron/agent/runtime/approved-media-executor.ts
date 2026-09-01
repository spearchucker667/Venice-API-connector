/** @fileoverview Approved `media.generateImage` execution path.
 *
 *  On user approval, this module dispatches the stored Venice `/image/generate`
 *  payload through the durable paid-submission manager. The manager guarantees
 *  intent persistence before dispatch, profile-scoped deduplication, and
 *  conservative ambiguity handling for transport failures.
 */

import type { ChatMediaReferenceContract } from "../../../src/shared/chatMediaReferenceContracts";
import type { BackgroundTask } from "../../../src/types/background-task";
import { sanitizeErrorText } from "../../../src/shared/redaction";
import { performGuardedVeniceRequest } from "../../services/guardPipeline";
import { publishInspectorRequest, publishInspectorCompletion } from "../../services/inspectorTelemetry";
import { persistGeneratedMedia } from "../../services/generatedMediaStore";
import {
  markPaidSubmissionAcceptanceUnknown,
  persistPaidSubmissionIntent,
  updateBackgroundTaskInMain,
} from "../../services/backgroundTaskManager";
import {
  submitDurablePaidTask,
  DispatchNotStartedError,
} from "../../services/paidSubmissionManager";
import type { GenerateImagePlan } from "../approvals/plan-factories";

export interface ApprovedGenerateImageResult {
  ok: true;
  chatRef: ChatMediaReferenceContract;
  task: BackgroundTask;
}

export interface ApprovedGenerateImageFailure {
  ok: false;
  error: string;
  task?: BackgroundTask;
}

type ExecuteApprovedGenerateImageResult = ApprovedGenerateImageResult | ApprovedGenerateImageFailure;

function detectImageMimeTypeFromBase64(b64: string): "image/png" | "image/jpeg" | "image/webp" | null {
  if (b64.startsWith("iVBORw0KGgo")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("UklGR")) return "image/webp";
  return null;
}

function extractBase64Image(body: unknown): { b64: string; mimeType: "image/png" | "image/jpeg" | "image/webp" } | null {
  const responseBody = (body ?? {}) as { images?: unknown };
  const rawImages = Array.isArray(responseBody.images) ? responseBody.images : [];
  if (rawImages.length === 0) return null;

  const first = rawImages[0] as unknown;
  const b64 =
    typeof first === "string"
      ? first
      : first && typeof first === "object" && typeof (first as { b64_json?: unknown }).b64_json === "string"
        ? (first as { b64_json: string }).b64_json
        : "";
  if (b64.length === 0) return null;

  const mimeType = detectImageMimeTypeFromBase64(b64);
  if (!mimeType) return null;

  return { b64, mimeType };
}

function extractProviderRequestId(response: { headers: Record<string, string>; body: unknown }): string {
  const headerId = response.headers["x-request-id"] || response.headers["x-amzn-requestid"];
  if (typeof headerId === "string" && headerId.length > 0) return headerId.slice(0, 128);
  const bodyId = (response.body as { id?: unknown } | undefined)?.id;
  if (typeof bodyId === "string" && bodyId.length > 0) return bodyId.slice(0, 128);
  return `venice-${Date.now()}`;
}

async function persistGeneratedImageFromResponse(body: unknown): Promise<{
  id: string;
  url: string;
  mimeType: string;
  byteCount: number;
}> {
  const extracted = extractBase64Image(body);
  if (!extracted) {
    throw new Error("Image generate response did not include a valid base64 image.");
  }
  const { b64, mimeType } = extracted;
  const buffer = Buffer.from(b64, "base64");
  const persisted = await persistGeneratedMedia(buffer, mimeType);
  return {
    id: persisted.id,
    url: persisted.url,
    mimeType: persisted.mimeType,
    byteCount: persisted.byteCount,
  };
}

function buildChatMediaReference(plan: GenerateImagePlan, media: { id: string; url: string }, createdAt: number): ChatMediaReferenceContract {
  return {
    id: media.id,
    mediaId: media.id,
    mediaType: "image",
    operation: "generate",
    displayUrl: media.url,
    thumbnailUrl: media.url,
    altText: plan.prompt.slice(0, 200),
    modelId: plan.modelId,
    createdAt,
  };
}

export async function executeApprovedGenerateImagePlan(plan: GenerateImagePlan): Promise<ExecuteApprovedGenerateImageResult> {
  let dispatchResponse: Awaited<ReturnType<typeof performGuardedVeniceRequest>> | undefined;
  let dispatchResult: { requestId: string; responseBody: unknown } | undefined;

  const result = await submitDurablePaidTask({
    provider: "venice",
    operation: "image.generate",
    profileId: plan.profileId,
    requestFingerprint: plan.requestFingerprint,
    payloadHash: plan.payloadHash,
    metadata: { model: plan.modelId },
    persistIntent: () =>
      persistPaidSubmissionIntent({
        type: "image",
        providerId: "venice",
        operation: "image.generate",
        modelId: plan.modelId,
        profileId: plan.profileId,
        requestFingerprint: plan.requestFingerprint,
        payloadHash: plan.payloadHash,
        metadata: { model: plan.modelId },
      }),
    dispatch: async () => {
      const startedAt = Date.now();
      let eventId = "";
      try {
        eventId = publishInspectorRequest({
          source: "main-agent",
          transport: "venice",
          endpoint: "/image/generate",
          method: "POST",
        });
      } catch {
        // Telemetry must never break execution.
      }

      try {
        dispatchResponse = await performGuardedVeniceRequest({
          endpoint: "/image/generate",
          method: "POST",
          body: plan.wirePayload,
          profileId: plan.profileId,
        });
      } catch (err) {
        publishInspectorCompletion({
          source: "main-agent",
          transport: "venice",
          endpoint: "/image/generate",
          method: "POST",
          summaries: { durationMs: Date.now() - startedAt, model: plan.modelId },
          eventId,
          error: sanitizeErrorText(err instanceof Error ? err.message : String(err)),
        });
        throw err;
      }

      if (dispatchResponse.kind === "blocked") {
        publishInspectorCompletion({
          source: "main-agent",
          transport: "venice",
          endpoint: "/image/generate",
          method: "POST",
          summaries: { durationMs: Date.now() - startedAt, model: plan.modelId },
          eventId,
          status: 451,
          error: dispatchResponse.block.body.error,
        });
        throw new DispatchNotStartedError("Blocked by Family Safe Mode");
      }

      const response = dispatchResponse.response;
      if (!response.ok) {
        publishInspectorCompletion({
          source: "main-agent",
          transport: "venice",
          endpoint: "/image/generate",
          method: "POST",
          summaries: { durationMs: Date.now() - startedAt, model: plan.modelId },
          eventId,
          status: response.status,
          error: sanitizeErrorText(`Image generate returned status ${response.status} ${response.statusText ?? ""}.`),
        });
        // Client errors are pre-dispatch failures (provider rejected, no charge).
        if (response.status >= 400 && response.status < 500) {
          throw new DispatchNotStartedError(`Image generate returned status ${response.status}.`);
        }
        throw new Error(`Image generate returned status ${response.status}.`);
      }

      publishInspectorCompletion({
        source: "main-agent",
        transport: "venice",
        endpoint: "/image/generate",
        method: "POST",
        summaries: { durationMs: Date.now() - startedAt, model: plan.modelId },
        eventId,
        status: response.status,
      });

      const requestId = extractProviderRequestId(response);
      dispatchResult = { requestId, responseBody: response.body };
      return dispatchResult;
    },
    getRemoteTaskId: (accepted) => accepted.requestId,
    persistAccepted: async (taskId, remoteTaskId) => {
      if (!dispatchResult) {
        throw new Error("Dispatch result missing during persistAccepted.");
      }
      const media = await persistGeneratedImageFromResponse(dispatchResult.responseBody);
      const updated = await updateBackgroundTaskInMain(taskId, {
        status: "completed",
        queueId: remoteTaskId,
        resultUrl: media.url,
        resultMediaId: media.id,
        acceptedAt: Date.now(),
        metadata: { mimeType: media.mimeType, model: plan.modelId },
      });
      if (!updated) throw new Error(`Task ${taskId} not found when marking image generation completed.`);
      return updated;
    },
    persistAcceptanceUnknown: (taskId, message) => markPaidSubmissionAcceptanceUnknown(taskId, message),
  });

  switch (result.kind) {
    case "submitted":
    case "reused": {
      const task = result.task;
      if (!task.resultMediaId || !task.resultUrl) {
        return { ok: false, error: "Media reference missing after image generation.", task };
      }
      return {
        ok: true,
        task,
        chatRef: buildChatMediaReference(plan, { id: task.resultMediaId, url: task.resultUrl }, task.createdAt),
      };
    }
    case "acceptance_unknown":
      return { ok: false, error: result.error, task: result.task };
    case "pre_dispatch_failure":
    case "conflict":
      return { ok: false, error: result.error };
    default:
      return { ok: false, error: "Unexpected submission result." };
  }
}
