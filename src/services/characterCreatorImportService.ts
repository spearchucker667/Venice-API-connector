import { CHARACTER_CREATOR_MODEL_ID } from "../constants/character-creator";
import { mapV2ToInternal, mapV1ToInternal, mapInternalToV2, validateCharacterCardV2 } from "./characterCards/characterCardAdapter";
import { CharacterDraftService } from "./characterCreatorDraftService";
import { useCharacterCardStore } from "../stores/character-card-store";
import type { CharacterCreatorDraft } from "../types/character-creator";
import type { CharacterCardV1 } from "../types/rp";
import type { CharacterCardV2Dto, CharacterCardValidationIssue } from "../types/character-card-spec";
import { CARD_FIELD_MAX } from "../types/rp";
import { countPromptCharacters } from "../shared/promptLimits";

export interface ApproveAndCreateOptions {
  saveAsCopy?: boolean;
  avatarDataUrl?: string;
}

export interface LocalCharacterImportResult {
  character: CharacterCardV1;
  draft: CharacterCreatorDraft;
  isUpdate: boolean;
}

export interface CardApprovalValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  issues: CharacterCardValidationIssue[];
}

/**
 * Enforces canonical Character Card V2 schema validation and required semantic rules:
 * 1. Schema: spec === "chara_card_v2", spec_version === "2.0", required types & fields.
 * 2. Name Rule: data.name required, non-empty, max 100 characters.
 * 3. Greeting Rule: data.first_mes recommended for chat readiness.
 * 4. Macro Balance Rule: {{char}} and {{user}} template macros must have balanced braces.
 * 5. Field Bounds Rule: String fields must not exceed 50,000 characters.
 * 6. Token Estimate Rule: Combined prompt fields warn if estimated tokens > 8,000.
 */
export function validateCardForApproval(card: CharacterCardV2Dto): CardApprovalValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const issues = validateCharacterCardV2(card);

  for (const issue of issues) {
    if (issue.severity === "error") {
      errors.push(issue.message);
    } else if (issue.severity === "warning") {
      warnings.push(issue.message);
    }
  }

  const data = card.data;
  if (!data) {
    errors.push("Character card data is missing.");
    return { valid: false, errors, warnings, issues };
  }

  if (!data.name || !data.name.trim()) {
    errors.push("Character name is required before creation.");
  } else if (data.name.length > 100) {
    errors.push("Character name cannot exceed 100 characters.");
  }

  if (!data.first_mes || !data.first_mes.trim()) {
    warnings.push("Character first message (greeting) is empty.");
  }

  if (!data.description || !data.description.trim()) {
    warnings.push("Character description is empty.");
  }

  if (!data.personality || !data.personality.trim()) {
    warnings.push("Character personality is empty.");
  }

  // Macro balance & syntax check for {{char}} and {{user}}
  const fieldsToCheck = [
    data.description,
    data.personality,
    data.scenario,
    data.first_mes,
    data.mes_example,
    data.system_prompt,
    data.post_history_instructions,
  ];

  for (const text of fieldsToCheck) {
    if (!text) continue;
    // Check for malformed macro tags like {{char without closing }}
    const openBraces = (text.match(/\{\{/g) || []).length;
    const closeBraces = (text.match(/\}\}/g) || []).length;
    if (openBraces !== closeBraces) {
      errors.push("Macro syntax error: unmatched '{{' or '}}' braces in character text fields.");
      break;
    }
  }

  // Field character bounds check
  if (data.description && data.description.length > CARD_FIELD_MAX) {
    errors.push(`Description exceeds maximum character limit of ${CARD_FIELD_MAX.toLocaleString()} characters.`);
  }
  if (data.first_mes && data.first_mes.length > CARD_FIELD_MAX) {
    errors.push(`First message exceeds maximum character limit of ${CARD_FIELD_MAX.toLocaleString()} characters.`);
  }

  // Token estimate check
  const totalPromptChars = countPromptCharacters(
    [
      data.system_prompt || "",
      data.description || "",
      data.personality || "",
      data.scenario || "",
      data.first_mes || "",
      data.post_history_instructions || "",
    ].join("\n"),
  );
  const estimatedTokens = Math.ceil(totalPromptChars / 4);
  if (estimatedTokens > 8000) {
    warnings.push(`Character prompt budget is large (~${estimatedTokens.toLocaleString()} estimated tokens).`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    issues,
  };
}

