/**
 * @fileoverview AI Service for Character Creator powered strictly by zai-org-glm-5-2.
 */

import { CHARACTER_CREATOR_MODEL_ID, CHARACTER_CREATOR_SYSTEM_PROMPT, CharacterCreatorModelOverrideError } from "../constants/character-creator";
import type {
  CharacterCreatorOperation,
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

  // Sanitize and guarantee extensions format
  const extensions = (cardData.extensions && typeof cardData.extensions === "object" && !Array.isArray(cardData.extensions))
    ? (cardData.extensions as Record<string, unknown>)
    : {};

  const cleanDraft: CharacterCardV2Dto = {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: String(cardData.name || "").slice(0, 200),
      description: String(cardData.description || "").slice(0, 50_000),
      personality: String(cardData.personality || "").slice(0, 50_000),
      scenario: String(cardData.scenario || "").slice(0, 50_000),
      first_mes: String(cardData.first_mes || "").slice(0, 50_000),
      mes_example: String(cardData.mes_example || "").slice(0, 50_000),
      creator_notes: String(cardData.creator_notes || "").slice(0, 50_000),
      system_prompt: String(cardData.system_prompt || "").slice(0, 50_000),
      post_history_instructions: String(cardData.post_history_instructions || "").slice(0, 50_000),
      alternate_greetings: Array.isArray(cardData.alternate_greetings)
        ? cardData.alternate_greetings.filter((g): g is string => typeof g === "string").map((g) => g.slice(0, 50_000))
        : [],
      tags: Array.isArray(cardData.tags)
        ? cardData.tags.filter((t): t is string => typeof t === "string").map((t) => t.slice(0, 64))
        : [],
      creator: String(cardData.creator || "Venice Forge Character Creator").slice(0, 200),
      character_version: String(cardData.character_version || "1.0").slice(0, 64),
      extensions: extensions as JsonObject,
    },
  };

  return {
    operation: raw.operation as CharacterCreatorOperation,
    design_summary: String(raw.design_summary),
    assumptions: raw.assumptions as string[],
    warnings: raw.warnings as string[],
    draft: cleanDraft,
    validation: {
      valid: Boolean(val.valid),
      errors: val.errors as string[],
      warnings: val.warnings as string[],
      recommendations: val.recommendations as string[],
    },
  };
}

async function executeWithSingleRepair(
  requestInput: CharacterCreatorRequestInput,
  signal?: AbortSignal,
): Promise<CharacterCreatorResponse> {
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
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("404") || msg.includes("not_found") || msg.includes("model_not_found") || msg.includes("Model")) {
      throw new Error(`MODEL_UNAVAILABLE: Model '${CHARACTER_CREATOR_MODEL_ID}' is currently unavailable on Venice API.`);
    }
    throw err;
  }

  const content = extractContent(responseData);
  if (!content) {
    throw new Error("INVALID_MODEL_RESPONSE: Model returned an empty completion.");
  }

  if (isPromptSecretLike(content)) {
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

  if (validated) {
    return validated;
  }

  // Attempt exactly one schema-repair request
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
    throw new Error("SCHEMA_REPAIR_FAILED: Character Creator output failed JSON schema validation after repair attempt.");
  }

  return validated;
}

export async function createCharacterDraftAI(
  request: CreateCharacterDraftRequest,
  signal?: AbortSignal,
): Promise<CharacterCreatorResponse> {
  return executeWithSingleRepair(request, signal);
}

export async function reviseCharacterDraftAI(
  request: ReviseCharacterDraftRequest,
  signal?: AbortSignal,
): Promise<CharacterCreatorResponse> {
  return executeWithSingleRepair(request, signal);
}

export async function regenerateCharacterFieldAI(
  request: RegenerateCharacterFieldRequest,
  signal?: AbortSignal,
): Promise<CharacterCreatorResponse> {
  return executeWithSingleRepair(request, signal);
}

export async function validateCharacterDraftAI(
  request: ValidateCharacterDraftRequest,
  signal?: AbortSignal,
): Promise<CharacterCreatorResponse> {
  return executeWithSingleRepair(request, signal);
}
