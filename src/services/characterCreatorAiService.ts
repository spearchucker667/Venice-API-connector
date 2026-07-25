/**
 * @fileoverview AI Service for Character Creator powered strictly by zai-org-glm-5-2.
 * Emits real event-driven process updates for transparent user-visible design decisions.
 */

import { CHARACTER_CREATOR_MODEL_ID, CHARACTER_CREATOR_SYSTEM_PROMPT, CharacterCreatorModelOverrideError } from "../constants/character-creator";
import type {
  CharacterConceptAnalysis,
  CharacterCreatorGenerationResult,
  CharacterCreatorMajorDecision,
  CharacterCreatorOperation,
  CharacterCreatorProcessEvent,
  CharacterCreatorProcessSummary,
  CharacterCreatorRequestInput,
  CharacterCreatorResponse,
  CreateCharacterDraftRequest,
  RegenerateCharacterFieldRequest,
  ReviseCharacterDraftRequest,
  ValidateCharacterDraftRequest,
} from "../types/character-creator";
import type { CharacterCardV2Dto, JsonObject } from "../types/character-card-spec";
import { veniceFetch } from "./veniceClient/fetch";
import { isPromptSecretLike } from "../types/prompt-library";

export interface CharacterCreatorGenerationCallbacks {
  onEvent?: (event: CharacterCreatorProcessEvent) => void;
}

/** Construct the Venice chat completion request for Character Creator.
 *  Enforces the immutable model zai-org-glm-5-2 at request build time. */
export function buildCharacterCreatorRequest(
  input: CharacterCreatorRequestInput & { model?: string },
): { model: typeof CHARACTER_CREATOR_MODEL_ID; messages: Array<{ role: "system" | "user"; content: string }>; temperature: number } {
  if (input.model !== undefined && input.model !== CHARACTER_CREATOR_MODEL_ID) {
    throw new CharacterCreatorModelOverrideError();
  }

  const userContent = JSON.stringify(input);

  return {
    model: CHARACTER_CREATOR_MODEL_ID,
    messages: [
      { role: "system", content: CHARACTER_CREATOR_SYSTEM_PROMPT },
      { role: "user", content: userContent },
    ],
    temperature: input.operation === "validate_draft" ? 0.2 : 0.7,
  };
}

function extractContent(response: unknown): string {
  if (!response || typeof response !== "object") return "";
  const choices = (response as Record<string, unknown>).choices;
  if (!Array.isArray(choices) || !choices[0] || typeof choices[0] !== "object") return "";
  const message = (choices[0] as Record<string, unknown>).message;
  if (!message || typeof message !== "object") return "";
  const content = (message as Record<string, unknown>).content;
  return typeof content === "string" ? content.trim() : "";
}

