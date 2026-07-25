import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CharacterCreatorView } from "./CharacterCreatorView";
import * as aiService from "../../services/characterCreatorAiService";
import StorageService from "../../services/storageService";
import { useCharacterCardStore } from "../../stores/character-card-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useCharacterCreatorLaunchStore } from "../../stores/character-creator-launch-store";
import { CHARACTER_CREATOR_MODEL_ID } from "../../constants/character-creator";

vi.mock("../../services/storageService", () => {
  const store = new Map<string, Record<string, unknown>>();
  return {
    default: {
      getItems: vi.fn(async () => Array.from(store.values())),
      saveItem: vi.fn(async (storeName: string, item: Record<string, unknown>) => {
        store.set(String(item.id), item);
        return item;
      }),
      deleteItem: vi.fn(async (storeName: string, id: string) => {
        store.delete(id);
        return true;
      }),
      _clear: () => store.clear(),
    },
  };
});

vi.mock("../../services/characterCreatorAiService", async () => {
  const actual = await vi.importActual("../../services/characterCreatorAiService");
  return {
    ...actual,
    generateCharacterCreatorDraft: vi.fn(),
    createCharacterDraftAI: vi.fn(),
    reviseCharacterDraftAI: vi.fn(),
    regenerateCharacterFieldAI: vi.fn(),
  };
});

describe("CharacterCreatorView Component", () => {
  beforeEach(() => {
    (StorageService as any)._clear();
    useCharacterCardStore.setState({ cards: [] });
    useCharacterCreatorLaunchStore.getState().clear();
    useSettingsStore.getState().setActiveTab("character-creator");
    vi.clearAllMocks();
  });

  it("renders splash screen with hero text, instructions, and no model selector", async () => {
    render(<CharacterCreatorView />);

    expect(screen.getByText("Character Creator")).toBeInTheDocument();
    expect(screen.getByText("Turn a rough idea into a complete, editable character card.")).toBeInTheDocument();
    expect(screen.getByText(/GLM 5.2/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /model/i })).not.toBeInTheDocument();
  });

  it("consumes pending launch intent on mount", async () => {
    useCharacterCreatorLaunchStore.getState().launch({
      mode: "new-from-idea",
      sourceIdea: "Batman-inspired detective",
    });

    const mockResult = {
      analysis: {
        normalizedConcept: "Batman-inspired detective",
        intendedMode: "original" as const,
        coreTraits: ["detective"],
        settingDirection: "",
        relationshipDirection: "",
        toneDirection: "",
        originalityPlan: [],
        assumptions: [],
        warnings: [],
        userVisibleSummary: "Summary",
      },
      response: {
        operation: "create_draft" as const,
        design_summary: "Batman inspired hero",
        assumptions: ["Original character name created"],
        warnings: [],
        draft: {
          spec: "chara_card_v2" as const,
          spec_version: "2.0" as const,
          data: {
            name: "Shadow Knight",
            description: "Nocturnal protector",
            personality: "Brooding",
            scenario: "Gotham roof",
            first_mes: "I watch over the city.",
            mes_example: "",
            creator_notes: "",
            system_prompt: "",
            post_history_instructions: "",
            alternate_greetings: [],
            tags: ["hero"],
            creator: "Venice Forge",
            character_version: "1.0",
            extensions: {},
          },
        },
        validation: { valid: true, errors: [], warnings: [], recommendations: [] },
      },
      processEvents: [
        {
          id: "ev_1",
          phase: "concept-analysis" as const,
          status: "complete" as const,
          title: "Concept analysis complete",
          summary: "Parsed idea",
          source: "model-summary" as const,
          createdAt: new Date().toISOString(),
        },
      ],
    };

    vi.mocked(aiService.generateCharacterCreatorDraft).mockResolvedValueOnce(mockResult);

    render(<CharacterCreatorView />);

    await waitFor(() => {
      expect(screen.getByDisplayValue("Shadow Knight")).toBeInTheDocument();
    });

    expect(aiService.generateCharacterCreatorDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "create_draft",
        sourceIdea: "Batman-inspired detective",
      }),
      expect.any(Object),
      expect.anything(),
    );
  });

  it("handles model unavailability gracefully and displays error screen while preserving state", async () => {
    vi.mocked(aiService.generateCharacterCreatorDraft).mockRejectedValueOnce(
      new Error(`MODEL_UNAVAILABLE: Model '${CHARACTER_CREATOR_MODEL_ID}' is currently unavailable on Venice API.`),
    );

    render(<CharacterCreatorView />);

    const input = screen.getByPlaceholderText(/I want a brooding nocturnal detective/i);
    fireEvent.change(input, { target: { value: "Test concept" } });
    fireEvent.click(screen.getByRole("button", { name: /Create Draft/i }));

    await waitFor(() => {
      expect(screen.getByText("Character Creator Error")).toBeInTheDocument();
      expect(screen.getByText(/MODEL_UNAVAILABLE/i)).toBeInTheDocument();
    });
  });

  it("requires explicit user approval before saving character card into local library", async () => {
    const mockResult = {
      analysis: {
        normalizedConcept: "Create hero",
        intendedMode: "original" as const,
        coreTraits: [],
        settingDirection: "",
        relationshipDirection: "",
        toneDirection: "",
        originalityPlan: [],
        assumptions: [],
        warnings: [],
        userVisibleSummary: "Test Summary",
      },
      response: {
        operation: "create_draft" as const,
        design_summary: "Test Summary",
        assumptions: [],
        warnings: [],
        draft: {
          spec: "chara_card_v2" as const,
          spec_version: "2.0" as const,
          data: {
            name: "Vigilante Hero",
            description: "Bio text",
            personality: "Stern",
            scenario: "City street",
            first_mes: "Hello.",
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
      },
      processEvents: [],
    };

    vi.mocked(aiService.generateCharacterCreatorDraft).mockResolvedValueOnce(mockResult);

    render(<CharacterCreatorView />);

    fireEvent.change(screen.getByPlaceholderText(/I want a brooding nocturnal detective/i), {
      target: { value: "Create hero" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Create Draft/i }));

    await waitFor(() => {
      expect(screen.getByDisplayValue("Vigilante Hero")).toBeInTheDocument();
    });

    // Local library must still be empty before explicit approval
    expect(useCharacterCardStore.getState().cards.length).toBe(0);

    // Click Approve & Create Character in Editor -> goes to Ready screen
    fireEvent.click(screen.getByRole("button", { name: /Approve & Create Character/i }));

    await waitFor(() => {
      expect(screen.getByText("Character Ready for Approval")).toBeInTheDocument();
    });

    // Click Create Character on Ready screen -> explicit approval
    fireEvent.click(screen.getByRole("button", { name: /Create Character/i }));

    await waitFor(() => {
      expect(screen.getByText("Character Created")).toBeInTheDocument();
    });

    expect(useCharacterCardStore.getState().cards.length).toBe(1);
    expect(useCharacterCardStore.getState().cards[0].name).toBe("Vigilante Hero");
  });
});
