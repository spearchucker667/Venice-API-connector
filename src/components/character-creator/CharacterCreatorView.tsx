/**
 * @fileoverview Main top-level Character Creator view orchestrator.
 */

import { useState, useEffect, useRef } from "react";
import type {
  CharacterCreatorDraft,
  CharacterCreatorDraftSummary,
  CharacterCreatorEditableField,
  CharacterCreatorViewState,
  OptionalDraftContext,
} from "../../types/character-creator";
import type { CharacterCardV2Dto } from "../../types/character-card-spec";
import type { CharacterCardV1 } from "../../types/rp";
import { CharacterDraftService } from "../../services/characterCreatorDraftService";
import {
  createCharacterDraftAI,
  regenerateCharacterFieldAI,
  reviseCharacterDraftAI,
} from "../../services/characterCreatorAiService";
import { CharacterCreatorImportService, validateCardForApproval } from "../../services/characterCreatorImportService";
import { startNormalChatForCharacter } from "../../services/rpHelpers";
import { useCharacterCardStore } from "../../stores/character-card-store";
import { useSettingsStore } from "../../stores/settings-store";
import { isElectron, desktopCharacterCreator } from "../../services/desktopBridge";
import { toast } from "../../stores/toast-store";

import { CharacterCreatorWelcome } from "./CharacterCreatorWelcome";
import { CharacterCreatorGenerating } from "./CharacterCreatorGenerating";
import { CharacterCreatorDraftEditor } from "./CharacterCreatorDraftEditor";
import { CharacterCreatorReady } from "./CharacterCreatorReady";
import { CharacterCreatorCompleted } from "./CharacterCreatorCompleted";
import { CharacterCreatorError } from "./CharacterCreatorError";