function cleanJsonCodeFence(raw: string): string {
  let cleaned = raw.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/, "").replace(/\s*```$/, "");
  }
  return cleaned.trim();
}

function sanitizeText(str: unknown, max = 50_000): string {
  if (typeof str !== "string") return "";
  return str.slice(0, max);
}

export function validateCharacterCreatorResponse(data: unknown): CharacterCreatorResponse | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  const raw = data as Record<string, unknown>;

  const validOperations: CharacterCreatorOperation[] = ["create_draft", "revise_draft", "regenerate_field", "validate_draft"];
  if (typeof raw.operation !== "string" || !validOperations.includes(raw.operation as CharacterCreatorOperation)) {
    return null;
  }

  if (typeof raw.design_summary !== "string") return null;
  if (!Array.isArray(raw.assumptions) || !raw.assumptions.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(raw.warnings) || !raw.warnings.every((item) => typeof item === "string")) return null;

  if (!raw.draft || typeof raw.draft !== "object" || Array.isArray(raw.draft)) return null;
  const draft = raw.draft as Record<string, unknown>;
  if (draft.spec !== "chara_card_v2" || draft.spec_version !== "2.0" || !draft.data || typeof draft.data !== "object" || Array.isArray(draft.data)) {
    return null;
  }

  const cardData = draft.data as Record<string, unknown>;
  if (typeof cardData.name !== "string" || typeof cardData.description !== "string") return null;
  if (typeof cardData.personality !== "string" || typeof cardData.scenario !== "string") return null;
  if (typeof cardData.first_mes !== "string" || typeof cardData.mes_example !== "string") return null;

  if (!raw.validation || typeof raw.validation !== "object" || Array.isArray(raw.validation)) return null;
  const val = raw.validation as Record<string, unknown>;
  if (typeof val.valid !== "boolean") return null;
  if (!Array.isArray(val.errors) || !val.errors.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(val.warnings) || !val.warnings.every((item) => typeof item === "string")) return null;
  if (!Array.isArray(val.recommendations) || !val.recommendations.every((item) => typeof item === "string")) return null;

  // Process Summary extraction & sanitization
  let process_summary: CharacterCreatorProcessSummary | undefined;
  if (raw.process_summary && typeof raw.process_summary === "object" && !Array.isArray(raw.process_summary)) {
    const ps = raw.process_summary as Record<string, unknown>;
    process_summary = {
      concept_interpretation: sanitizeText(ps.concept_interpretation, 1000),
      design_direction: sanitizeText(ps.design_direction, 1000),
      originality_strategy: Array.isArray(ps.originality_strategy)
        ? ps.originality_strategy.filter((s): s is string => typeof s === "string").map((s) => sanitizeText(s, 500))
        : [],
      major_decisions: Array.isArray(ps.major_decisions)
        ? ps.major_decisions
            .filter((d): d is Record<string, unknown> => Boolean(d && typeof d === "object"))
            .map((d) => ({
              area: (["identity", "personality", "scenario", "greeting", "dialogue", "prompting", "lore"].includes(String(d.area))
                ? String(d.area)
                : "identity") as CharacterCreatorMajorDecision["area"],
              summary: sanitizeText(d.summary, 500),
            }))
        : [],
    };
  }

  // Sanitize and guarantee extensions format
  const extensions = (cardData.extensions && typeof cardData.extensions === "object" && !Array.isArray(cardData.extensions))
    ? (cardData.extensions as Record<string, unknown>)
    : {};

  const cleanDraft: CharacterCardV2Dto = {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: sanitizeText(cardData.name, 200),
      description: sanitizeText(cardData.description),
      personality: sanitizeText(cardData.personality),
      scenario: sanitizeText(cardData.scenario),
      first_mes: sanitizeText(cardData.first_mes),
      mes_example: sanitizeText(cardData.mes_example),
      creator_notes: sanitizeText(cardData.creator_notes),
      system_prompt: sanitizeText(cardData.system_prompt),
      post_history_instructions: sanitizeText(cardData.post_history_instructions),
      alternate_greetings: Array.isArray(cardData.alternate_greetings)
        ? cardData.alternate_greetings.filter((g): g is string => typeof g === "string").map((g) => sanitizeText(g))
        : [],
      tags: Array.isArray(cardData.tags)
        ? cardData.tags.filter((t): t is string => typeof t === "string").map((t) => sanitizeText(t, 64))
        : [],
      creator: sanitizeText(cardData.creator || "Venice Forge Character Creator", 200),
      character_version: sanitizeText(cardData.character_version || "1.0", 64),
      extensions: extensions as JsonObject,
    },
  };

  return {
    operation: raw.operation as CharacterCreatorOperation,
    process_summary,
    design_summary: sanitizeText(raw.design_summary, 2000),
    assumptions: (raw.assumptions as string[]).map((s) => sanitizeText(s, 500)),
    warnings: (raw.warnings as string[]).map((s) => sanitizeText(s, 500)),
    draft: cleanDraft,
    validation: {
      valid: Boolean(val.valid),
      errors: (val.errors as string[]).map((s) => sanitizeText(s, 500)),
      warnings: (val.warnings as string[]).map((s) => sanitizeText(s, 500)),
      recommendations: (val.recommendations as string[]).map((s) => sanitizeText(s, 500)),
    },
  };
}

function createProcessEvent(
  phase: CharacterCreatorProcessEvent["phase"],
  status: CharacterCreatorProcessEvent["status"],
  title: string,
  summary: string,
  details?: string[],
  source: CharacterCreatorProcessEvent["source"] = "application",
): CharacterCreatorProcessEvent {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
    phase,
    status,
    title: title.slice(0, 120),
    summary: summary.slice(0, 1000),
    details: details?.slice(0, 12).map((d) => d.slice(0, 500)),
    source,
    createdAt: new Date().toISOString(),
    completedAt: status === "complete" || status === "failed" || status === "warning" ? new Date().toISOString() : undefined,
  };
}

async function executeWithSingleRepair(
  requestInput: CharacterCreatorRequestInput,
  callbacks?: CharacterCreatorGenerationCallbacks,
  signal?: AbortSignal,
): Promise<{ response: CharacterCreatorResponse; processEvents: CharacterCreatorProcessEvent[] }> {
  const processEvents: CharacterCreatorProcessEvent[] = [];

  const emit = (event: CharacterCreatorProcessEvent) => {
    processEvents.push(event);
    if (callbacks?.onEvent) {
      callbacks.onEvent(event);
    }
  };

  emit(
    createProcessEvent(
      "queued",
      "complete",
      "Generation task queued",
      `Target model: ${CHARACTER_CREATOR_MODEL_ID}`,
      ["Model: zai-org-glm-5-2", "Transport: veniceFetch"],
    ),
  );

  const conceptEvent = createProcessEvent(
    "concept-analysis",
    "active",
    "Analyzing concept and requirements",
    requestInput.operation === "create_draft"
      ? `Processing source idea: "${requestInput.sourceIdea.slice(0, 100)}..."`
      : `Executing ${requestInput.operation} operation`,
  );
  emit(conceptEvent);

  const reqPayload = buildCharacterCreatorRequest(requestInput);

  let responseData: unknown;
  try {
    const fetchResult = await veniceFetch("/chat/completions", {
      method: "POST",
      signal,
      body: reqPayload,
    });
    responseData = fetchResult.data;
  } catch (err: unknown) {
    if (signal?.aborted) {
      const cancelEv = createProcessEvent("cancelled", "failed", "Request cancelled", "Generation was cancelled by the user.");
      emit(cancelEv);
      throw new Error("REQUEST_CANCELLED: User cancelled generation.");
    }
    const msg = err instanceof Error ? err.message : String(err);
    const failEv = createProcessEvent("failed", "failed", "Model request failed", msg);
    emit(failEv);
    if (msg.includes("404") || msg.includes("not_found") || msg.includes("model_not_found") || msg.includes("Model")) {
      throw new Error(`MODEL_UNAVAILABLE: Model '${CHARACTER_CREATOR_MODEL_ID}' is currently unavailable on Venice API.`);
    }
    throw err;
  }

  const content = extractContent(responseData);
  if (!content) {
    const failEv = createProcessEvent("failed", "failed", "Empty response", "Model returned an empty completion.");
    emit(failEv);
    throw new Error("INVALID_MODEL_RESPONSE: Model returned an empty completion.");
  }

  if (isPromptSecretLike(content)) {
    const failEv = createProcessEvent("failed", "failed", "Output security check failed", "Response contained secret-like data.");
    emit(failEv);
    throw new Error("INVALID_MODEL_RESPONSE: Model output contained secret-like data.");
  }

  const cleanedText = cleanJsonCodeFence(content);
  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(cleanedText);
  } catch {
    parsedJson = null;
  }

  let validated = parsedJson ? validateCharacterCreatorResponse(parsedJson) : null;

  if (!validated) {
    // Attempt exactly one schema-repair request
    const repairEv = createProcessEvent(
      "repair",
      "active",
      "Attempting schema repair",
      "Initial response did not strictly match Character Card V2 JSON schema. Requesting correction.",
    );
    emit(repairEv);

    const repairPrompt = {
      role: "user" as const,
      content: JSON.stringify({
        instruction: "The previous output was malformed or failed schema validation. Correct it to valid JSON matching the exact required output schema.",
        invalidOutput: content.slice(0, 10_000),
        validationRules: "Return valid JSON matching the exact required CharacterCreatorResponse schema.",
      }),
    };

    const repairRequest = {
      model: CHARACTER_CREATOR_MODEL_ID,
      messages: [
        { role: "system" as const, content: CHARACTER_CREATOR_SYSTEM_PROMPT },
        repairPrompt,
      ],
      temperature: 0.2,
    };

    let repairData: unknown;
    try {
      const repairFetchResult = await veniceFetch("/chat/completions", {
        method: "POST",
        signal,
        body: repairRequest,
      });
      repairData = repairFetchResult.data;
    } catch (err: unknown) {
      const failEv = createProcessEvent("failed", "failed", "Schema repair failed", err instanceof Error ? err.message : String(err));
      emit(failEv);
      throw new Error(`SCHEMA_REPAIR_FAILED: Repair request failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    const repairContent = extractContent(repairData);
    const cleanRepairText = cleanJsonCodeFence(repairContent);

    try {
      const repairParsed = JSON.parse(cleanRepairText);
      validated = validateCharacterCreatorResponse(repairParsed);
    } catch {
      validated = null;
    }

    if (!validated) {
      const failEv = createProcessEvent("failed", "failed", "Schema validation failed", "Output failed schema validation after repair attempt.");
      emit(failEv);
      throw new Error("SCHEMA_REPAIR_FAILED: Character Creator output failed JSON schema validation after repair attempt.");
    }

    emit(createProcessEvent("repair", "complete", "Schema repair successful", "Card draft successfully restored to valid schema format."));
  }

  // Concept analysis completed event
  emit(
    createProcessEvent(
      "concept-analysis",
      "complete",
      "Concept analysis complete",
      validated.process_summary?.concept_interpretation || validated.design_summary || "Character design concept established.",
      validated.assumptions.length > 0 ? validated.assumptions : undefined,
      "model-summary",
    ),
  );

  // Card draft construction event
  const populatedFields: string[] = [];
  if (validated.draft.data.name) populatedFields.push(`Name: "${validated.draft.data.name}"`);
  if (validated.draft.data.description) populatedFields.push(`Description (${validated.draft.data.description.length} chars)`);
  if (validated.draft.data.personality) populatedFields.push(`Personality (${validated.draft.data.personality.length} chars)`);
  if (validated.draft.data.scenario) populatedFields.push(`Scenario (${validated.draft.data.scenario.length} chars)`);
  if (validated.draft.data.first_mes) populatedFields.push(`First Message (${validated.draft.data.first_mes.length} chars)`);
  if (validated.draft.data.tags?.length) populatedFields.push(`Tags: ${validated.draft.data.tags.join(", ")}`);

  emit(
    createProcessEvent(
      "card-draft",
      "complete",
      "Character card draft constructed",
      `Draft "${validated.draft.data.name}" created with all required fields.`,
      populatedFields,
      "application",
    ),
  );

  // Validation / consistency event
  emit(
    createProcessEvent(
      "consistency-review",
      validated.validation.valid ? "complete" : "warning",
      "Schema and consistency review",
      validated.validation.valid
        ? "Draft passed all structural and macro consistency checks."
        : `Validation warnings detected: ${validated.validation.warnings.join("; ")}`,
      validated.validation.warnings.length > 0 ? validated.validation.warnings : undefined,
      "validator",
    ),
  );

  emit(
    createProcessEvent(
      "complete",
      "complete",
      "Generation complete",
      `Character draft for "${validated.draft.data.name}" is ready for review.`,
    ),
  );

  return { response: validated, processEvents };
}

