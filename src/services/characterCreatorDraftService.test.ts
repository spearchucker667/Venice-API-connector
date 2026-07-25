import { describe, it, expect, beforeEach, vi } from "vitest";
import { CharacterDraftService, createBlankDraftCard } from "./characterCreatorDraftService";
import StorageService from "./storageService";
import { CHARACTER_CREATOR_MODEL_ID } from "../constants/character-creator";

vi.mock("./storageService", () => {
  const store = new Map<string, Record<string, unknown>>();
  return {
    default: {
      getItems: vi.fn(async (_storeName: string) => {
        return Array.from(store.values());
      }),
      saveItem: vi.fn(async (_storeName: string, item: Record<string, unknown>) => {
        store.set(String(item.id), item);
        return item;
      }),
      deleteItem: vi.fn(async (_storeName: string, id: string) => {
        store.delete(id);
        return true;
      }),
      _clear: () => store.clear(),
    },
  };
});

describe("CharacterDraftService", () => {
  beforeEach(() => {
    (StorageService as any)._clear();
    vi.clearAllMocks();
  });

  it("creates a new draft and forces zai-org-glm-5-2 model ID", async () => {
    const blankCard = createBlankDraftCard("Test Hero");
    const draft = await CharacterDraftService.create({
      sourceIdea: "I want a gothic detective",
      card: blankCard,
    });

    expect(draft.id).toBeDefined();
    expect(draft.modelId).toBe(CHARACTER_CREATOR_MODEL_ID);
    expect(draft.card.data.name).toBe("Test Hero");
    expect(draft.status).toBe("draft");
  });

  it("lists, retrieves, updates, and deletes drafts", async () => {
    const draft = await CharacterDraftService.create({
      sourceIdea: "Idea 1",
      card: createBlankDraftCard("Hero 1"),
    });

    const list = await CharacterDraftService.list();
    expect(list.length).toBe(1);
    expect(list[0].name).toBe("Hero 1");

    const fetched = await CharacterDraftService.get(draft.id);
    expect(fetched?.id).toBe(draft.id);

    const updated = await CharacterDraftService.update(draft.id, {
      card: {
        ...draft.card,
        data: { ...draft.card.data, name: "Updated Hero Name" },
      },
    });
    expect(updated.card.data.name).toBe("Updated Hero Name");

    await CharacterDraftService.delete(draft.id);
    const afterDelete = await CharacterDraftService.get(draft.id);
    expect(afterDelete).toBeNull();
  });

  it("duplicates an existing draft with a copy suffix", async () => {
    const draft = await CharacterDraftService.create({
      sourceIdea: "Idea Original",
      card: createBlankDraftCard("Original Character"),
    });

    const duplicate = await CharacterDraftService.duplicate(draft.id);
    expect(duplicate.id).not.toBe(draft.id);
    expect(duplicate.card.data.name).toBe("Original Character (Copy)");
    expect(duplicate.status).toBe("draft");
  });

  it("sanitizes persisted draft model ID on get if corrupted", async () => {
    const draft = await CharacterDraftService.create({
      sourceIdea: "Test Corrupt",
      card: createBlankDraftCard("Corrupt Hero"),
    });

    // Simulate corrupted store entry with wrong modelId
    (StorageService.saveItem as any)("character_creator_drafts", {
      ...draft,
      modelId: "corrupted-model-id",
    });

    const fetched = await CharacterDraftService.get(draft.id);
    expect(fetched?.modelId).toBe(CHARACTER_CREATOR_MODEL_ID);
  });
});
