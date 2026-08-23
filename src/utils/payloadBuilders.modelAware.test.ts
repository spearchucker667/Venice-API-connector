/** @fileoverview VERIFY-043 — payloadBuilders honors per-capability stripping
 *  flags so the form's model-aware visibility decisions cannot regress
 *  at the network boundary. */

import { describe, expect, it } from "vitest";
import { buildImagePayload } from "./payloadBuilders";

describe("buildImagePayload — model-aware sanitization (VERIFY-043)", () => {
  it("strips negative_prompt when supportsNegativePrompt is false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      negative: "blurry",
      supportsNegativePrompt: false,
    });
    expect(payload).not.toHaveProperty("negative_prompt");
  });

  it("strips style_preset when supportsStyle is false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      style: "photo",
      supportsStyle: false,
    });
    expect(payload).not.toHaveProperty("style_preset");
  });

  it("strips steps when supportsSteps is false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      steps: 25,
      supportsSteps: false,
    });
    expect(payload).not.toHaveProperty("steps");
  });

  it("strips cfg_scale when supportsCfgScale is false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      cfg: 7,
      supportsCfgScale: false,
    });
    expect(payload).not.toHaveProperty("cfg_scale");
  });

  it("omits the seed key when supportsSeed is false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      supportsSeed: false,
    }, undefined, { mode: "fixed", value: 42 });
    expect(payload).not.toHaveProperty("seed");
  });

  it("keeps the field when supports* is undefined (legacy callers)", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      negative: "blurry",
      style: "photo",
      steps: 25,
      cfg: 7,
      // no supports* flags — legacy path
    }, undefined, { mode: "fixed", value: 42 });
    expect(payload).toHaveProperty("negative_prompt", "blurry");
    expect(payload).toHaveProperty("style_preset", "photo");
    expect(payload).toHaveProperty("steps", 25);
    expect(payload).toHaveProperty("cfg_scale", 7);
    expect(payload).toHaveProperty("seed", 42);
  });

  it("preserves supportsVariants gating", () => {
    const on = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      imageCount: 2,
      supportsVariants: true,
    });
    expect(on).toHaveProperty("variants", 2);

    const off = buildImagePayload("flux-dev", {
      prompt: "A copper city at dusk",
      imageCount: 2,
      supportsVariants: false,
    });
    expect(off).not.toHaveProperty("variants");
  });

  // VERIFY-082 — style references are emitted only for supported models.
  // P1-004: the wire shape is the documented
  // `style_references: [{ image, strength }]` array (GenerateImageRequest,
  // Swagger 20260814.194349); `reference_image_urls` is not a generate
  // property and must never be emitted.
  it("emits style_references with image and default strength when supported", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: true,
      references: [
        { entityId: "alice", mimeType: "image/png", contentHash: "abc", data: "iVBORw0KGgo=" },
      ],
    });
    expect(payload).toHaveProperty("style_references");
    expect(payload).not.toHaveProperty("reference_image_urls");
    const refs = payload.style_references as Array<{ image: string; strength?: number }>;
    expect(refs).toHaveLength(1);
    expect(refs[0]!.image).toMatch(/^data:image\/png;base64,/);
    expect(refs[0]!.strength).toBe(0.5);
  });

  it("clamps strength to 0.1–1 and honors explicit strengths", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: true,
      references: [
        { entityId: "a", mimeType: "image/png", contentHash: "a", data: "aGVsbG8=", strength: 2.5 },
        { entityId: "b", mimeType: "image/png", contentHash: "b", data: "d29ybGQ=", strength: 0.05 },
        { entityId: "c", mimeType: "image/png", contentHash: "c", data: "Y2Nj", strength: 0.7 },
      ],
      maxStyleReferences: 2,
    });
    const refs = payload.style_references as Array<{ image: string; strength?: number }>;
    expect(refs).toHaveLength(2);
    expect(refs[0]!.strength).toBe(1);
    expect(refs[1]!.strength).toBe(0.1);
  });

  it("omits strength when the model does not honor it", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: true,
      supportsStyleReferenceStrength: false,
      references: [
        { entityId: "alice", mimeType: "image/png", contentHash: "abc", data: "iVBORw0KGgo=" },
      ],
    });
    const refs = payload.style_references as Array<{ image: string; strength?: number }>;
    expect(refs[0]!.strength).toBeUndefined();
  });

  it("drops style_references when supportsReferences is false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: false,
      references: [
        { entityId: "alice", mimeType: "image/png", contentHash: "abc", data: "iVBORw0KGgo=" },
      ],
    });
    expect(payload).not.toHaveProperty("style_references");
  });

  it("drops style_references when references array is empty", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: true,
      references: [],
    });
    expect(payload).not.toHaveProperty("style_references");
  });


  // VF-P1-004: Character scene references capability validation
  it("omits style_references entirely if model explicitly sets supportsReferences = false", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: false, // explicitly false
      references: [
        { entityId: "alice", mimeType: "image/png", contentHash: "abc", data: "iVBORw0KGgo=" },
      ],
    });
    expect(payload).not.toHaveProperty("style_references");
    expect(payload).not.toHaveProperty("reference_image_urls");
  });

  it("omits style_references if model is missing metadata (defaults to safe false)", () => {
    const payload = buildImagePayload("unknown-model", {
      prompt: "Alice in a garden",
      supportsReferences: undefined, // missing capability flag
      references: [
        { entityId: "alice", mimeType: "image/png", contentHash: "abc", data: "iVBORw0KGgo=" },
      ],
    });
    expect(payload).not.toHaveProperty("style_references");
    expect(payload).not.toHaveProperty("reference_image_urls");
  });

  it("clamps references array to maxStyleReferences limit", () => {
    const payload = buildImagePayload("flux-dev", {
      prompt: "Alice in a garden",
      supportsReferences: true,
      maxStyleReferences: 1, // limited to 1
      references: [
        { entityId: "alice", mimeType: "image/png", contentHash: "abc", data: "iVBORw0KGgo=" },
        { entityId: "bob", mimeType: "image/png", contentHash: "def", data: "iVBORw0KGgo=" },
      ],
    });
    expect(payload).toHaveProperty("style_references");
    const refs = payload.style_references as any[];
    expect(refs).toHaveLength(1);
    expect(refs[0].image).toMatch(/^data:image\/png;base64,/);
  });
});
