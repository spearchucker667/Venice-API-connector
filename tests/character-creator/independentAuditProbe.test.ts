import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import StorageService from "../../src/services/storageService";
import {
  CharacterDraftService,
  createBlankDraftCard,
} from "../../src/services/characterCreatorDraftService";
import { CharacterCreatorImportService } from "../../src/services/characterCreatorImportService";
import { useCharacterCardStore } from "../../src/stores/character-card-store";

function setProfile(profileId: string): void {
  window.localStorage.setItem("venice-active-profile-id", profileId);
}

describe("independent draft-hardening audit probes", () => {
  beforeEach(() => {
    setProfile("audit-profile");
    useCharacterCardStore.setState({
      cards: [],
      editingId: null,
      error: null,
      hasLoaded: false,
      isLoading: false,
    });
  });

  it("stores the raw draft row as an encrypted wrapper without known plaintext", async () => {
    const secretIdea = "AUDIT_SECRET_IDEA_7D68A";
    const secretName = "AUDIT_SECRET_NAME_4F19C";
    const draft = await CharacterDraftService.create({
      sourceIdea: secretIdea,
      card: createBlankDraftCard(secretName),
    });

    const db = await StorageService.openDB();
    const rawRow = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
      const tx = db.transaction("character_creator_drafts", "readonly");
      const request = tx
        .objectStore("character_creator_drafts")
        .get(`audit-profile:${draft.id}`);
      request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
      request.onerror = () => reject(request.error);
    });

    expect(rawRow?._isEncryptedWrapper).toBe(true);
    expect(rawRow?.data).toBeTruthy();
    expect(rawRow?.sourceIdea).toBeUndefined();
    expect(rawRow?.card).toBeUndefined();
    const serialized = JSON.stringify(rawRow);
    expect(serialized).not.toContain(secretIdea);
    expect(serialized).not.toContain(secretName);

    const roundTrip = await CharacterDraftService.get(draft.id);
    expect(roundTrip?.sourceIdea).toBe(secretIdea);
    expect(roundTrip?.card.data.name).toBe(secretName);
  });

  it("does not create duplicates when three approvals race concurrently", async () => {
    const draft = await CharacterDraftService.create({
      sourceIdea: "Concurrent approval audit",
      card: createBlankDraftCard("Concurrent Audit Hero"),
    });

    const results = await Promise.all([
      CharacterCreatorImportService.approveAndCreateCharacter(draft.id),
      CharacterCreatorImportService.approveAndCreateCharacter(draft.id),
      CharacterCreatorImportService.approveAndCreateCharacter(draft.id),
    ]);

    expect(new Set(results.map((result) => result.character.id)).size).toBe(1);
    expect(
      useCharacterCardStore
        .getState()
        .cards.filter((card) => card.name === "Concurrent Audit Hero"),
    ).toHaveLength(1);
  });

  it("does not leave an orphan if compensating character deletion fails", async () => {
    const draft = await CharacterDraftService.create({
      sourceIdea: "Rollback failure audit",
      card: createBlankDraftCard("Rollback Failure Audit Hero"),
    });
    const markSpy = vi
      .spyOn(CharacterDraftService, "tryMarkCreated")
      .mockRejectedValueOnce(new Error("INJECTED_DRAFT_WRITE_FAILURE"));
    const removeSpy = vi
      .spyOn(useCharacterCardStore.getState(), "remove")
      .mockResolvedValueOnce(false);

    await expect(
      CharacterCreatorImportService.approveAndCreateCharacter(draft.id),
    ).rejects.toThrow("INJECTED_DRAFT_WRITE_FAILURE");

    expect(
      useCharacterCardStore
        .getState()
        .cards.some((card) => card.name === "Rollback Failure Audit Hero"),
    ).toBe(false);
    const unchangedDraft = await CharacterDraftService.get(draft.id);
    expect(unchangedDraft?.status).toBe("draft");
    expect(unchangedDraft?.createdCharacterId).toBeUndefined();

    markSpy.mockRestore();
    removeSpy.mockRestore();
  });
});
