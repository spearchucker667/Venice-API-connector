import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterCreatorImportService, validateCardForApproval } from "./characterCreatorImportService";
import { CharacterDraftService, createBlankDraftCard } from "./characterCreatorDraftService";
import { useCharacterCardStore } from "../stores/character-card-store";
import StorageService from "./storageService";

vi.mock("./storageService", () => {
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

describe("CharacterCreatorImportService", () => {
  beforeEach(() => {
    (StorageService as any)._clear();
    useCharacterCardStore.setState({ cards: [], editingId: null });
  });

  it("validates character card before approval", () => {
    const validCard = createBlankDraftCard("Batman Replica");
    const val1 = validateCardForApproval(validCard);
    expect(val1.valid).toBe(true);

    const invalidCard = createBlankDraftCard("");
    invalidCard.data.name = "   ";
    const val2 = validateCardForApproval(invalidCard);
    expect(val2.valid).toBe(false);
    expect(val2.errors).toContain("Character name is required before creation.");
  });

  it("approves draft and creates local character atomically", async () => {
    const cardDto = createBlankDraftCard("The Dark Vigilante");
    cardDto.data.description = "A nocturnal crimefighter.";
    cardDto.data.first_mes = "The night is long.";

    const draft = await CharacterDraftService.create({
      sourceIdea: "Batman-like detective",
      card: cardDto,
    });

    const result = await CharacterCreatorImportService.approveAndCreateCharacter(draft.id);

    expect(result.character.id).toBeDefined();
    expect(result.character.name).toBe("The Dark Vigilante");
    expect(result.draft.status).toBe("created");
    expect(result.draft.createdCharacterId).toBe(result.character.id);

    const storedCards = useCharacterCardStore.getState().cards;
    expect(storedCards.some((c) => c.id === result.character.id)).toBe(true);
  });

  it("loads an existing local character as a new editable draft", async () => {
    const now = Date.now();
    const existingChar = {
      schema: "CharacterCardV1" as const,
      id: "char-existing-100",
      name: "Existing Detective",
      description: "Existing bio",
      systemPrompt: "",
      tags: ["detective"],
      adult: false,
      exampleDialogues: [],
      createdAt: now,
      updatedAt: now,
    };

    useCharacterCardStore.setState({ cards: [existingChar] });

    const draft = await CharacterCreatorImportService.loadExistingCharacterAsDraft("char-existing-100");
    expect(draft.sourceCharacterId).toBe("char-existing-100");
    expect(draft.card.data.name).toBe("Existing Detective");
    expect(draft.status).toBe("draft");
  });
});
