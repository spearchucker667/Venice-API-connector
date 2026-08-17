/** @fileoverview P3-001: runtime model metadata typing tests.
 *
 *  Upstream Swagger `20260814.194349` adds `ModelResponse.discount_to_user`
 *  and the style-reference capability fields (`model_spec.supportsStyleReferences`,
 *  `constraints.maxStyleReferences`, `constraints.supportsStyleReferenceStrength`).
 *  The type surface must expose them with honest absence semantics and the
 *  capability mapping must fail closed when metadata is missing.
 *
 *  Fixtures below mirror the upstream schema shapes (raw provider JSON,
 *  preserved field names) so parsing stays honest.
 */

import { describe, expect, it } from "vitest";
import type { VeniceModel } from "./venice";
import { resolveStyleReferenceCapabilities } from "../config/image-model-capabilities";

/** Upstream-shape fixture with a reseller discount (Swagger example: 0.2). */
const resellerFixture: VeniceModel = {
  id: "reseller-model",
  object: "model",
  created: 1699000000,
  owned_by: "venice",
  discount_to_user: 0.2,
  model_spec: {
    availableContextTokens: 131072,
    maxCompletionTokens: 16384,
    capabilities: { supportsFunctionCalling: true, supportsVision: true },
    supportsStyleReferences: true,
    constraints: {
      promptCharacterLimit: 2048,
      maxStyleReferences: 3,
      supportsStyleReferenceStrength: true,
    },
  },
};

/** Upstream-shape model with no discount agreement and no style references. */
const plainFixture: VeniceModel = {
  id: "plain-model",
  object: "model",
  created: 1699000000,
  owned_by: "venice",
  model_spec: {
    capabilities: { supportsFunctionCalling: false },
  },
};

describe("VeniceModel type surface (P3-001)", () => {
  it("preserves a present discount_to_user on the raw runtime object", () => {
    // Raw model objects are spread/preserved by the catalog; the typed field
    // must not be dropped and consumers can read it directly.
    const { discount_to_user, model_spec } = resellerFixture;
    expect(discount_to_user).toBe(0.2);
    expect(model_spec?.supportsStyleReferences).toBe(true);
    expect(model_spec?.constraints).toEqual(
      expect.objectContaining({
        maxStyleReferences: 3,
        supportsStyleReferenceStrength: true,
      }),
    );
  });

  it("treats an absent discount_to_user as no discount", () => {
    expect("discount_to_user" in plainFixture).toBe(false);
    expect(plainFixture.discount_to_user).toBeUndefined();
  });

  it("maps the fixture capability fields through the runtime resolver", () => {
    const caps = resolveStyleReferenceCapabilities(
      resellerFixture.id,
      resellerFixture.model_spec,
    );
    expect(caps).toEqual({ supported: true, maxReferences: 3, supportsStrength: true });
  });

  it("fails closed for the plain model (no style-reference metadata)", () => {
    const caps = resolveStyleReferenceCapabilities(
      plainFixture.id,
      plainFixture.model_spec,
    );
    expect(caps.supported).toBe(false);
    expect(caps.maxReferences).toBe(0);
  });
});