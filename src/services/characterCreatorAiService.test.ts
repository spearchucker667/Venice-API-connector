import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  buildCharacterCreatorRequest,
  createCharacterDraftAI,
  validateCharacterCreatorResponse,
} from "./characterCreatorAiService";
import { CharacterCreatorModelOverrideError } from "../constants/character-creator";
import * as fetchModule from "./veniceClient/fetch";

vi.mock("./veniceClient/fetch", () => ({
  veniceFetch: vi.fn(),
}));

describe("characterCreatorAiService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("buildCharacterCreatorRequest", () => {
    it("always sets model to zai-org-glm-5-2", () => {
      const req = buildCharacterCreatorRequest({
        operation: "create_draft",
        sourceIdea: "Batman-inspired detective",
      });
      expect(req.model).toBe("zai-org-glm-5-2");
      expect(req.messages[0].role).toBe("system");
    });

    it("rejects request if model override attempt differs from zai-org-glm-5-2", () => {
      expect(() =>
        buildCharacterCreatorRequest({
          operation: "create_draft",
          sourceIdea: "Test",
          model: "some-other-model",
        }),
      ).toThrow(CharacterCreatorModelOverrideError);
    });
  });

  describe("validateCharacterCreatorResponse", () => {
    it("parses valid CharacterCreatorResponse", () => {
      const validPayload = {
        operation: "create_draft",
        design_summary: "Inspired nocturnal detective",
        assumptions: ["Broad Batman traits"],
        warnings: [],
        draft: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "The Shadow Vigilante",
            description: "Nocturnal detective",
            personality: "Taciturn and obsessive",
            scenario: "Rooftop observation",
            first_mes: "Rain falls on Gotham-like streets.",
            mes_example: "<START>\n{{user}}: Who are you?\n{{char}}: I am the night.",
            creator_notes: "Inspired character",
            system_prompt: "",
            post_history_instructions: "",
            alternate_greetings: [],
            tags: ["detective", "vigilante"],
            creator: "Venice Forge Character Creator",
            character_version: "1.0",
            extensions: {},
          },
        },
        validation: {
          valid: true,
          errors: [],
          warnings: [],
          recommendations: [],
        },
      };

      const result = validateCharacterCreatorResponse(validPayload);
      expect(result).not.toBeNull();
      expect(result?.draft.data.name).toBe("The Shadow Vigilante");
      expect(result?.operation).toBe("create_draft");
    });

    it("rejects malformed output missing required V2 card fields", () => {
      const invalid = {
        operation: "create_draft",
        design_summary: "Broken",
        assumptions: [],
        warnings: [],
        draft: {
          spec: "chara_card_v2",
          spec_version: "2.0",
          data: {
            name: "Incomplete",
            // missing description, personality, etc.
          },
        },
        validation: { valid: false, errors: [], warnings: [], recommendations: [] },
      };
      expect(validateCharacterCreatorResponse(invalid)).toBeNull();
    });
  });

  describe("createCharacterDraftAI with single repair attempt", () => {
    it("returns parsed draft on successful first call", async () => {
      const validResponse = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  operation: "create_draft",
                  design_summary: "Complete draft",
                  assumptions: [],
                  warnings: [],
                  draft: {
                    spec: "chara_card_v2",
                    spec_version: "2.0",
                    data: {
                      name: "Knight Detective",
                      description: "Tactical vigilante",
                      personality: "Stoic",
                      scenario: "Rainy alleyway",
                      first_mes: "Stand back.",
                      mes_example: "",
                      creator_notes: "",
                      system_prompt: "",
                      post_history_instructions: "",
                      alternate_greetings: [],
                      tags: [],
                      creator: "Venice Forge",
                      character_version: "1.0",
                      extensions: {},
                    },
                  },
                  validation: { valid: true, errors: [], warnings: [], recommendations: [] },
                }),
              },
            },
          ],
        },
      };

      vi.mocked(fetchModule.veniceFetch).mockResolvedValueOnce(validResponse as any);

      const res = await createCharacterDraftAI({
        operation: "create_draft",
        sourceIdea: "I want a character that mimics Batman",
      });

      expect(res.draft.data.name).toBe("Knight Detective");
      expect(fetchModule.veniceFetch).toHaveBeenCalledTimes(1);
    });

    it("executes single repair request when first response is malformed JSON", async () => {
      const malformedFirst = {
        data: {
          choices: [{ message: { content: "Invalid json prose output..." } }],
        },
      };

      const repairedSecond = {
        data: {
          choices: [
            {
              message: {
                content: JSON.stringify({
                  operation: "create_draft",
                  design_summary: "Repaired draft",
                  assumptions: [],
                  warnings: [],
                  draft: {
                    spec: "chara_card_v2",
                    spec_version: "2.0",
                    data: {
                      name: "Repaired Hero",
                      description: "Fixed character",
                      personality: "Disciplined",
                      scenario: "City tower",
                      first_mes: "Greetings.",
                      mes_example: "",
                      creator_notes: "",
                      system_prompt: "",
                      post_history_instructions: "",
                      alternate_greetings: [],
                      tags: [],
                      creator: "Venice Forge",
                      character_version: "1.0",
                      extensions: {},
                    },
                  },
                  validation: { valid: true, errors: [], warnings: [], recommendations: [] },
                }),
              },
            },
          ],
        },
      };

      vi.mocked(fetchModule.veniceFetch)
        .mockResolvedValueOnce(malformedFirst as any)
        .mockResolvedValueOnce(repairedSecond as any);

      const res = await createCharacterDraftAI({
        operation: "create_draft",
        sourceIdea: "Concept idea",
      });

      expect(res.draft.data.name).toBe("Repaired Hero");
      expect(fetchModule.veniceFetch).toHaveBeenCalledTimes(2);
    });

    it("throws MODEL_UNAVAILABLE error if GLM 5.2 model call fails", async () => {
      vi.mocked(fetchModule.veniceFetch).mockRejectedValueOnce(new Error("404 Model zai-org-glm-5-2 not found"));

      await expect(
        createCharacterDraftAI({
          operation: "create_draft",
          sourceIdea: "Test concept",
        }),
      ).rejects.toThrow("MODEL_UNAVAILABLE");
    });
  });
});
