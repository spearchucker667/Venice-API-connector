/**
 * @fileoverview Character Creator draft persistence service.
 * Manages unfinished character drafts locally in IndexedDB / Electron storage.
 */

import StorageService from "./storageService";
import { CHARACTER_CREATOR_MODEL_ID } from "../constants/character-creator";
import {
  CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION,
  type CharacterCreatorDraft,
  type CharacterCreatorDraftSummary,
} from "../types/character-creator";
import type { CharacterCardV2Dto } from "../types/character-card-spec";
import { getActiveProfileId } from "./activeProfile";

const DRAFT_STORE = "character_creator_drafts" as const;

export type CharacterDraftPatch = Partial<Omit<CharacterCreatorDraft, "id" | "modelId">>;

export interface TryMarkCreatedResult {
  ok: true;
  draft: CharacterCreatorDraft;
}

export interface TryMarkCreatedMismatch {
  ok: false;
  notFound: boolean;
  draft?: CharacterCreatorDraft | undefined;
}

export interface CreateDraftRecordInput {
  sourceIdea: string;
  card: CharacterCardV2Dto;
  creatorMetadata?: CharacterCreatorDraft["creatorMetadata"];
  sourceCharacterId?: string;
}

export function createBlankDraftCard(name = "New Character"): CharacterCardV2Dto {
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name,
      description: "",
      personality: "",
      scenario: "",
      first_mes: "",
      mes_example: "",
      creator_notes: "",
      system_prompt: "",
      post_history_instructions: "",
      alternate_greetings: [],
      tags: [],
      creator: "Venice Forge Character Creator",
      character_version: "1.0",
      extensions: {
        "venice-forge": {
          generatedBy: "character-creator",
          modelId: CHARACTER_CREATOR_MODEL_ID,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      },
    },
  };
}

function sanitizeDraftModel(draft: CharacterCreatorDraft): CharacterCreatorDraft {
  const profileId = draft.profileId || getActiveProfileId();
  const schemaVersion = draft.schemaVersion || CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION;
  const fieldHistory = draft.fieldHistory || {};

  if (
    draft.modelId !== CHARACTER_CREATOR_MODEL_ID ||
    draft.schemaVersion !== CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION ||
    draft.profileId !== profileId
  ) {
    return {
      ...draft,
      schemaVersion,
      profileId,
      modelId: CHARACTER_CREATOR_MODEL_ID,
      fieldHistory,
    };
  }
  return draft;
}

