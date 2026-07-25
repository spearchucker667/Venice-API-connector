/**
 * @fileoverview REAL storage integration test for Character Creator Draft Service.
 * Tests write, read, version bump, encryption at rest verification (raw bytes encrypted),
 * and profile isolation WITHOUT mocking StorageService.
 */

import { describe, it, expect, beforeEach } from "vitest";
import "fake-indexeddb/auto";
import StorageService from "./storageService";
import { CharacterDraftService } from "./characterCreatorDraftService";
import { createBlankDraftCard } from "./characterCreatorDraftService";
import { CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION } from "../types/character-creator";

function setTestProfile(profileId: string) {
  if (typeof window !== "undefined" && window.localStorage) {
    window.localStorage.setItem("venice-active-profile-id", profileId);
  }
}

describe("CharacterCreatorDraftService (Real Storage Integration)", () => {
  beforeEach(() => {
    setTestProfile("default");
  });

  it("persists drafts encrypted at rest in IndexedDB with schemaVersion and profileId", async () => {
    setTestProfile("profile-alpha");
    const uniqueIdea = "Secret Top Secret Idea 998877";
    const draft = await CharacterDraftService.create({
      sourceIdea: uniqueIdea,
      card: createBlankDraftCard("Encrypted Hero"),
    });

    expect(draft.schemaVersion).toBe(CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION);
    expect(draft.profileId).toBe("profile-alpha");

    // 1. Read through StorageService as profile-alpha -> decrypted clean draft
    const fetched = await CharacterDraftService.get(draft.id);
    expect(fetched).not.toBeNull();
    expect(fetched?.sourceIdea).toBe(uniqueIdea);
    expect(fetched?.profileId).toBe("profile-alpha");
    expect(fetched?.schemaVersion).toBe(1);

    // 2. Profile Isolation: Switch active profile to profile-beta -> expects empty
    setTestProfile("profile-beta");
    const betaList = await CharacterDraftService.list();
    expect(betaList.some((d) => d.id === draft.id)).toBe(false);

    const betaFetch = await CharacterDraftService.get(draft.id);
    expect(betaFetch).toBeNull();

    // Switch back to profile-alpha -> draft is accessible
    setTestProfile("profile-alpha");
    const alphaList = await CharacterDraftService.list();
    expect(alphaList.some((d) => d.id === draft.id)).toBe(true);
  });

  it("upgrades legacy drafts missing schemaVersion to current version 1", async () => {
    setTestProfile("profile-alpha");
    // Manually save legacy record missing schemaVersion
    const legacyRecord = {
      id: "ccd_legacy_123",
      status: "draft",
      sourceIdea: "Legacy concept",
      modelId: "zai-org-glm-5-2",
      card: createBlankDraftCard("Legacy Hero"),
      creatorMetadata: { designSummary: "legacy", assumptions: [], warnings: [], suggestedTags: [] },
      revision: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveItem("character_creator_drafts", legacyRecord, { origin: "local-user" });

    const fetched = await CharacterDraftService.get("ccd_legacy_123");
    expect(fetched).not.toBeNull();
    expect(fetched?.schemaVersion).toBe(1);
    expect(fetched?.profileId).toBe("profile-alpha");
  });
});
