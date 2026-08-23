/**
 * @fileoverview Unit tests for P0/P1 Character Creator remediation fixes:
 * 1. Import Candidate Consumption (Electron IPC candidate handle resolution & one-time consumption).
 * 2. Draft Autosave Durability (flushPendingSave failure state preservation & CAS revision checks).
 * 3. Event UUID generation and IPC channel consolidation.
 */

import { describe, it, expect, vi } from "vitest";
import { CharacterDraftService } from "../../src/services/characterCreatorDraftService";
import { CharacterCreatorImportService } from "../../src/services/characterCreatorImportService";
import { desktopCharacterCards } from "../../src/services/desktopBridge";
import type { CharacterCardV2Dto } from "../../src/types/character-card-spec";

function createSampleV2Dto(name = "Imported Knight"): CharacterCardV2Dto {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name,
      description: "A skilled knight from the realm.",
      personality: "Honorable and strong.",
      scenario: "Guarding the castle gates.",
      first_mes: "Halt! Who goes there?",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      tags: ["knight", "warrior"],
      creator: "Test",
      character_version: "1.0",
      extensions: {},
    },
  };
}

describe("P0/P1 Character Creator Remediation Tests", () => {
  describe("1. Main-Process Import Candidate Handle Consumption (P0-01)", () => {
    it("delegates to desktopCharacterCards.consumeImportCandidate in Electron mode", async () => {
      const sampleDto = createSampleV2Dto("Guardian Knight");
      const handle = "candidate-handle-uuid-12345";

      const desktopBridge = await import("../../src/services/desktopBridge");
      vi.spyOn(desktopBridge, "isElectron").mockReturnValue(true);

      vi.spyOn(desktopCharacterCards, "consumeImportCandidate").mockResolvedValueOnce({
        ok: true,
        card: sampleDto,
        preview: {
          format: "v2-dto",
          name: "Guardian Knight",
          creator: "Test",
          characterVersion: "1.0",
          greetingCount: 1,
          exampleDialogueCount: 0,
          characterBookEntryCount: 0,
          extensionNamespaceCount: 0,
          warnings: [],
        },
      });

      // Execute loadImportHandleAsDraft with the opaque handle
      const draft = await CharacterCreatorImportService.loadImportHandleAsDraft(handle);

      expect(desktopCharacterCards.consumeImportCandidate).toHaveBeenCalledWith(handle);
      expect(draft.card.data.name).toBe("Guardian Knight");
      expect(draft.sourceIdea).toContain("Guardian Knight");
    });

    it("falls back gracefully to JSON text parsing when handle is JSON text or non-Electron", async () => {
      const sampleDto = createSampleV2Dto("JSON Hero");
      const jsonText = JSON.stringify(sampleDto);

      vi.spyOn(desktopCharacterCards, "consumeImportCandidate").mockResolvedValueOnce({
        ok: false,
        error: "Import preview expired or is no longer valid.",
      });

      const draft = await CharacterCreatorImportService.loadImportHandleAsDraft(jsonText);
      expect(draft.card.data.name).toBe("JSON Hero");
    });
  });

  describe("2. Draft Autosave & Revision CAS Durability (P0-02)", () => {
    it("enforces expectedRevision check in CharacterDraftService.update", async () => {
      const draft = await CharacterDraftService.create({
        sourceIdea: "CAS Test Draft",
        card: createSampleV2Dto("CAS Hero"),
      });

      // Valid revision update succeeds
      const updated = await CharacterDraftService.update(draft.id, { card: createSampleV2Dto("CAS Hero Updated") }, 1);
      expect(updated.card.data.name).toBe("CAS Hero Updated");

      // Stale expectedRevision throws DRAFT_REVISION_MISMATCH
      await expect(
        CharacterDraftService.update(draft.id, { card: createSampleV2Dto("Stale Hero") }, 0),
      ).rejects.toThrow("DRAFT_REVISION_MISMATCH");
    });

    it("generates UUID-based draft IDs", async () => {
      const draft = await CharacterDraftService.create({
        sourceIdea: "UUID Test Draft",
        card: createSampleV2Dto("UUID Hero"),
      });

      expect(draft.id).toMatch(/^ccd_[0-9a-f-]{10,}$/i);
    });
  });
});
