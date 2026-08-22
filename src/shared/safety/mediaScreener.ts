export type GeneratedMediaSafetyResult =
  | { allowed: true; skipped?: boolean; reason?: string }
  | {
      allowed: false;
      reasonCode: "INVALID_MEDIA" | "UNSUPPORTED_MEDIA" | "CLASSIFIER_UNAVAILABLE" | "CLASSIFIER_BLOCK";
      category: string;
      userMessage?: string;
    };

/** Minimum sensible byte count for each recognized media format. */
const MIN_BYTES_BY_MIME: Record<string, number> = {
  "image/jpeg": 3,
  "image/png": 4,
  "image/webp": 12,
  "image/gif": 4,
  "audio/mpeg": 4,
  "video/mp4": 8,
  "audio/ogg": 4,
  "audio/aac": 7,
  "audio/flac": 4,
  "audio/wav": 12,
  "audio/pcm": 1,
};

function normalizeDeclaredMime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.split(";")[0].trim().toLowerCase();
}

/**
 * Normalizes a base64 string, data URI, or raw Buffer into raw bytes for magic-byte
 * checking, and extracts the MIME type.
 */
export function normalizeAndIdentifyMime(
  candidate: string | Buffer,
  declaredMimeType?: string,
): { mime: string | null; valid: boolean; buffer: Buffer } {
  let buffer: Buffer;

  if (Buffer.isBuffer(candidate)) {
    buffer = candidate;
  } else {
    let b64 = candidate;
    const match = candidate.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      b64 = match[2];
    }

    // Ignore HTTP URLs for inline parsing
    if (candidate.startsWith("http://") || candidate.startsWith("https://")) {
       return { mime: null, valid: false, buffer: Buffer.alloc(0) };
    }

    try {
      buffer = Buffer.from(b64, "base64");
    } catch {
      return { mime: null, valid: false, buffer: Buffer.alloc(0) };
    }
  }

  if (buffer.length === 0) {
    return { mime: null, valid: false, buffer };
  }

  // PCM has no reliable magic bytes. It comes from a trusted endpoint
  // (/audio/speech), so accept it when the declared MIME matches and the
  // buffer is non-empty.
  const declared = normalizeDeclaredMime(declaredMimeType);
  if (declared === "audio/pcm") {
    return { mime: "audio/pcm", valid: true, buffer };
  }

  if (buffer.length < 3) {
    return { mime: null, valid: false, buffer };
  }

  const prefix = buffer.slice(0, 32);
  const asValid = (mime: string) => ({
    mime,
    valid: buffer.length >= (MIN_BYTES_BY_MIME[mime] ?? 1),
    buffer,
  });

  if (prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return asValid("image/jpeg");
  }

  if (buffer.length < 4) {
    return { mime: "application/octet-stream", valid: false, buffer };
  }
  if (prefix[0] === 0x89 && prefix[1] === 0x50 && prefix[2] === 0x4e && prefix[3] === 0x47) {
    return asValid("image/png");
  }
  if (prefix[0] === 0x52 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x46) {
    if (buffer.length >= 12 && prefix[8] === 0x57 && prefix[9] === 0x45 && prefix[10] === 0x42 && prefix[11] === 0x50) {
      return asValid("image/webp");
    }
  }
  if (prefix[0] === 0x47 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x38) {
    return asValid("image/gif");
  }

  // Audio/Video logic
  if (prefix[0] === 0x49 && prefix[1] === 0x44 && prefix[2] === 0x33) {
    return asValid("audio/mpeg"); // MP3 ID3
  }
  // MP3 without ID3 header: MPEG sync word (0xffe0 or 0xfffe pattern) with a
  // non-reserved layer (AAC ADTS uses 12-bit sync and layer bits == 00).
  if (prefix[0] === 0xff && (prefix[1] & 0xe0) === 0xe0 && (prefix[1] & 0x06) !== 0x00) {
    return asValid("audio/mpeg");
  }
  // Basic MP4 signature check (ftyp)
  if (buffer.length >= 8 && prefix[4] === 0x66 && prefix[5] === 0x74 && prefix[6] === 0x79 && prefix[7] === 0x70) {
    return asValid("video/mp4");
  }
  // Ogg container (Opus, Vorbis, Theora, etc.) — OggS
  if (prefix[0] === 0x4f && prefix[1] === 0x67 && prefix[2] === 0x67 && prefix[3] === 0x53) {
    return asValid("audio/ogg");
  }
  // AAC ADTS: 0xfff0..0xffff sync word family (12-bit sync + 4-bit ID/layer/protection)
  if (prefix[0] === 0xff && (prefix[1] & 0xf0) === 0xf0 && (prefix[1] & 0x06) === 0x00) {
    // MPEG sync words were already matched above; AAC ADTS has layer bits == 00.
    return asValid("audio/aac");
  }
  // Basic FLAC signature
  if (prefix[0] === 0x66 && prefix[1] === 0x4c && prefix[2] === 0x61 && prefix[3] === 0x43) {
    return asValid("audio/flac");
  }
  // Basic WAV (RIFF...WAVE)
  if (prefix[0] === 0x52 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x46 &&
      buffer.length >= 12 && prefix[8] === 0x57 && prefix[9] === 0x41 && prefix[10] === 0x56 && prefix[11] === 0x45) {
    return asValid("audio/wav");
  }

  return { mime: "application/octet-stream", valid: false, buffer };
}

