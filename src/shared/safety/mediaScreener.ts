export type GeneratedMediaSafetyResult =
  | { allowed: true; skipped?: boolean; reason?: string }
  | {
      allowed: false;
      reasonCode: string;
      category: string;
      userMessage?: string;
    };

/**
 * Normalizes a base64 string or data URI into raw bytes for magic-byte
 * checking, and extracts the MIME type.
 */
export function normalizeAndIdentifyMime(candidate: string): { mime: string | null; valid: boolean } {
  let b64 = candidate;
  const match = candidate.match(/^data:([^;]+);base64,(.+)$/);
  if (match) {
    b64 = match[2];
  }

  if (!b64 || typeof b64 !== "string") {
    return { mime: null, valid: false };
  }

  const prefix = b64.slice(0, 32);
  let buffer: Buffer;
  try {
    buffer = Buffer.from(prefix, "base64");
  } catch {
    return { mime: null, valid: false };
  }

  if (buffer.length < 4) {
    return { mime: null, valid: false };
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mime: "image/jpeg", valid: true };
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { mime: "image/png", valid: true };
  }
  if (buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46) {
    if (buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50) {
      return { mime: "image/webp", valid: true };
    }
  }
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { mime: "image/gif", valid: true };
  }

  // Audio/Video logic could go here
  if (buffer[0] === 0x49 && buffer[1] === 0x44 && buffer[2] === 0x33) {
    return { mime: "audio/mpeg", valid: true }; // MP3
  }

  return { mime: "application/octet-stream", valid: false };
}

/**
 * Architectural hook for semantically screening generated binary media
 * before persistence and display.
 */
export function screenGeneratedMedia(
  candidateData: string,
  mimeType: string,
  localFamilySafeModeEnabled: boolean
): GeneratedMediaSafetyResult {
  if (!localFamilySafeModeEnabled) {
    return { allowed: true, skipped: true, reason: "local-family-safe-mode-disabled" };
  }

  // Even if it's an HTTP URL (provider URL), we would theoretically need to download and screen it.
  // We'll treat HTTP URLs as opaque for the inline base64 screener and fail them closed
  // if they represent generated media that we cannot verify.
  if (candidateData.startsWith("http://") || candidateData.startsWith("https://")) {
    return {
      allowed: false,
      reasonCode: "CLASSIFIER_UNAVAILABLE",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: "Semantic image screening is required in Family Safe Mode but no classifier is available for remote URLs.",
    };
  }

  const { valid } = normalizeAndIdentifyMime(candidateData);
  if (!valid) {
    return {
      allowed: false,
      reasonCode: "INVALID_MEDIA_FORMAT",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: "The generated media format is invalid or unsupported by the safety filter.",
    };
  }

  // TODO: Integrate actual ML classifier (e.g. TFJS) for semantic image screening.
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: "Semantic image screening is required in Family Safe Mode but no classifier is available.",
  };
}
