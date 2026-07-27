/** @fileoverview High-level legacy Venice API helper used by `lib/venice-client`.
 *  This is now a thin compatibility shim that delegates to the canonical
 *  `veniceFetch()` so all Venice traffic (renderer-streamed chats, embeddings,
 *  agent calls, model/style refreshes, character probes, etc.) flows through
 *  one transport that emits inspector telemetry, runs safety, and applies
 *  retry policy consistently. */

import { VeniceAPIError } from "./errors";
import { veniceFetch } from "./fetch";

/**
 * High-level legacy Venice API helper. Delegates to `veniceFetch()` with
 * `retry: false` so the legacy surface preserves its historic "one shot"
 * behaviour while gaining a single shared inspector row per call.
 * @param path The Venice API path (with or without the `/api/v1` prefix).
 * @param options Request options.
 * @returns The parsed response body.
 */
export async function venice<T>(
  path: string,
  options: { method?: string; body?: unknown; stream?: boolean; noAuth?: boolean; signal?: AbortSignal } = {}
): Promise<T> {
  const method = (options.method || "GET") as "GET" | "POST";

  let parsedBody: unknown = undefined;
  if (options.body !== undefined && options.body !== null) {
    if (typeof options.body === "string") {
      try {
        parsedBody = JSON.parse(options.body);
      } catch (err) {
        throw new VeniceAPIError(
          `Invalid JSON body passed to venice(): ${err instanceof Error ? err.message : String(err)}`,
          0
        );
      }
    } else {
      parsedBody = options.body;
    }
  }

  // Historical callers also pass `/api/v1/...` paths; veniceFetch expects
  // the canonical route (no `/api/v1` prefix). Trimming matches both surfaces
  // and prevents stray duplicates of the same inspector row.
  const endpoint = path.replace("/api/v1", "");

  try {
    // veniceFetch owns the canonical inspector-row emission, safety guard,
    // redaction, and error normalization. We intentionally let its errors
    // bubble up so callers see the same telemetry row the rest of the
    // renderer sees.
    const result = await veniceFetch<T>(endpoint, {
      method,
      body: parsedBody,
      signal: options.signal,
      retry: false,
    });
    return result.data;
  } catch (err) {
    // Preserve the legacy `VeniceAPIError` contract for downstream callers
    // that rely on `err instanceof VeniceAPIError` (the immediately-previous
    // implementation always threw this class). veniceFetch throws plain
    // Errors with attached `status` / `diagnostics`; we rewrap when those
    // properties are present so legacy behaviour is unchanged.
    if (
      err &&
      typeof err === "object" &&
      "status" in err &&
      typeof (err as { status?: unknown }).status === "number"
    ) {
      const status = (err as { status?: number }).status ?? 0;
      const message = err instanceof Error ? err.message : String(err);
      throw new VeniceAPIError(message, status);
    }
    throw err;
  }
}
