import { describe, expect, it } from "vitest";
import {
  identifyAndValidateGeneratedMedia,
  normalizeAndIdentifyMime,
} from "./mediaScreener";

describe("normalizeAndIdentifyMime", () => {
  it.each([
    {
      label: "JPEG",
      bytes: [0xff, 0xd8, 0xff],
      expectedMime: "image/jpeg",
    },
    {
      label: "PNG",
      bytes: [0x89, 0x50, 0x4e, 0x47],
      expectedMime: "image/png",
    },
    {
      label: "WebP",
      bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50],
      expectedMime: "image/webp",
    },
    {
      label: "GIF",
      bytes: [0x47, 0x49, 0x46, 0x38],
      expectedMime: "image/gif",
    },
    {
      label: "MP3 with ID3",
      bytes: [0x49, 0x44, 0x33, 0x00],
      expectedMime: "audio/mpeg",
    },
    {
      label: "MP3 without ID3",
      bytes: [0xff, 0xfb, 0x00, 0x00],
      expectedMime: "audio/mpeg",
    },
    {
      label: "Ogg/Opus",
      bytes: [0x4f, 0x67, 0x67, 0x53, 0, 0, 0, 0],
      expectedMime: "audio/ogg",
    },
    {
      label: "AAC ADTS",
      bytes: [0xff, 0xf1, 0x00, 0x00, 0x00, 0x00, 0x00],
      expectedMime: "audio/aac",
    },
    {
      label: "FLAC",
      bytes: [0x66, 0x4c, 0x61, 0x43, 0, 0, 0, 0],
      expectedMime: "audio/flac",
    },
    {
      label: "WAV",
      bytes: [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x41, 0x56, 0x45],
      expectedMime: "audio/wav",
    },
    {
      label: "MP4",
      bytes: [0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70],
      expectedMime: "video/mp4",
    },
  ])("identifies $label from magic bytes", ({ bytes, expectedMime }) => {
    const buffer = Buffer.from(bytes);
    const result = normalizeAndIdentifyMime(buffer);
    expect(result.mime).toBe(expectedMime);
    expect(result.valid).toBe(true);
    expect(result.buffer).toBe(buffer);
  });

  describe("PCM", () => {
    it("accepts a non-empty buffer with declared audio/pcm", () => {
      const buffer = Buffer.from([0x00]);
      const result = normalizeAndIdentifyMime(buffer, "audio/pcm");
      expect(result.mime).toBe("audio/pcm");
      expect(result.valid).toBe(true);
    });

    it("rejects an empty buffer even with declared audio/pcm", () => {
      const result = normalizeAndIdentifyMime(Buffer.alloc(0), "audio/pcm");
      expect(result.mime).toBeNull();
      expect(result.valid).toBe(false);
    });
  });

  describe("byte floors", () => {
    it("rejects a 2-byte JPEG-like buffer", () => {
      const result = normalizeAndIdentifyMime(Buffer.from([0xff, 0xd8]));
      expect(result.valid).toBe(false);
      expect(result.mime).toBeNull();
    });

    it("rejects a 6-byte AAC-like buffer below the 7-byte floor", () => {
      const result = normalizeAndIdentifyMime(
        Buffer.from([0xff, 0xf1, 0, 0, 0, 0]),
      );
      expect(result.valid).toBe(false);
    });
  });
});

describe("identifyAndValidateGeneratedMedia", () => {
  it("skips screening when Family Safe Mode is disabled", () => {
    const result = identifyAndValidateGeneratedMedia(
      Buffer.from([0xff, 0xd8, 0xff]),
      "image/jpeg",
      false,
    );
    expect(result).toEqual({
      allowed: true,
      skipped: true,
      reason: "local-family-safe-mode-disabled",
    });
  });

  it("blocks valid non-empty media with CLASSIFIER_UNAVAILABLE in Family Safe Mode", () => {
    const result = identifyAndValidateGeneratedMedia(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0]),
      "image/png",
      true,
    );
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reasonCode).toBe("CLASSIFIER_UNAVAILABLE");
    expect(result.userMessage).toBe(
      "Media generation is not available while Family Safe Mode is enabled.",
    );
  });

  it("blocks https URLs with CLASSIFIER_UNAVAILABLE in Family Safe Mode", () => {
    const result = identifyAndValidateGeneratedMedia(
      "https://example.com/video.mp4",
      "video/mp4",
      true,
    );
    expect(result.allowed).toBe(false);
    if (result.allowed) return;
    expect(result.reasonCode).toBe("CLASSIFIER_UNAVAILABLE");
    expect(result.userMessage).toBe(
      "Media generation is not available while Family Safe Mode is enabled.",
    );
  });
});
