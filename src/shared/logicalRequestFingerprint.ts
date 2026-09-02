import { canonicalizeJson } from "./venice-media-contract/canonicalize";

/**
 * Builds an opaque, stable fingerprint for renderer-initiated paid requests.
 * Web Crypto hashes the UTF-8 canonical payload, so non-ASCII prompts are
 * supported and prompt/lyrics text is never embedded in the durable journal.
 */
export async function buildLogicalRequestFingerprint(
  operation: "video" | "audio",
  payload: unknown,
): Promise<string> {
  const canonicalPayload = canonicalizeJson(payload);
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(canonicalPayload),
  );
  const hex = Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${operation}-sha256:${hex}`;
}
