/** @fileoverview Canonical wire builder for the Venice `/augment/search`
 *  endpoint. Derived from the tracked OpenAPI snapshot
 *  (`docs/reference/Venice_swagger_api.yaml`, Schema Version 20260814.194349),
 *  schema `WebSearchRequest`:
 *
 *    query:            string, 1..400 (required)
 *    search_provider:  enum ["google", "brave"] (optional)
 *    limit:            integer, 1..20, default 10 (optional)
 *
 *  The endpoint does NOT declare `safe_mode`; the endpoint matrix in
 *  `veniceSafeMode.ts` therefore never injects it. This builder is the
 *  single owner of the logical-to-wire translation so domain names like
 *  `provider` / `maxResults` can never reach the wire again.
 */

export type VeniceSearchProvider = "google" | "brave";

export const VENICE_SEARCH_PROVIDERS: ReadonlyArray<VeniceSearchProvider> = [
  "google",
  "brave",
];

export const VENICE_SEARCH_MIN_LIMIT = 1;
export const VENICE_SEARCH_MAX_LIMIT = 20;
export const VENICE_SEARCH_DEFAULT_LIMIT = 10;
export const VENICE_SEARCH_MAX_QUERY_LENGTH = 400;

export interface VeniceSearchWirePayload {
  query: string;
  search_provider?: VeniceSearchProvider;
  limit?: number;
}

/** Maps a logical provider value to the documented wire enum. Values
 *  outside `["google", "brave"]` (e.g. "auto", "jina") are omitted so the
 *  provider default applies instead of an undocumented foreign field. */
export function normalizeVeniceSearchProvider(
  value: unknown,
): VeniceSearchProvider | undefined {
  if (value === "google" || value === "brave") return value;
  return undefined;
}

/** Clamps a result limit into the documented 1..20 range, or returns
 *  `undefined` for non-numeric input so the field is omitted. */
export function clampVeniceSearchLimit(value: unknown): number | undefined {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return undefined;
  return Math.max(VENICE_SEARCH_MIN_LIMIT, Math.min(VENICE_SEARCH_MAX_LIMIT, n));
}

/** Builds the exact `WebSearchRequest` body for a search query.
 *  Truncates the query to the documented 400-char maximum and only emits
 *  `search_provider` / `limit` when they are valid wire values. */
export function buildVeniceSearchPayload(
  query: string,
  options: { provider?: unknown; limit?: number } = {},
): VeniceSearchWirePayload {
  const payload: VeniceSearchWirePayload = {
    query: String(query ?? "")
      .trim()
      .slice(0, VENICE_SEARCH_MAX_QUERY_LENGTH),
  };
  const provider = normalizeVeniceSearchProvider(options.provider);
  if (provider) payload.search_provider = provider;
  const limit = clampVeniceSearchLimit(options.limit);
  if (limit !== undefined) payload.limit = limit;
  return payload;
}
