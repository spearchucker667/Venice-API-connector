import { describe, expect, it } from "vitest";
import {
  MAX_STYLE_REFERENCE_BYTES,
  readStyleReferenceFile,
} from "./styleReferenceFiles";

describe("readStyleReferenceFile", () => {
  it.each([
    ["image/png", "reference.png"],
    ["image/jpeg", "reference.jpg"],
    ["image/webp", "reference.webp"],
  ])("accepts %s and returns the canonical reference shape", async (mimeType, name) => {
    const result = await readStyleReferenceFile(
      new File([new Uint8Array([1, 2, 3, 4])], name, { type: mimeType }),
    );

    expect(result).toMatchObject({
      name,
      mimeType,
      data: "AQIDBA==",
      strength: 0.5,
    });
    expect(result.entityId).toMatch(/^style-reference-/);
    expect(result.contentHash).toMatch(/^[0-9a-f]{8}$/);
    expect(result.data).not.toMatch(/^data:/);
  });

  it("returns a stable content hash for identical bytes and MIME type", async () => {
    const first = await readStyleReferenceFile(
      new File([new Uint8Array([9, 8, 7])], "first.png", { type: "image/png" }),
    );
    const second = await readStyleReferenceFile(
      new File([new Uint8Array([9, 8, 7])], "second.png", { type: "image/png" }),
    );

    expect(second.contentHash).toBe(first.contentHash);
  });

  it("rejects unsupported MIME types", async () => {
    await expect(
      readStyleReferenceFile(
        new File(["<svg />"], "reference.svg", { type: "image/svg+xml" }),
      ),
    ).rejects.toMatchObject({ code: "unsupported-type" });
  });

  it("rejects empty files", async () => {
    await expect(
      readStyleReferenceFile(new File([], "empty.png", { type: "image/png" })),
    ).rejects.toMatchObject({ code: "empty-file" });
  });

  it("rejects files at the documented 8 MiB upper bound", async () => {
    const oversized = new File([new Uint8Array(MAX_STYLE_REFERENCE_BYTES)], "large.png", {
      type: "image/png",
    });

    await expect(readStyleReferenceFile(oversized)).rejects.toMatchObject({
      code: "too-large",
    });
  });
});
