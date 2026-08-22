export type GeneratedMediaSafetyResult =
  | { allowed: true; skipped?: boolean; reason?: string }
  | {
      allowed: false;
      reasonCode: "INVALID_MEDIA" | "UNSUPPORTED_MEDIA" | "CLASSIFIER_UNAVAILABLE" | "CLASSIFIER_BLOCK";
      category: string;
      userMessage?: string;
    };

/**
 * Normalizes a base64 string, data URI, or raw Buffer into raw bytes for magic-byte
 * checking, and extracts the MIME type.
 */
export function normalizeAndIdentifyMime(candidate: string | Buffer): { mime: string | null; valid: boolean; buffer: Buffer } {
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

  if (buffer.length < 4) {
    return { mime: null, valid: false, buffer };
  }

  const prefix = buffer.slice(0, 32);

  if (prefix[0] === 0xff && prefix[1] === 0xd8 && prefix[2] === 0xff) {
    return { mime: "image/jpeg", valid: true, buffer };
  }
  if (prefix[0] === 0x89 && prefix[1] === 0x50 && prefix[2] === 0x4e && prefix[3] === 0x47) {
    return { mime: "image/png", valid: true, buffer };
  }
  if (prefix[0] === 0x52 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x46) {
    if (prefix[8] === 0x57 && prefix[9] === 0x45 && prefix[10] === 0x42 && prefix[11] === 0x50) {
      return { mime: "image/webp", valid: true, buffer };
    }
  }
  if (prefix[0] === 0x47 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x38) {
    return { mime: "image/gif", valid: true, buffer };
  }

  // Audio/Video logic
  if (prefix[0] === 0x49 && prefix[1] === 0x44 && prefix[2] === 0x33) {
    return { mime: "audio/mpeg", valid: true, buffer }; // MP3 ID3
  }
  // Basic MP4 signature check (ftyp)
  if (prefix[4] === 0x66 && prefix[5] === 0x74 && prefix[6] === 0x79 && prefix[7] === 0x70) {
    return { mime: "video/mp4", valid: true, buffer };
  }
  // Basic FLAC signature
  if (prefix[0] === 0x66 && prefix[1] === 0x4c && prefix[2] === 0x61 && prefix[3] === 0x43) {
    return { mime: "audio/flac", valid: true, buffer };
  }
  // Basic WAV (RIFF...WAVE)
  if (prefix[0] === 0x52 && prefix[1] === 0x49 && prefix[2] === 0x46 && prefix[3] === 0x46 &&
      prefix[8] === 0x57 && prefix[9] === 0x41 && prefix[10] === 0x56 && prefix[11] === 0x45) {
    return { mime: "audio/wav", valid: true, buffer };
  }

  return { mime: "application/octet-stream", valid: false, buffer };
}

export function classifyGeneratedImage(buffer: Buffer, mimeType: string): GeneratedMediaSafetyResult {
  // TODO: Integrate actual ML classifier (e.g. TFJS) for semantic image screening.
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: "Semantic image screening is required in Family Safe Mode but no classifier is available.",
  };
}

export function classifyGeneratedAudio(buffer: Buffer, mimeType: string): GeneratedMediaSafetyResult {
  // TODO: Integrate actual ML classifier for semantic audio screening.
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: "Semantic audio screening is required in Family Safe Mode but no classifier is available.",
  };
}

export function classifyGeneratedVideo(buffer: Buffer, mimeType: string): GeneratedMediaSafetyResult {
  // TODO: Integrate actual ML classifier for semantic video screening.
  return {
    allowed: false,
    reasonCode: "CLASSIFIER_UNAVAILABLE",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: "Semantic video screening is required in Family Safe Mode but no classifier is available.",
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
  if (!localFamilySafeModeEnabled) {
    return { allowed: true, skipped: true, reason: "local-family-safe-mode-disabled" };
  }

  // Treat HTTP URLs as opaque. We cannot inline-screen remote URLs without downloading.
  if (typeof candidateData === "string" && (candidateData.startsWith("http://") || candidateData.startsWith("https://"))) {
    return {
      allowed: false,
      reasonCode: "CLASSIFIER_UNAVAILABLE",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: "Semantic screening is required in Family Safe Mode but no classifier is available for remote URLs.",
    };
  }

  const { valid, mime, buffer } = normalizeAndIdentifyMime(candidateData);
  if (!valid) {
    return {
      allowed: false,
      reasonCode: "INVALID_MEDIA",
      category: "HARM_CATEGORY_DANGEROUS_CONTENT",
      userMessage: "The generated media format is invalid or corrupted.",
    };
  }

  const effectiveMime = mime || declaredMimeType;

  if (effectiveMime.startsWith("image/")) {
    return classifyGeneratedImage(buffer, effectiveMime);
  } else if (effectiveMime.startsWith("audio/")) {
    return classifyGeneratedAudio(buffer, effectiveMime);
  } else if (effectiveMime.startsWith("video/")) {
    return classifyGeneratedVideo(buffer, effectiveMime);
  }

  return {
    allowed: false,
    reasonCode: "UNSUPPORTED_MEDIA",
    category: "HARM_CATEGORY_DANGEROUS_CONTENT",
    userMessage: "The generated media format is unsupported by the safety filter.",
  };
}
