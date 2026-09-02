import { describe, expect, it } from "vitest";
import { buildLogicalRequestFingerprint } from "./logicalRequestFingerprint";

describe("buildLogicalRequestFingerprint", () => {
  it("hashes Unicode paid-generation payloads without retaining prompt text", async () => {
    const prompt = "夕焼けの海 — café orchestral 🎻";
    const fingerprint = await buildLogicalRequestFingerprint("video", {
      model: "video-model",
      prompt,
      duration: "5s",
    });

    expect(fingerprint).toMatch(/^video-sha256:[a-f0-9]{64}$/);
    expect(fingerprint).not.toContain(prompt);
  });

  it("is stable across object key order and changes with the payload", async () => {
    const first = await buildLogicalRequestFingerprint("audio", {
      model: "music-model",
      prompt: "hello",
    });
    const reordered = await buildLogicalRequestFingerprint("audio", {
      prompt: "hello",
      model: "music-model",
    });
    const changed = await buildLogicalRequestFingerprint("audio", {
      model: "music-model",
      prompt: "different",
    });

    expect(reordered).toBe(first);
    expect(changed).not.toBe(first);
  });
});