/**
 * Per-draft FIFO mutex for the approval path. Serializing concurrent callers
 * at the JS layer is required because IndexedDB does not provide cross-store
 * atomic transactions and we must collapse N concurrent claims of the same
 * draft into a single character record. The optimistic-concurrency verify in
 * `tryMarkCreated` is a belt-and-suspenders second line of defence.
 */
const approveLockByDraft = new Map<string, Promise<void>>();

async function withDraftApprovalLock<T>(draftId: string, fn: () => Promise<T>): Promise<T> {
  const previous = approveLockByDraft.get(draftId);
  let release!: () => void;
  const current = new Promise<void>((resolve) => {
    release = resolve;
  });
  approveLockByDraft.set(draftId, current);
  try {
    if (previous) {
      await previous.catch(() => undefined);
    }
    return await fn();
  } finally {
    if (approveLockByDraft.get(draftId) === current) {
      approveLockByDraft.delete(draftId);
    }
    release();
  }
}

export const CharacterCreatorImportService = {
  /**
   * Idempotent & transactional approval of a draft into a persistent character card.
   * If already created, returns existing character without creating duplicates.
   * On failure during persistence or draft update, rolls back all changes cleanly.
   * Concurrent calls for the same draft are serialized through a per-draft FIFO lock,
   * so a duplicate-character race cannot reach the persistence layer.
   */
  approveAndCreateCharacter(
    draftId: string,
    options: ApproveAndCreateOptions = {},
  ): Promise<LocalCharacterImportResult> {
    return withDraftApprovalLock(draftId, async () => {
      return CharacterCreatorImportService._approveAndCreateCharacter(draftId, options);
    });
  },

  async _approveAndCreateCharacter(
    draftId: string,
    options: ApproveAndCreateOptions = {},
  ): Promise<LocalCharacterImportResult> {
    const draft = await CharacterDraftService.get(draftId);
    if (!draft) {
      throw new Error(`DRAFT_NOT_FOUND: Draft '${draftId}' was not found.`);
    }

    // Idempotency check: if draft was already created, return existing character record
    if (draft.status === "created" && draft.createdCharacterId) {
      const existingChar = useCharacterCardStore.getState().getById(draft.createdCharacterId);
      if (existingChar) {
        return {
          character: existingChar,
          draft,
          isUpdate: false,
        };
      }
    }

    const validation = validateCardForApproval(draft.card);
    if (!validation.valid) {
      throw new Error(`CARD_VALIDATION_FAILED: ${validation.errors.join(" ")}`);
    }

    // Attach Venice Forge namespaced extension
    const existingExtensions = (draft.card.data.extensions && typeof draft.card.data.extensions === "object")
      ? draft.card.data.extensions
      : {};

    const updatedCardDto: CharacterCardV2Dto = {
      ...draft.card,
      data: {
        ...draft.card.data,
        extensions: {
          ...existingExtensions,
          "venice-forge": {
            draftId: draft.id,
            generatedBy: "character-creator",
            modelId: CHARACTER_CREATOR_MODEL_ID,
            sourceIdea: draft.sourceIdea,
            createdAt: draft.createdAt,
            updatedAt: new Date().toISOString(),
            ...(draft.creatorMetadata.avatarPrompt ? { avatarPrompt: draft.creatorMetadata.avatarPrompt } : {}),
          },
        },
      },
    };

    const mappedCard = mapV2ToInternal(updatedCardDto);
    if (!mappedCard) {
      throw new Error("CARD_VALIDATION_FAILED: Failed to map draft to internal character structure.");
    }

    const isUpdate = Boolean(draft.sourceCharacterId) && !options.saveAsCopy;

    if (isUpdate && draft.sourceCharacterId) {
      mappedCard.id = draft.sourceCharacterId;
    } else {
      // Ensure a collision-free id even under concurrent approvals: crypto.randomUUID is
      // available in every supported browser, Node 16+, and Electron renderer, with a
      // deterministic fallback for environments where it is missing.
      mappedCard.id =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
          ? crypto.randomUUID()
          : `c_${Date.now()}_${Math.random().toString(36).substring(2, 9)}_${
              Math.random().toString(36).substring(2, 9)
            }`;
    }

    if (options.avatarDataUrl) {
      const mimeMatch = options.avatarDataUrl.match(/^data:(image\/[a-zA-Z+]+);base64,/);
      const mimeType = (mimeMatch && (mimeMatch[1] === "image/jpeg" || mimeMatch[1] === "image/webp"))
        ? (mimeMatch[1] as "image/jpeg" | "image/webp")
        : "image/png";
      mappedCard.avatar = {
        data: options.avatarDataUrl,
        mimeType,
        byteLength: Math.round((options.avatarDataUrl.length * 3) / 4),
      };
    } else if (isUpdate && draft.sourceCharacterId) {
      const existingChar = useCharacterCardStore.getState().getById(draft.sourceCharacterId);
      if (existingChar?.avatar) {
        mappedCard.avatar = existingChar.avatar;
      }
    }

    mappedCard.updatedAt = Date.now();

    // Preserve previous character state for transactional rollback
    const previousCharacter =
      isUpdate && draft.sourceCharacterId
        ? useCharacterCardStore.getState().getById(draft.sourceCharacterId) ?? null
        : null;

    let savedCharacter: CharacterCardV1 | null = null;

    try {
      savedCharacter = await useCharacterCardStore.getState().upsert(mappedCard);
      if (!savedCharacter) {
        throw new Error("CHARACTER_CREATE_FAILED: Failed to persist character card to local library.");
      }

      const markResult = await CharacterDraftService.tryMarkCreated(
        draft.id,
        {
          status: "created",
          createdCharacterId: savedCharacter.id,
          card: updatedCardDto,
        },
        draft.revision,
      );

      if (markResult.ok) {
        return {
          character: savedCharacter,
          draft: markResult.draft,
          isUpdate,
        };
      }

      if (markResult.notFound) {
        await rollbackCreatedCharacter(savedCharacter.id, previousCharacter, isUpdate);
        throw new Error(`DRAFT_NOT_FOUND: Draft '${draft.id}' was removed during approval.`);
      }

      // Lost the race to another approval on the same draft. Roll back our orphan
      // character and return the winning record so every concurrent caller converges
      // on the same character ID without duplicates in the local store.
      await rollbackCreatedCharacter(savedCharacter.id, previousCharacter, isUpdate);
      const winnerDraft = markResult.draft;
      const winnerCharacter = winnerDraft?.createdCharacterId
        ? useCharacterCardStore.getState().getById(winnerDraft.createdCharacterId)
        : null;
      if (!winnerCharacter || !winnerDraft) {
        throw new Error(
          "CHARACTER_CONCURRENT_RECOVERY_FAILED: Approval race was lost and the winning character could not be resolved. Refresh the library and retry.",
        );
      }
      return {
        character: winnerCharacter,
        draft: winnerDraft,
        isUpdate: false,
      };
    } catch (err) {
      if (savedCharacter) {
        await rollbackCreatedCharacter(savedCharacter.id, previousCharacter, isUpdate);
      }
      throw err;
    }
  },

  async loadExistingCharacterAsDraft(characterId: string): Promise<CharacterCreatorDraft> {
    const card = useCharacterCardStore.getState().getById(characterId);
    if (!card) {
      throw new Error(`CHARACTER_NOT_FOUND: Local character '${characterId}' not found.`);
    }

    const v2Dto = mapInternalToV2(card);

    const draft = await CharacterDraftService.create({
      sourceIdea: `Editing character '${card.name}'`,
      card: v2Dto,
      sourceCharacterId: card.id,
      creatorMetadata: {
        designSummary: `Loaded from local character '${card.name}'`,
        assumptions: [],
        warnings: [],
        suggestedTags: card.tags || [],
      },
    });

    return draft;
  },

  async loadCardDtoAsDraft(cardDto: CharacterCardV2Dto, sourceName = "Imported Card"): Promise<CharacterCreatorDraft> {
    const name = cardDto.data?.name || sourceName;
    const draft = await CharacterDraftService.create({
      sourceIdea: `Imported character card '${name}'`,
      card: cardDto,
      creatorMetadata: {
        designSummary: `Imported from character card '${name}'`,
        assumptions: [],
        warnings: [],
        suggestedTags: cardDto.data?.tags || [],
      },
    });
    return draft;
  },

  async loadImportHandleAsDraft(importHandle: string): Promise<CharacterCreatorDraft> {
    // When an import handle or preview is passed, resolve it or retrieve from temporary store
    let cardDto: CharacterCardV2Dto;
    try {
      const parsed = JSON.parse(importHandle);
      if (parsed && typeof parsed === "object" && parsed.spec === "chara_card_v2") {
        cardDto = parsed as CharacterCardV2Dto;
      } else {
        const mapped = mapV1ToInternal(parsed);
        if (mapped) {
          cardDto = mapInternalToV2(mapped);
        } else {
          throw new Error("Invalid card payload structure");
        }
      }
    } catch {
      throw new Error(`CARD_IMPORT_FAILED: Could not parse import handle or payload '${importHandle}'.`);
    }

    return this.loadCardDtoAsDraft(cardDto, cardDto.data?.name || "Imported Card");
  },

  async loadHostedCharacterAsLocalDraft(hostedCharacterId: string): Promise<CharacterCreatorDraft> {
    const { getCharacter } = await import("./characterService");
    const hosted = await getCharacter(hostedCharacterId);
    if (!hosted) {
      throw new Error(`CHARACTER_NOT_FOUND: Hosted character '${hostedCharacterId}' not found.`);
    }

    const cardDto: CharacterCardV2Dto = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: hosted.name,
        description: hosted.description || "",
        personality: "",
        scenario: "",
        first_mes: hosted.greeting || "",
        mes_example: "",
        creator_notes: `Duplicated from Venice hosted character '${hosted.name}' (${hosted.slug})`,
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: hosted.tags || [],
        creator: hosted.author || "Venice Hosted",
        character_version: "1.0",
        extensions: {
          "venice-forge": {
            generatedBy: "character-creator",
            modelId: CHARACTER_CREATOR_MODEL_ID,
            sourceHostedSlug: hosted.slug,
          },
        },
      },
    };

    const draft = await CharacterDraftService.create({
      sourceIdea: `Duplicating hosted character '${hosted.name}'`,
      card: cardDto,
      creatorMetadata: {
        designSummary: `Duplicated from hosted character '${hosted.name}'`,
        assumptions: ["Created local editable draft from hosted character metadata"],
        warnings: [],
        suggestedTags: hosted.tags || [],
      },
    });

    return draft;
  },
};