export const CharacterDraftService = {
  async list(): Promise<CharacterCreatorDraftSummary[]> {
    const drafts = await StorageService.getItems<CharacterCreatorDraft>(DRAFT_STORE);
    return drafts
      .map(sanitizeDraftModel)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
      .map((d) => ({
        id: d.id,
        name: d.card?.data?.name || "Untitled Character",
        sourceIdea: d.sourceIdea,
        status: d.status,
        revision: d.revision,
        updatedAt: d.updatedAt,
        sourceCharacterId: d.sourceCharacterId,
        createdCharacterId: d.createdCharacterId,
      }));
  },

  async get(id: string): Promise<CharacterCreatorDraft | null> {
    const drafts = await StorageService.getItems<CharacterCreatorDraft>(DRAFT_STORE);
    const draft = drafts.find((d) => d.id === id);
    if (!draft) return null;
    return sanitizeDraftModel(draft);
  },

  async create(input: CreateDraftRecordInput): Promise<CharacterCreatorDraft> {
    const now = new Date().toISOString();
    const id = typeof crypto !== "undefined" && crypto.randomUUID
      ? `ccd_${crypto.randomUUID()}`
      : `ccd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    const draft: CharacterCreatorDraft = {
      id,
      schemaVersion: CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION,
      profileId: getActiveProfileId(),
      status: "draft",
      sourceIdea: input.sourceIdea,
      sourceCharacterId: input.sourceCharacterId,
      modelId: CHARACTER_CREATOR_MODEL_ID,
      card: input.card,
      creatorMetadata: input.creatorMetadata || {
        designSummary: "Initial character draft",
        assumptions: [],
        warnings: [],
        suggestedTags: [],
      },
      fieldHistory: {},
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    await StorageService.saveItem(DRAFT_STORE, draft as unknown as Record<string, unknown>, { origin: "local-user" });
    return draft;
  },

  async update(id: string, patch: CharacterDraftPatch, expectedRevision?: number): Promise<CharacterCreatorDraft> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`DRAFT_NOT_FOUND: Draft '${id}' does not exist.`);
    }

    if (expectedRevision !== undefined && existing.revision > expectedRevision) {
      throw new Error(`DRAFT_REVISION_MISMATCH: Draft '${id}' is at revision ${existing.revision}, expected ${expectedRevision}.`);
    }

    const updated: CharacterCreatorDraft = {
      ...existing,
      ...patch,
      schemaVersion: CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION,
      profileId: existing.profileId || getActiveProfileId(),
      modelId: CHARACTER_CREATOR_MODEL_ID,
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveItem(DRAFT_STORE, updated as unknown as Record<string, unknown>, { origin: "local-user" });
    return updated;
  },

  /**
   * Compares draft.revision against `expectedRevision` before persisting.
   * If the persistence succeeds, re-reads the row to detect whether another
   * concurrent writer overwrote our claim (last-writer-wins). Callers must
   * rollback any side-effects created before this method when it returns
   * `ok: false`.
   */
  async tryMarkCreated(
    id: string,
    patch: CharacterDraftPatch,
    expectedRevision: number,
  ): Promise<TryMarkCreatedResult | TryMarkCreatedMismatch> {
    const current = await this.get(id);
    if (!current) {
      return { ok: false, notFound: true };
    }
    if (current.status !== "draft" || current.revision !== expectedRevision) {
      // Either already created, or a concurrent caller advanced the revision.
      return { ok: false, notFound: false, draft: current };
    }

    const updated: CharacterCreatorDraft = {
      ...current,
      ...patch,
      schemaVersion: CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION,
      profileId: current.profileId || getActiveProfileId(),
      modelId: CHARACTER_CREATOR_MODEL_ID,
      revision: expectedRevision + 1,
      updatedAt: new Date().toISOString(),
    };

    await StorageService.saveItem(DRAFT_STORE, updated as unknown as Record<string, unknown>, { origin: "local-user" });

    const verified = await this.get(id);
    if (
      verified &&
      verified.status === updated.status &&
      verified.createdCharacterId === updated.createdCharacterId &&
      verified.revision === updated.revision
    ) {
      return { ok: true, draft: updated };
    }
    // Last-writer-wins claim did not stick; surface the canonical record.
    return { ok: false, notFound: verified === null, draft: verified ?? current };
  },

  async recordFieldHistory(id: string, fieldName: string, previousValue: string): Promise<CharacterCreatorDraft> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`DRAFT_NOT_FOUND: Draft '${id}' does not exist.`);
    }

    if (!previousValue || !previousValue.trim()) {
      return existing;
    }

    const currentHistory = existing.fieldHistory?.[fieldName] || [];
    if (currentHistory[currentHistory.length - 1] === previousValue) {
      return existing;
    }

    const updatedHistory = {
      ...(existing.fieldHistory || {}),
      [fieldName]: [...currentHistory, previousValue].slice(-10), // keep up to 10 historical values
    };

    return this.update(id, { fieldHistory: updatedHistory });
  },

  async delete(id: string): Promise<void> {
    await StorageService.deleteItem(DRAFT_STORE, id, { origin: "local-user" });
  },

  async duplicate(id: string): Promise<CharacterCreatorDraft> {
    const existing = await this.get(id);
    if (!existing) {
      throw new Error(`DRAFT_NOT_FOUND: Draft '${id}' does not exist.`);
    }

    const now = new Date().toISOString();
    const newId = `ccd_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const duplicatedCard: CharacterCardV2Dto = structuredClone(existing.card);
    if (duplicatedCard.data) {
      duplicatedCard.data.name = `${duplicatedCard.data.name || "Character"} (Copy)`;
    }

    const duplicated: CharacterCreatorDraft = {
      ...existing,
      id: newId,
      schemaVersion: CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION,
      profileId: getActiveProfileId(),
      status: "draft",
      createdCharacterId: undefined,
      card: duplicatedCard,
      revision: 1,
      createdAt: now,
      updatedAt: now,
    };

    await StorageService.saveItem(DRAFT_STORE, duplicated as unknown as Record<string, unknown>, { origin: "local-user" });
    return duplicated;
  },
};
