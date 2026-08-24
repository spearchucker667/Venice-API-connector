/** @fileoverview Replicate prediction lifecycle service.
 *  Handles image (and future video) generation through Replicate's async
 *  prediction API, including creation, polling, cancellation, and output
 *  download. All secrets and network calls remain main-process-only.
 */

import { redactUrl, sanitizeErrorText } from "../../src/shared/redaction";
import { logError, logInfo } from "./logger";

const REPLICATE_API_BASE = "https://api.replicate.com/v1";

export type ReplicatePredictionStatus =
  | "starting"
  | "processing"
  | "succeeded"
  | "failed"
  | "canceled";

export interface ReplicatePrediction {
  id: string;
  status: ReplicatePredictionStatus;
  input: Record<string, unknown>;
  output?: unknown;
  error?: { detail?: string; message?: string } | string;
  logs?: string;
  urls?: {
    get?: string;
    cancel?: string;
    stream?: string;
  };
  created_at?: string;
  started_at?: string | null;
  completed_at?: string | null;
}

export interface ReplicateCreateRequest {
  model: string;
  input: Record<string, unknown>;
  webhook?: string;
  webhook_events_filter?: string[];
}

export type ReplicateResult =
  | { kind: "pending"; prediction: ReplicatePrediction }
  | { kind: "completed"; prediction: ReplicatePrediction; outputUrl: string }
  | { kind: "failed"; prediction: ReplicatePrediction; error: string }
  | { kind: "canceled"; prediction: ReplicatePrediction };

function bearerHeader(apiToken: string): Record<string, string> {
  return {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
    "User-Agent": "VeniceForge/1.0",
  };
}

/** Validates that a model identifier looks like a Replicate model/version.
 *  Reject paths, query strings, or hosts injected by a compromised renderer.
 */
export function validateReplicateModel(model: unknown): string {
  if (typeof model !== "string" || model.trim().length === 0) {
    throw new Error("Replicate model is required.");
  }
  const trimmed = model.trim();
  if (trimmed.length > 256) {
    throw new Error("Replicate model identifier is too long.");
  }
  // Accept owner/name or owner/name:version. Reject URL/path metacharacters.
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+(?::[a-zA-Z0-9_.-]+)?$/.test(trimmed)) {
    throw new Error("Replicate model identifier is invalid.");
  }
  return trimmed;
}

function buildPredictionUrl(model: string): string {
  return `${REPLICATE_API_BASE}/models/${encodeURIComponent(model)}/predictions`;
}

async function replicateFetch(
  apiToken: string,
  url: string,
  options: { method?: string; body?: string } = {},
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const method = options.method ?? "GET";
  logInfo("Replicate API request", { method, url: redactUrl(url) });

  const response = await fetch(url, {
    method,
    headers: bearerHeader(apiToken),
    body: options.body,
  });

  let body: unknown;
  const text = await response.text().catch(() => "");
  try {
    body = text ? JSON.parse(text) : {};
  } catch {
    body = { raw: text };
  }

  return { ok: response.ok, status: response.status, body };
}

function extractErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") return fallback;
  const record = body as Record<string, unknown>;
  if (record.detail && typeof record.detail === "string") return record.detail;
  if (record.error) {
    const err = record.error as Record<string, unknown> | string;
    if (typeof err === "string") return err;
    if (typeof err?.detail === "string") return err.detail;
    if (typeof err?.message === "string") return err.message;
  }
  if (typeof record.message === "string") return record.message;
  return fallback;
}

/** Creates a new Replicate prediction. */
export async function createReplicatePrediction(
  apiToken: string,
  request: ReplicateCreateRequest,
): Promise<ReplicatePrediction> {
  const model = validateReplicateModel(request.model);
  const url = buildPredictionUrl(model);
  const payload: Record<string, unknown> = { input: request.input };
  if (typeof request.webhook === "string") payload.webhook = request.webhook;
  if (Array.isArray(request.webhook_events_filter)) {
    payload.webhook_events_filter = request.webhook_events_filter;
  }

  const response = await replicateFetch(apiToken, url, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const message = extractErrorMessage(response.body, "Replicate prediction creation failed.");
    throw new Error(message);
  }

  return response.body as ReplicatePrediction;
}

/** Retrieves the current state of a Replicate prediction. */
export async function getReplicatePrediction(
  apiToken: string,
  predictionId: string,
): Promise<ReplicatePrediction> {
  if (typeof predictionId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(predictionId)) {
    throw new Error("Invalid Replicate prediction ID.");
  }
  const url = `${REPLICATE_API_BASE}/predictions/${encodeURIComponent(predictionId)}`;
  const response = await replicateFetch(apiToken, url);
  if (!response.ok) {
    const message = extractErrorMessage(response.body, "Replicate prediction retrieval failed.");
    throw new Error(message);
  }
  return response.body as ReplicatePrediction;
}

