/**
 * @fileoverview Character Creator data models and structured API interfaces.
 */

import { CHARACTER_CREATOR_MODEL_ID } from "../constants/character-creator";
import type { CharacterCardV2Dto } from "./character-card-spec";

export type CharacterCreatorViewState =
  | "welcome"
  | "generating"
  | "draft"
  | "revising"
  | "validating"
  | "ready"
  | "saving"
  | "completed"
  | "error";

export type CharacterDraftStatus =
  | "draft"
  | "ready"
  | "created"
  | "archived";

export type CharacterCreatorOperation =
  | "create_draft"
  | "revise_draft"
  | "regenerate_field"
  | "validate_draft";

export type CharacterCreatorEditableField =
  | "name"
  | "description"
  | "personality"
  | "scenario"
  | "first_mes"
  | "mes_example"
  | "creator_notes"
  | "system_prompt"
  | "post_history_instructions"
  | "alternate_greetings"
  | "tags"
  | "creator"
  | "character_version"
  | "avatar_prompt";

export interface CharacterCreatorMajorDecision {
  area: "identity" | "personality" | "scenario" | "greeting" | "dialogue" | "prompting" | "lore";
  summary: string;
}

export interface CharacterCreatorProcessSummary {
  concept_interpretation: string;
  design_direction: string;
  originality_strategy: string[];
  major_decisions: CharacterCreatorMajorDecision[];
}

export type CharacterCreatorProcessPhase =
  | "queued"
  | "concept-analysis"
  | "design-brief"
  | "card-draft"
  | "consistency-review"
  | "schema-validation"
  | "repair"
  | "draft-persistence"
  | "complete"
  | "failed"
  | "cancelled";

export type CharacterCreatorProcessStatus =
  | "pending"
  | "active"
  | "complete"
  | "warning"
  | "failed";

export interface CharacterCreatorProcessEvent {
  id: string;
  phase: CharacterCreatorProcessPhase;
  status: CharacterCreatorProcessStatus;
  title: string;
  summary: string;
  details?: string[];
  source: "application" | "model-summary" | "validator";
  createdAt: string;
  completedAt?: string;
}

export interface CharacterConceptAnalysis {
  normalizedConcept: string;
  intendedMode: "original" | "inspired-original" | "direct-existing" | "parody" | "alternate";
  coreTraits: string[];
  settingDirection: string;
  relationshipDirection: string;
  toneDirection: string;
  originalityPlan: string[];
  assumptions: string[];
  warnings: string[];
  userVisibleSummary: string;
}

export interface CharacterCreatorDraftSummary {
  id: string;
  name: string;
  sourceIdea: string;
  status: CharacterDraftStatus;
  revision: number;
  updatedAt: string;
  sourceCharacterId?: string;
  createdCharacterId?: string;
}

export const CHARACTER_CREATOR_DRAFT_SCHEMA_VERSION = 1;

export interface CharacterCreatorDraft {
  id: string;
  schemaVersion: number;
  profileId?: string;
  status: CharacterDraftStatus;

  sourceIdea: string;
  sourceCharacterId?: string;
  createdCharacterId?: string;

  modelId: typeof CHARACTER_CREATOR_MODEL_ID;

  card: CharacterCardV2Dto;

  conceptAnalysis?: CharacterConceptAnalysis;
  processTrace?: CharacterCreatorProcessEvent[];

  creatorMetadata: {
    inspiration?: string;
    designSummary: string;
    assumptions: string[];
    warnings: string[];
    suggestedTags: string[];
    avatarPrompt?: string;
    processSummary?: CharacterCreatorProcessSummary;
  };

  fieldHistory?: Record<string, string[]>;

  revision: number;
  createdAt: string;
  updatedAt: string;
  lastValidatedAt?: string;
}

export interface OptionalDraftContext {
  setting?: string;
  tone?: string;
  relationship?: string;
  purpose?: string;
  contentRating?: string;
  constraints?: string[];
}

export interface CreateCharacterDraftRequest {
  operation: "create_draft";
  sourceIdea: string;
  optionalContext?: OptionalDraftContext;
}

export interface ReviseCharacterDraftRequest {
  operation: "revise_draft";
  instruction: string;
  currentDraft: CharacterCardV2Dto;
  revision: number;
}

export interface RegenerateCharacterFieldRequest {
  operation: "regenerate_field";
  field: CharacterCreatorEditableField;
  instruction?: string;
  currentDraft: CharacterCardV2Dto;
  revision: number;
}

export interface ValidateCharacterDraftRequest {
  operation: "validate_draft";
  currentDraft: CharacterCardV2Dto;
  revision: number;
}

export type CharacterCreatorRequestInput =
  | CreateCharacterDraftRequest
  | ReviseCharacterDraftRequest
  | RegenerateCharacterFieldRequest
  | ValidateCharacterDraftRequest;

export interface CharacterCreatorResponseValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  recommendations: string[];
}

export interface CharacterCreatorResponse {
  operation: CharacterCreatorOperation;
  process_summary?: CharacterCreatorProcessSummary;
  design_summary: string;
  assumptions: string[];
  warnings: string[];
  draft: CharacterCardV2Dto;
  validation: CharacterCreatorResponseValidation;
}

export interface CharacterCreatorGenerationResult {
  analysis: CharacterConceptAnalysis;
  response: CharacterCreatorResponse;
  processEvents: CharacterCreatorProcessEvent[];
}
