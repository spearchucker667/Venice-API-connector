import { describe, it, expect } from "vitest";
import {
  CHARACTER_CREATOR_MODEL_ID,
  CHARACTER_CREATOR_SYSTEM_PROMPT,
  CharacterCreatorModelOverrideError,
} from "./character-creator";

describe("Character Creator Constants", () => {
  it("defines immutable model ID zai-org-glm-5-2", () => {
    expect(CHARACTER_CREATOR_MODEL_ID).toBe("zai-org-glm-5-2");
  });

  it("contains complete system prompt text", () => {
    expect(CHARACTER_CREATOR_SYSTEM_PROMPT).toContain("# Venice Forge Character Creator");
    expect(CHARACTER_CREATOR_SYSTEM_PROMPT).toContain("Output Contract");
    expect(CHARACTER_CREATOR_SYSTEM_PROMPT).toContain("Instruction Boundaries");
  });

  it("throws CharacterCreatorModelOverrideError on invalid model attempt", () => {
    const error = new CharacterCreatorModelOverrideError();
    expect(error.name).toBe("CharacterCreatorModelOverrideError");
    expect(error.message).toContain("zai-org-glm-5-2");
  });
});