const FAMILY_SAFE_MODE_MEDIA_BLOCKED =
  "Media generation is not available while Family Safe Mode is enabled.";

/**
 * Semantic image classifier — intentionally fail-closed.
 *
 * This is a placeholder awaiting integration of a real ML classifier
 * (e.g. TensorFlow.js with a PG-13 model).  Until that integration ships,
 * Family Safe Mode blocks all generated images.  Structural validation
 * (magic bytes, MIME, minimum size) runs unconditionally in
 * `identifyAndValidateGeneratedMedia`.
 */
export function classifyGeneratedImage(_buffer: Buffer, _mimeType: string): GeneratedMediaSafetyResult {
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: FAMILY_SAFE_MODE_MEDIA_BLOCKED,
  };
}

/**
 * Semantic audio classifier — intentionally fail-closed.
 *
 * Placeholder awaiting ML integration.  See classifyGeneratedImage.
 */
export function classifyGeneratedAudio(_buffer: Buffer, _mimeType: string): GeneratedMediaSafetyResult {
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: FAMILY_SAFE_MODE_MEDIA_BLOCKED,
  };
}

/**
 * Semantic video classifier — intentionally fail-closed.
 *
 * Placeholder awaiting ML integration.  Callers should pass only the first
 * ~64 KB of header/frame data, never the full video.  See classifyGeneratedImage.
 */
export function classifyGeneratedVideo(_buffer: Buffer, _mimeType: string): GeneratedMediaSafetyResult {
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: FAMILY_SAFE_MODE_MEDIA_BLOCKED,
  };
}

/**
 * Validates magic bytes and routes media to the appropriate semantic classifier.
 * Currently fails closed if Family Safe Mode is enabled because no real classifier exists yet.
 */
export function identifyAndValidateGeneratedMedia(
  candidateData: string | Buffer,
  declaredMimeType: string,
  localFamilySafeModeEnabled: boolean = true
): GeneratedMediaSafetyResult {
  // Treat HTTP URLs as opaque. We cannot inline-screen remote URLs without downloading.
  if (typeof candidateData === "string" && (candidateData.startsWith("http://") || candidateData.startsWith("https://"))) {
    if (!localFamilySafeModeEnabled) {
      return { allowed: true, skipped: true, reason: "remote-url-not-screened" };
    }
    return {
      allowed: false,
      reasonCode: "CLASSIFIER_UNAVAILABLE",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: FAMILY_SAFE_MODE_MEDIA_BLOCKED,
    };
  }

  // --- PHASE 1: Structural integrity validation (ALWAYS runs). ----
  const { valid, mime, buffer } = normalizeAndIdentifyMime(candidateData, declaredMimeType);
  if (!valid) {
    return {
      allowed: false,
      reasonCode: "INVALID_MEDIA",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: "The generated media format is invalid or corrupted.",
    };
  }

  const effectiveMime = mime || declaredMimeType;
  if (!effectiveMime.startsWith("image/") && !effectiveMime.startsWith("audio/") && !effectiveMime.startsWith("video/")) {
    return {
      allowed: false,
      reasonCode: "UNSUPPORTED_MEDIA",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: "The generated media format is unsupported by the safety filter.",
    };
  }

  // --- PHASE 2: Semantic classification (ONLY under Family Safe Mode). ----
  if (!localFamilySafeModeEnabled) {
    // Structural validation passed, FSM off — allow.
    return { allowed: true, skipped: true, reason: "local-family-safe-mode-disabled" };
  }

  if (effectiveMime.startsWith("image/")) {
    return classifyGeneratedImage(buffer, effectiveMime);
  } else if (effectiveMime.startsWith("audio/")) {
    return classifyGeneratedAudio(buffer, effectiveMime);
  } else {
    return classifyGeneratedVideo(buffer, effectiveMime);
  }
}
