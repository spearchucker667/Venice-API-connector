import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { CharacterCreatorView } from "./CharacterCreatorView";
import * as aiService from "../../services/characterCreatorAiService";
import StorageService from "../../services/storageService";
import { useCharacterCardStore } from "../../stores/character-card-store";
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
    createCharacterDraftAI: vi.fn(),
    reviseCharacterDraftAI: vi.fn(),
    regenerateCharacterFieldAI: vi.fn(),
  };
});

describe("CharacterCreatorView Component", () => {
  beforeEach(() => {
    (StorageService as any)._clear();
    useCharacterCardStore.setState({ cards: [] });
    vi.clearAllMocks();
  });

  it("renders splash screen with hero text, instructions, and no model selector", async () => {
    render(<CharacterCreatorView />);

    expect(screen.getByText("Character Creator")).toBeInTheDocument();
    expect(screen.getByText("Turn a rough idea into a complete, editable character card.")).toBeInTheDocument();
    expect(screen.getByText(/GLM 5.2/i)).toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: /model/i })).not.toBeInTheDocument();
  });

  it("transitions to generating state and then draft editor upon successful AI response", async () => {
    const mockResponse = {
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
    };

    vi.mocked(aiService.createCharacterDraftAI).mockResolvedValueOnce(mockResponse);

    render(<CharacterCreatorView />);

    const input = screen.getByPlaceholderText(/I want a brooding nocturnal detective/i);
    fireEvent.change(input, { target: { value: "I want a character that mimics Batman." } });

    const createBtn = screen.getByRole("button", { name: /Create Draft/i });
    fireEvent.click(createBtn);

    expect(screen.getByText("Building identity")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByDisplayValue("Shadow Knight")).toBeInTheDocument();
    });

    expect(aiService.createCharacterDraftAI).toHaveBeenCalledWith(
      expect.objectContaining({
        operation: "create_draft",
        sourceIdea: "I want a character that mimics Batman.",
      }),
      expect.any(Object),
    );
  });

  it("handles model unavailability gracefully and displays error screen while preserving state", async () => {
    vi.mocked(aiService.createCharacterDraftAI).mockRejectedValueOnce(
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
    const mockResponse = {
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
    };

    vi.mocked(aiService.createCharacterDraftAI).mockResolvedValueOnce(mockResponse);

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

    expect(screen.getByText("Character Ready for Approval")).toBeInTheDocument();

    // Click Create Character on Ready screen -> explicit approval
    fireEvent.click(screen.getByRole("button", { name: /Create Character/i }));

    await waitFor(() => {
      expect(screen.getByText("Character Created")).toBeInTheDocument();
    });

    expect(useCharacterCardStore.getState().cards.length).toBe(1);
    expect(useCharacterCardStore.getState().cards[0].name).toBe("Vigilante Hero");
  });
});