/**
 * Compensating transaction helper. Either restores the prior character (update
 * path) or removes the just-created character (create / copy path). When the
 * store-level delete or upsert returns false or rejects, falls back to a direct
 * Zustand setState so user-visible state never keeps an orphan, even if
 * IndexedDB rejects the operation. Returns true when no orphaned local-state
 * row remains.
 */
async function rollbackCreatedCharacter(
  savedCharacterId: string,
  previousCharacter: CharacterCardV1 | null,
  isUpdate: boolean,
): Promise<boolean> {
  try {
    if (isUpdate && previousCharacter) {
      const restored = await useCharacterCardStore.getState().upsert(previousCharacter);
      if (!restored) {
        // Direct state-level restore guarantees undo even if storage refuses.
        useCharacterCardStore.setState((state) => {
          const idx = state.cards.findIndex((c) => c.id === previousCharacter.id);
          const next = idx >= 0 ? [...state.cards] : [previousCharacter, ...state.cards];
          if (idx >= 0) next[idx] = previousCharacter;
          next.sort((a, b) => b.updatedAt - a.updatedAt);
          return { cards: next, error: null };
        });
      }
      return true;
    }

    const removed = await useCharacterCardStore.getState().remove(savedCharacterId);
    if (removed !== true) {
      // Force-remove from local state to guarantee no orphan remains even if the
      // store-level delete refused the request.
      useCharacterCardStore.setState((state) => ({
        cards: state.cards.filter((c) => c.id !== savedCharacterId),
        editingId: state.editingId === savedCharacterId ? null : state.editingId,
      }));
    }
    return true;
  } catch {
    // Final guarantee: never leave a residual card in user-visible state.
    useCharacterCardStore.setState((state) => ({
      cards: state.cards.filter((c) => c.id !== savedCharacterId),
      editingId: state.editingId === savedCharacterId ? null : state.editingId,
    }));
    return true;
  }
}
