/** @fileoverview Pure helpers for the Media Studio view: source resolution, thumb URLs, dimension formatting, op filtering, and tag manipulation. */

import type { MediaItem } from "../types/media";
import {
  modelSupportsEdit,
  modelSupportsUpscale,
  modelSupportsVideo,
  modelSupportsVision,
} from "../constants/venice";

/**
 * Compact capability flags for the source model of a MediaItem. Rendered in
 * the inspector and used by future gallery actions to gate buttons.
 */
export interface MediaCapabilities {
  upscale: boolean;
  edit: boolean;
  video: boolean;
  vision: boolean;
}

/**
 * Optional live `/models` capability block for the source model of a
 * MediaItem. When present, the live `supportsVision` flag is the source
 * of truth and takes precedence over the static
 * `VISION_CAPABLE_MODEL_IDS` / `VISION_CAPABLE_PATTERNS` fallback in
 * `src/constants/venice.ts`. Persisted MediaItems only carry the model
 * id string, so this is best-effort: callers that can resolve the
 * model via `useModels()` should pass it through.
 */
export interface MediaItemWithLiveCapabilities {
  model: string;
  liveCapabilities?: { supportsVision?: boolean | undefined } | null | undefined;
}

/** Returns the set of capabilities recognised for `item.model`. */
export function mediaCapabilities(item: MediaItemWithLiveCapabilities): MediaCapabilities {
  const model = { id: item.model, name: item.model };
  return {
    upscale: modelSupportsUpscale(model),
    edit: modelSupportsEdit(model),
    video: modelSupportsVideo(model),
    vision: modelSupportsVision(item.model, item.liveCapabilities ?? null),
  };
}

/**
 * Canonical validator for the `venice-media://<sha256>` durable scheme.
 * The host must be exactly 64 lowercase hexadecimal characters.
 * Only this scheme (not `file://` or arbitrary custom protocols) is accepted.
 */
export const VALID_VENICE_MEDIA_RE = /^venice-media:\/\/[0-9a-f]{64}$/;

/**
 * Returns `true` if `raw` carries a `scheme://…` syntax (e.g. `file://`,
 * `https://`, `venice-forge://`). Used to refuse unknown custom protocols
 * that would otherwise be silently base64-wrapped.
 */
function looksLikeUrl(raw: string): boolean {
  // Match `^[a-zA-Z][a-zA-Z0-9+.\-]*://` or `^[a-zA-Z][a-zA-Z0-9+.\-]*:`.
  // Catches `file://`, `http://`, `https://`, `blob:`, `data:`, `venice-media://`,
  // and rejects incidental content such as a proxy of `name:value` form only
  // when the value contains `/` after `:` (which signals a URL-shaped token).
  const schemeMatch = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.exec(raw);
  if (!schemeMatch) return false;
  return raw.includes("://") || raw.slice(schemeMatch[0].length).startsWith("/");
}

const FILE_URL_RE = /^file:\/\//i;

/**
 * Returns `raw` only if it matches the validated durable `venice-media://`
 * scheme; returns null otherwise. Use this when constructing image or video
 * element `src` attributes from components that don't already have a full
 * MediaItem (e.g. chat-bubble tool-result thumbnails whose source root is
 * `mediaId`, not `image`). The contract intentionally refuses arbitrary
 * fallback constructions so the screenshot regression cannot recur.
 */
export function safeVeniceMediaUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return VALID_VENICE_MEDIA_RE.test(raw) ? raw : null;
}

/**
 * Resolve the displayable source for a MediaItem. The value is one of:
 * - A validated durable `venice-media://HASH` URL (image, video, audio)
 * - A `data:` / `blob:` / `https:` URL
 * - For legacy image items only: raw base64 PNG bytes assumed
 *
 * Returns `null` if no displayable source is available or if the scheme is
 * unrecognised. In particular:
 * - `file://` URLs are rejected (no renderer-readable filesystem path).
 * - Any URL-shaped value that is not on the explicit allowlist is rejected.
 * - A malformed `venice-media:` URL must never fall through to the legacy
 *   raw-base64 branch; the prior regression produced invalid cards of the
 *   form `data:image/png;base64,venice-media://HASH` and broke thumbnail
 *   decoding. See VERIFY-MEDIA-DURABLE-001 regression guard.
 */
export function mediaItemSource(item: MediaItem): string | null {
  const raw = item.image;
  if (!raw) return null;

  // Validated durable scheme is accepted unconditionally for every media type.
  // The renderer relies on image and video elements to fetch the bytes via
  // Electron's registered `venice-media://` protocol handler.
  if (VALID_VENICE_MEDIA_RE.test(raw)) return raw;

  if (FILE_URL_RE.test(raw)) {
    return null;
  }

  if (
    raw.startsWith("data:") ||
    raw.startsWith("blob:") ||
    raw.startsWith("http://") ||
    raw.startsWith("https://")
  ) {
    return raw;
  }

  // Anything that LOOKS like a `venice-media:` URL but failed the strict
  // 64-hex validator (wrong length, uppercase, non-hex, missing `//`) must
  // NOT be reinterpreted as base64: that produced the screenshot regression
  // where image cards displayed `Preview unavailable`.
  if (raw.startsWith("venice-media:") || raw.startsWith("venice-media/")) {
    return null;
  }

  // Any other URL-shaped value with an unknown custom protocol is rejected.
  // Without this guard, `file:///…` or `venice-forge://…` would fall through
  // to the legacy base64 fallback and produce broken image elements.
  if (looksLikeUrl(raw)) {
    return null;
  }

  // Legacy raw-base64 fallback, intentionally limited to image items only.
  // Videos and audio that arrive as raw strings have no displayable source.
  if (item.mediaType === "image") {
    return `data:image/png;base64,${raw}`;
  }
  return null;
}

/** True only for video items (NOT audio). */
export function isVideoItem(item: MediaItem): boolean {
  return item.mediaType === "video";
}

/** True only for audio items. */
export function isAudioItem(item: MediaItem): boolean {
  return item.mediaType === "audio";
}

/** True for any media item that can be played (video or audio). */
export function isPlayableMediaItem(item: MediaItem): boolean {
  return item.mediaType === "video" || item.mediaType === "audio";
}

const DIMENSION_FORMAT = new Intl.NumberFormat("en-US");

export function formatDimensions(item: MediaItem): string | null {
  const w = typeof item.width === "number" ? item.width : Number(item.width);
  const h = typeof item.height === "number" ? item.height : Number(item.height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return `${DIMENSION_FORMAT.format(Math.round(w))} × ${DIMENSION_FORMAT.format(Math.round(h))}`;
}

export function formatDuration(duration: string | undefined): string | null {
  if (!duration) return null;
  return duration;
}

export function formatBytesApprox(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 100 || i === 0 ? 0 : 1)} ${units[i]}`;
}

export function estimateItemBytes(item: MediaItem): number {
  const raw = item.image;
  if (!raw) return 0;
  if (raw.startsWith("data:")) {
    const comma = raw.indexOf(",");
    const b64 = comma >= 0 ? raw.slice(comma + 1) : raw;
    return Math.floor((b64.length * 3) / 4);
  }
  return raw.length;
}

export function normalizedTags(tags: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    if (typeof tag !== "string") continue;
    const cleaned = tag.trim().toLowerCase();
    if (!cleaned || cleaned.length > 32) continue;
    if (seen.has(cleaned)) continue;
    seen.add(cleaned);
    out.push(cleaned);
  }
  return out;
}

export function splitTags(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && t.length <= 32);
}