/** Cancels a running Replicate prediction if possible. */
export async function cancelReplicatePrediction(
  apiToken: string,
  predictionId: string,
): Promise<ReplicatePrediction> {
  if (typeof predictionId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(predictionId)) {
    throw new Error("Invalid Replicate prediction ID.");
  }
  const url = `${REPLICATE_API_BASE}/predictions/${encodeURIComponent(predictionId)}/cancel`;
  const response = await replicateFetch(apiToken, url, { method: "POST" });
  if (!response.ok && response.status !== 409) {
    // 409 means already terminal; treat as success.
    const message = extractErrorMessage(response.body, "Replicate prediction cancellation failed.");
    throw new Error(message);
  }
  return response.body as ReplicatePrediction;
}

/** Downloads a Replicate output URL into a Buffer.
 *  The URL is treated as an expiring signed URL and is never persisted.
 */
export async function downloadReplicateOutput(
  outputUrl: string,
): Promise<{ buffer: Buffer; mimeType: string }> {
  // SSRF guard: Replicate output URLs should be https://replicate.delivery/...
  if (!/^https:\/\/[a-zA-Z0-9._-]+\/.*$/.test(outputUrl)) {
    throw new Error("Replicate output URL is not a valid HTTPS URL.");
  }

  const response = await fetch(outputUrl, { method: "GET" });
  if (!response.ok) {
    throw new Error(`Replicate output download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const contentType = response.headers.get("content-type") || "application/octet-stream";
  return { buffer, mimeType: contentType };
}

/** Picks a single image URL from heterogeneous Replicate model output.
 *  Supports arrays, objects with `url`, and plain strings.
 */
function pickOutputImageUrl(output: unknown): string | undefined {
  if (typeof output === "string") return output;
  if (Array.isArray(output)) {
    const first = output.find((item) => typeof item === "string" || (item && typeof item === "object" && typeof (item as Record<string, unknown>).url === "string"));
    if (typeof first === "string") return first;
    if (first && typeof first === "object") return String((first as Record<string, unknown>).url);
  }
  if (output && typeof output === "object") {
    const record = output as Record<string, unknown>;
    if (typeof record.url === "string") return record.url;
    if (Array.isArray(record.output)) return pickOutputImageUrl(record.output);
  }
  return undefined;
}

/** Polls a Replicate prediction and normalizes the result.
 *  Returns `pending` while starting/processing, `completed` with an output URL,
 *  `failed` with an error, or `canceled`.
 */
export async function pollReplicatePrediction(
  apiToken: string,
  predictionId: string,
): Promise<ReplicateResult> {
  const prediction = await getReplicatePrediction(apiToken, predictionId);
  const status = prediction.status;

  if (status === "succeeded") {
    const outputUrl = pickOutputImageUrl(prediction.output);
    if (!outputUrl) {
      return {
        kind: "failed",
        prediction,
        error: "Replicate prediction succeeded but returned no usable output URL.",
      };
    }
    return { kind: "completed", prediction, outputUrl };
  }

  if (status === "failed") {
    const error =
      typeof prediction.error === "string"
        ? prediction.error
        : prediction.error?.detail || prediction.error?.message || "Replicate prediction failed.";
    return { kind: "failed", prediction, error };
  }

  if (status === "canceled") {
    return { kind: "canceled", prediction };
  }

  return { kind: "pending", prediction };
}

/** Lightweight connectivity probe: lists a curated model.
 *  A 200/404/401 response is enough to validate the token and reachability.
 */
export async function testReplicateConnection(apiToken: string): Promise<{ ok: boolean; status: number; message: string }> {
  const url = `${REPLICATE_API_BASE}/models/black-forest-labs/flux-schnell`;
  try {
    const response = await replicateFetch(apiToken, url);
    if (response.ok) {
      return { ok: true, status: response.status, message: "Connection successful" };
    }
    if (response.status === 401 || response.status === 403) {
      return { ok: false, status: response.status, message: "Invalid Replicate API token." };
    }
    return {
      ok: false,
      status: response.status,
      message: extractErrorMessage(response.body, `Replicate returned ${response.status}.`),
    };
  } catch (err) {
    logError("Replicate connection test failed", sanitizeErrorText(String(err)));
    return { ok: false, status: 0, message: sanitizeErrorText(String(err)) };
  }
}