export async function generateCharacterCreatorDraft(
  request: CreateCharacterDraftRequest,
  callbacks?: CharacterCreatorGenerationCallbacks,
  signal?: AbortSignal,
): Promise<CharacterCreatorGenerationResult> {
  const { response, processEvents } = await executeWithSingleRepair(request, callbacks, signal);

  const conceptAnalysis: CharacterConceptAnalysis = {
    normalizedConcept: request.sourceIdea,
    intendedMode: "original",
    coreTraits: response.draft.data.tags || [],
    settingDirection: request.optionalContext?.setting || "Original Setting",
    relationshipDirection: request.optionalContext?.relationship || "Flexible User Interaction",
    toneDirection: request.optionalContext?.tone || "Neutral",
    originalityPlan: response.process_summary?.originality_strategy || ["Original Character Design"],
    assumptions: response.assumptions,
    warnings: response.warnings,
    userVisibleSummary: response.process_summary?.concept_interpretation || response.design_summary,
  };

  return {
    analysis: conceptAnalysis,
    response,
    processEvents,
  };
}

export async function createCharacterDraftAI(
  request: CreateCharacterDraftRequest,
  signal?: AbortSignal,
  callbacks?: CharacterCreatorGenerationCallbacks,
): Promise<CharacterCreatorResponse> {
  const result = await executeWithSingleRepair(request, callbacks, signal);
  return result.response;
}

export async function reviseCharacterDraftAI(
  request: ReviseCharacterDraftRequest,
  signal?: AbortSignal,
  callbacks?: CharacterCreatorGenerationCallbacks,
): Promise<CharacterCreatorResponse> {
  const result = await executeWithSingleRepair(request, callbacks, signal);
  return result.response;
}

export async function regenerateCharacterFieldAI(
  request: RegenerateCharacterFieldRequest,
  signal?: AbortSignal,
  callbacks?: CharacterCreatorGenerationCallbacks,
): Promise<CharacterCreatorResponse> {
  const result = await executeWithSingleRepair(request, callbacks, signal);
  return result.response;
}

export async function validateCharacterDraftAI(
  request: ValidateCharacterDraftRequest,
  signal?: AbortSignal,
  callbacks?: CharacterCreatorGenerationCallbacks,
): Promise<CharacterCreatorResponse> {
  const result = await executeWithSingleRepair(request, callbacks, signal);
  return result.response;
}
