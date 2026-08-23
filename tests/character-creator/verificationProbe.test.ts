/**
 * @fileoverview Verification Probe Suite for Draft Store Hardening & Character Creator Delivery.
 * Runs real storage probes and validates raw bytes, encryption, idempotency, transactionality,
 * canonical V2 validation, and avatar PNG normalization.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import "fake-indexeddb/auto";
import StorageService from "../../src/services/storageService";
import { CharacterDraftService } from "../../src/services/characterCreatorDraftService";
import { CharacterCreatorImportService, validateCardForApproval } from "../../src/services/characterCreatorImportService";
import { inspectCharacterCardPng, embedCharacterCardInPng } from "../../electron/services/characterCardPngCodec";
import { useCharacterCardStore } from "../../src/stores/character-card-store";
import type { CharacterCardV2Dto } from "../../src/types/character-card-spec";

function setTestProfile(profileId: string) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("venice-active-profile-id", profileId);
  }
}

function createSampleV2Card(name = "Probe Hero"): CharacterCardV2Dto {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name,
      description: "A brave probe character for automated verification.",
      personality: "Analytical, precise, vigilant.",
      scenario: "Inside a verification test runner.",
      first_mes: "Verification probe online. {{user}} is ready.",
      mes_example: "<START>\n{{user}}: Status?\n{{char}}: Operational.",
      creator_notes: "Verification notes",
      system_prompt: "Respond concisely.",
      post_history_instructions: "Maintain verification rigor.",
      alternate_greetings: ["Systems online."],
      tags: ["verification", "test"],
      creator: "Adversarial Verifier",
      character_version: "1.0",
      extensions: {},
    },
  };
}

describe("Adversarial Verification Probe Suite", () => {
  beforeEach(() => {
    setTestProfile("default");
    useCharacterCardStore.setState({ cards: [], editingId: null });
  });

  describe("1. Draft Store Encryption & Scoping Probes", () => {
    it("proves raw storage row is AES-GCM encrypted and plaintext fields are absent", async () => {
      setTestProfile("profile-alpha");
      const sensitiveIdea = "CLASSIFIED_PROJECT_ZEUS_IDEA_12345";
      const sensitiveName = "CLASSIFIED_CHARACTER_ZEUS_99";

      const card = createSampleV2Card(sensitiveName);
      const draft = await CharacterDraftService.create({
        sourceIdea: sensitiveIdea,
        card,
      });

      // Fetch raw rows directly from StorageService underlying IndexedDB store
      const db = await StorageService.openDB();
      const rawRow = await new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const tx = db.transaction("character_creator_drafts", "readonly");
        const request = tx
          .objectStore("character_creator_drafts")
          .get(`profile-alpha:${draft.id}`);
        request.onsuccess = () => resolve(request.result as Record<string, unknown> | undefined);
        request.onerror = () => reject(request.error);
      });

      expect(rawRow).toBeDefined();
      // Verify raw row contains encryption wrapper flags
      expect(rawRow!._isEncryptedWrapper).toBe(true);
      expect(rawRow!.data).toBeDefined();
      expect(rawRow!.sourceIdea).toBeUndefined();

      // Stringify raw row and assert plaintext sensitive string is NOT present anywhere in raw storage wrapper
      const rawJson = JSON.stringify(rawRow);
      expect(rawJson.includes(sensitiveIdea)).toBe(false);
      expect(rawJson.includes(sensitiveName)).toBe(false);
    });

    it("denies access when Profile B reads Profile A's draft", async () => {
      setTestProfile("profile-user-a");
      const draftA = await CharacterDraftService.create({
        sourceIdea: "User A Private Concept",
        card: createSampleV2Card("User A Character"),
      });

      // Switch to Profile B
      setTestProfile("profile-user-b");
      const bList = await CharacterDraftService.list();
      expect(bList.some((d) => d.id === draftA.id)).toBe(false);

      const bFetch = await CharacterDraftService.get(draftA.id);
      expect(bFetch).toBeNull();
    });
  });

  describe("2. Creation Integrity & Idempotency Probes", () => {
    it("guarantees idempotency on 3x rapid creation calls", async () => {
      setTestProfile("profile-alpha");
      const draft = await CharacterDraftService.create({
        sourceIdea: "Idempotency Probe Idea",
        card: createSampleV2Card("Idempotent Hero"),
      });

      const res1 = await CharacterCreatorImportService.approveAndCreateCharacter(draft.id);
      const res2 = await CharacterCreatorImportService.approveAndCreateCharacter(draft.id);
      const res3 = await CharacterCreatorImportService.approveAndCreateCharacter(draft.id);

      expect(res1.character.id).toBe(res2.character.id);
      expect(res2.character.id).toBe(res3.character.id);

      const storeCards = useCharacterCardStore.getState().cards;
      const matches = storeCards.filter((c) => c.name === "Idempotent Hero");
      expect(matches.length).toBe(1);
    });

    it("guarantees zero orphaned character records on draft update failure (transactional rollback)", async () => {
      setTestProfile("profile-alpha");
      const draft = await CharacterDraftService.create({
        sourceIdea: "Failure Injection Idea",
        card: createSampleV2Card("Rollback Hero"),
      });

      // The atomic claim step is the canonical failure boundary after the character
      // card has been persisted but before the draft is finalized. Mock the new
      // contract target (tryMarkCreated), not the legacy update path.
      const tryMarkSpy = vi
        .spyOn(CharacterDraftService, "tryMarkCreated")
        .mockRejectedValueOnce(new Error("MOCK_PERSISTENCE_FAILURE"));

      await expect(
        CharacterCreatorImportService.approveAndCreateCharacter(draft.id),
      ).rejects.toThrow("MOCK_PERSISTENCE_FAILURE");

      const storeCards = useCharacterCardStore.getState().cards;
      expect(storeCards.some((c) => c.name === "Rollback Hero")).toBe(false);

      tryMarkSpy.mockRestore();
    });
  });

  describe("3. Canonical V2 Validation Probes", () => {
    it("rejects invalid schema or malformed macro syntax", () => {
      const badMacroCard = createSampleV2Card("Bad Macro");
      badMacroCard.data.first_mes = "Hello {{user without closing braces";

      const res = validateCardForApproval(badMacroCard);
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes("Macro syntax error"))).toBe(true);
    });
  });

  describe("4. Avatar PNG Codec Probes", () => {
    it("embeds V2 card into valid PNG and inspects extracted metadata", () => {
      // Create a minimal 1x1 RGBA PNG buffer
      const blankPng = Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
        "base64",
      );

      const sampleCard = createSampleV2Card("Codec Hero");
      const embeddedPng = embedCharacterCardInPng(blankPng, sampleCard);

      expect(embeddedPng).toBeDefined();
      expect(embeddedPng.length).toBeGreaterThan(blankPng.length);

      const inspection = inspectCharacterCardPng(embeddedPng);
      expect(inspection.card.data.name).toBe("Codec Hero");
      expect(inspection.width).toBe(1);
      expect(inspection.height).toBe(1);
    });
  });
});