export function CharacterCreatorView() {
  const [viewState, setViewState] = useState<CharacterCreatorViewState>("welcome");
  const [activeDraft, setActiveDraft] = useState<CharacterCreatorDraft | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<CharacterCreatorDraftSummary[]>([]);
  const [createdCharacter, setCreatedCharacter] = useState<CharacterCardV1 | null>(null);
  const [activeIdea, setActiveIdea] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [validationResults, setValidationResults] = useState<{ valid: boolean; errors: string[]; warnings: string[]; recommendations: string[] }>({
    valid: true,
    errors: [],
    warnings: [],
    recommendations: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);

  const loadRecentDrafts = async () => {
    try {
      const list = await CharacterDraftService.list();
      setRecentDrafts(list.slice(0, 10));
    } catch {
      // Non-critical
    }
  };

  useEffect(() => {
    loadRecentDrafts();
  }, []);

  const handleCreateDraft = async (idea: string, optionalContext?: OptionalDraftContext) => {
    setActiveIdea(idea);
    setViewState("generating");
    setErrorDetails(null);

    abortControllerRef.current = new AbortController();

    try {
      const res = await createCharacterDraftAI(
        {
          operation: "create_draft",
          sourceIdea: idea,
          optionalContext,
        },
        abortControllerRef.current.signal,
      );

      const draft = await CharacterDraftService.create({
        sourceIdea: idea,
        card: res.draft,
        creatorMetadata: {
          inspiration: idea.includes("mimics") ? "User requested archetype inspiration" : undefined,
          designSummary: res.design_summary,
          assumptions: res.assumptions,
          warnings: res.warnings,
          suggestedTags: res.draft.data.tags || [],
          avatarPrompt: (res.draft.data.extensions?.["venice-forge"] as Record<string, unknown>)?.avatarPrompt as string | undefined,
        },
      });

      setActiveDraft(draft);
      setViewState("draft");
      await loadRecentDrafts();
    } catch (err: unknown) {
      if (abortControllerRef.current?.signal.aborted) {
        setViewState("welcome");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetails(msg);
      setViewState("error");
    }
  };

  const handleCancelGeneration = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setViewState("welcome");
  };

  const handleOpenDraft = async (draftId: string) => {
    try {
      const d = await CharacterDraftService.get(draftId);
      if (!d) throw new Error("Draft not found.");
      setActiveDraft(d);
      setViewState("draft");
    } catch (err) {
      toast.error("Could not load draft", String(err));
    }
  };

  const handleUpdateDraftCard = async (updatedCard: CharacterCardV2Dto) => {
    if (!activeDraft) return;
    const nextDraft = {
      ...activeDraft,
      card: updatedCard,
      updatedAt: new Date().toISOString(),
    };
    setActiveDraft(nextDraft);
    // Debounced autosave
    try {
      await CharacterDraftService.update(activeDraft.id, { card: updatedCard });
    } catch {
      // Ignore autosave errors
    }
  };

  const handleSaveDraft = async () => {
    if (!activeDraft) return;
    try {
      await CharacterDraftService.update(activeDraft.id, { card: activeDraft.card });
      toast.success("Draft saved locally");
      await loadRecentDrafts();
    } catch (err) {
      toast.error("Could not save draft", String(err));
    }
  };

  const handleReviseDraft = async (instruction: string) => {
    if (!activeDraft) return;
    setViewState("revising");
    setErrorDetails(null);
    abortControllerRef.current = new AbortController();

    try {
      const res = await reviseCharacterDraftAI(
        {
          operation: "revise_draft",
          instruction,
          currentDraft: activeDraft.card,
          revision: activeDraft.revision + 1,
        },
        abortControllerRef.current.signal,
      );

      const updated = await CharacterDraftService.update(activeDraft.id, {
        card: res.draft,
        revision: activeDraft.revision + 1,
        creatorMetadata: {
          designSummary: res.design_summary,
          assumptions: res.assumptions,
          warnings: res.warnings,
          suggestedTags: res.draft.data.tags || [],
        },
      });

      setActiveDraft(updated);
      setViewState("draft");
      toast.success("Draft revised");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetails(msg);
      setViewState("error");
    }
  };

  const handleRegenerateField = async (field: CharacterCreatorEditableField, instruction?: string) => {
    if (!activeDraft) return;
    setViewState("revising");
    setErrorDetails(null);
    abortControllerRef.current = new AbortController();

    try {
      const res = await regenerateCharacterFieldAI(
        {
          operation: "regenerate_field",
          field,
          instruction,
          currentDraft: activeDraft.card,
          revision: activeDraft.revision + 1,
        },
        abortControllerRef.current.signal,
      );

      const updated = await CharacterDraftService.update(activeDraft.id, {
        card: res.draft,
        revision: activeDraft.revision + 1,
      });

      setActiveDraft(updated);
      setViewState("draft");
      toast.success(`Field '${field}' regenerated`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetails(msg);
      setViewState("error");
    }
  };

  const handleValidateDraft = () => {
    if (!activeDraft) return;
    const localVal = validateCardForApproval(activeDraft.card);
    setValidationResults({
      valid: localVal.valid,
      errors: localVal.errors,
      warnings: localVal.warnings,
      recommendations: [],
    });
    setViewState("ready");
  };

  const handleApproveAndCreate = async (startChatImmediately = false, saveAsCopy = false) => {
    if (!activeDraft) return;
    setViewState("saving");
    try {
      const result = await CharacterCreatorImportService.approveAndCreateCharacter(activeDraft.id, {
        saveAsCopy,
        avatarDataUrl,
      });

      setCreatedCharacter(result.character);
      setActiveDraft(result.draft);
      setViewState("completed");
      toast.success(
        result.isUpdate ? "Character updated!" : "Character created!",
        `"${result.character.name}" saved to local library.`,
      );

      if (startChatImmediately) {
        startNormalChatForCharacter(result.character.id);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetails(msg);
      setViewState("error");
    }
  };

  const handleExportCard = async () => {
    if (!activeDraft) return;
    if (isElectron()) {
      try {
        const res = await desktopCharacterCreator.exportCard({
          card: activeDraft.card,
          format: avatarDataUrl ? "png" : "json",
          avatarDataUrl,
        });
        if (res.ok && !res.canceled) {
          toast.success("Character Card exported", res.filename);
        }
      } catch (err) {
        toast.error("Export failed", String(err));
      }
    } else {
      // Browser JSON download fallback
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(activeDraft.card, null, 2));
      const downloadAnchor = document.createElement("a");
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `${activeDraft.card.data.name || "character"}-v2.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      toast.success("Exported Character Card JSON");
    }
  };

  const handleEditLocalCharacter = async () => {
    const cards = useCharacterCardStore.getState().cards;
    if (cards.length === 0) {
      toast.error("No local characters available to edit");
      return;
    }
    try {
      const draft = await CharacterCreatorImportService.loadExistingCharacterAsDraft(cards[0].id);
      setActiveDraft(draft);
      setViewState("draft");
    } catch (err) {
      toast.error("Could not load character", String(err));
    }
  };

  return (
    <div className="h-full w-full flex flex-col bg-background text-text-primary overflow-hidden">
      {viewState === "welcome" && (
        <CharacterCreatorWelcome
          onCreateDraft={handleCreateDraft}
          onOpenDraft={handleOpenDraft}
          onImportCard={() => {
            useSettingsStore.getState().setActiveTab("characters");
          }}
          onEditLocalCharacter={handleEditLocalCharacter}
          recentDrafts={recentDrafts}
        />
      )}

      {viewState === "generating" && (
        <CharacterCreatorGenerating
          onCancel={handleCancelGeneration}
          idea={activeIdea}
        />
      )}

      {(viewState === "draft" || viewState === "revising") && activeDraft && (
        <CharacterCreatorDraftEditor
          draft={activeDraft}
          onUpdateDraft={handleUpdateDraftCard}
          onSaveDraft={handleSaveDraft}
          onValidateDraft={handleValidateDraft}
          onApproveAndCreate={() => handleValidateDraft()}
          onReviseDraft={handleReviseDraft}
          onRegenerateField={handleRegenerateField}
          onSelectAvatarImage={(dataUrl) => setAvatarDataUrl(dataUrl)}
          avatarDataUrl={avatarDataUrl}
          isRevising={viewState === "revising"}
        />
      )}

      {viewState === "ready" && activeDraft && (
        <CharacterCreatorReady
          draft={activeDraft}
          validationResults={validationResults}
          onApproveAndCreate={handleApproveAndCreate}
          onReturnToDraft={() => setViewState("draft")}
        />
      )}

      {viewState === "saving" && (
        <div className="flex flex-col items-center justify-center h-full p-6">
          <div className="w-12 h-12 rounded-full border-2 border-accent border-t-transparent animate-spin mb-4" />
          <p className="text-sm font-semibold text-text-primary">Saving Character to Local Library...</p>
        </div>
      )}

      {viewState === "completed" && createdCharacter && (
        <CharacterCreatorCompleted
          character={createdCharacter}
          onStartChat={() => startNormalChatForCharacter(createdCharacter.id)}
          onViewCharacter={() => {
            useCharacterCardStore.getState().setEditing(createdCharacter.id);
            useSettingsStore.getState().setActiveTab("rp-studio");
          }}
          onContinueEditing={() => setViewState("draft")}
          onExportCard={handleExportCard}
          onCreateAnother={() => {
            setActiveDraft(null);
            setCreatedCharacter(null);
            setViewState("welcome");
          }}
        />
      )}

      {viewState === "error" && (
        <CharacterCreatorError
          error={errorDetails || "An unexpected error occurred."}
          onRetry={() => {
            if (activeDraft) {
              setViewState("draft");
            } else {
              setViewState("welcome");
            }
          }}
          onReturnToDraft={() => setViewState("draft")}
          hasDraftWork={Boolean(activeDraft)}
        />
      )}
    </div>
  );
}
