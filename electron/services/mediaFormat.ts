/** Canonical media MIME, extension, and magic-byte validation policy. */

export const MEDIA_EXTENSION_BY_MIME: Readonly<Record<string, string>> = {
  "video/mp4": "mp4",
  "audio/mp4": "m4a",
  "audio/aac": "aac",
  "audio/mpeg": "mp3",
  "audio/wav": "wav",
  "audio/x-wav": "wav",
  "audio/flac": "flac",
  "audio/ogg": "ogg",
  "audio/opus": "opus",
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/avif": "avif",
};

export function normalizeMediaMime(mimeType: string): string {
  return mimeType.split(";")[0].trim().toLowerCase();
}

export function mediaExtensionForMime(mimeType: string): string | undefined {
  return MEDIA_EXTENSION_BY_MIME[normalizeMediaMime(mimeType)];
}

function hasIsoBaseMediaSignature(bytes: Buffer): boolean {
  return bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp";
}

export function mediaBytesMatchMime(bytes: Buffer, rawMimeType: string): boolean {
  if (bytes.length === 0) return false;
  const mimeType = normalizeMediaMime(rawMimeType);
  switch (mimeType) {
    case "image/png":
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    case "image/jpeg":
    case "image/jpg":
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    case "image/webp":
      return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WEBP";
    case "image/gif":
      return bytes.length >= 6 && ["GIF87a", "GIF89a"].includes(bytes.subarray(0, 6).toString("ascii"));
    case "image/avif":
      return hasIsoBaseMediaSignature(bytes) && ["avif", "avis"].includes(bytes.subarray(8, 12).toString("ascii"));
    case "video/mp4":
    case "audio/mp4":
      return hasIsoBaseMediaSignature(bytes);
    case "audio/mpeg":
      return (bytes.length >= 3 && bytes.subarray(0, 3).toString("ascii") === "ID3") ||
        (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0);
    case "audio/wav":
    case "audio/x-wav":
      return bytes.length >= 12 && bytes.subarray(0, 4).toString("ascii") === "RIFF" && bytes.subarray(8, 12).toString("ascii") === "WAVE";
    case "audio/flac":
      return bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "fLaC";
    case "audio/ogg":
    case "audio/opus":
      return bytes.length >= 4 && bytes.subarray(0, 4).toString("ascii") === "OggS";
    case "audio/aac":
      return bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xf6) === 0xf0;
    default:
      return false;
  }
}
