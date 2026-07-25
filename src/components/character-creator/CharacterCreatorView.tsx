/**
 * @fileoverview Main top-level Character Creator view orchestrator.
 * Handles transient launch intents, event-driven AI generation, debounced autosave,
 * local character picking, card import, and atomic approval into the character library.
 */

import { useState, useEffect, useRef } from "react";
import type {
  CharacterCreatorDraft,
  CharacterCreatorDraftSummary,
  CharacterCreatorEditableField,
  CharacterCreatorProcessEvent,
  CharacterCreatorViewState,
  OptionalDraftContext,
} from "../../types/character-creator";
import type { CharacterCardV2Dto } from "../../types/character-card-spec";
import type { CharacterCardV1 } from "../../types/rp";
import { CharacterDraftService } from "../../services/characterCreatorDraftService";
import {
  generateCharacterCreatorDraft,
  regenerateCharacterFieldAI,
  reviseCharacterDraftAI,
} from "../../services/characterCreatorAiService";
import { CharacterCreatorImportService, validateCardForApproval } from "../../services/characterCreatorImportService";
import { startNormalChatForCharacter } from "../../services/rpHelpers";
import { useCharacterCardStore } from "../../stores/character-card-store";
import { useSettingsStore } from "../../stores/settings-store";
import { useCharacterCreatorLaunchStore } from "../../stores/character-creator-launch-store";
import { isElectron, desktopCharacterCreator, desktopCharacterCards } from "../../services/desktopBridge";
import { toast } from "../../stores/toast-store";

import { CharacterCreatorWelcome } from "./CharacterCreatorWelcome";
import { CharacterCreatorGenerating } from "./CharacterCreatorGenerating";
import { CharacterCreatorDraftEditor } from "./CharacterCreatorDraftEditor";
import { CharacterCreatorReady } from "./CharacterCreatorReady";
import { CharacterCreatorCompleted } from "./CharacterCreatorCompleted";
import { CharacterCreatorError } from "./CharacterCreatorError";
import { CharacterCreatorLocalPickerModal } from "./CharacterCreatorLocalPickerModal";

export function CharacterCreatorView() {
  const activeTab = useSettingsStore((s) => s.activeTab);
  const [viewState, setViewState] = useState<CharacterCreatorViewState>("welcome");
  const [activeDraft, setActiveDraft] = useState<CharacterCreatorDraft | null>(null);
  const [recentDrafts, setRecentDrafts] = useState<CharacterCreatorDraftSummary[]>([]);
  const [createdCharacter, setCreatedCharacter] = useState<CharacterCardV1 | null>(null);
  const [activeIdea, setActiveIdea] = useState("");
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | undefined>(undefined);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);
  const [processEvents, setProcessEvents] = useState<CharacterCreatorProcessEvent[]>([]);
  const [showLocalPicker, setShowLocalPicker] = useState(false);
  const [validationResults, setValidationResults] = useState<{ valid: boolean; errors: string[]; warnings: string[]; recommendations: string[] }>({
    valid: true,
    errors: [],
    warnings: [],
    recommendations: [],
  });

  const abortControllerRef = useRef<AbortController | null>(null);
  const pendingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingDraftRef = useRef<CharacterCreatorDraft | null>(null);

  const loadRecentDrafts = async () => {
    try {
      const list = await CharacterDraftService.list();
      setRecentDrafts(list.slice(0, 10));
    } catch {
      // Non-critical
    }
  };

  const flushPendingSave = async () => {
    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
      pendingSaveTimerRef.current = null;
    }
    if (pendingDraftRef.current) {
      const draftToSave = pendingDraftRef.current;
      pendingDraftRef.current = null;
      try {
        await CharacterDraftService.update(draftToSave.id, { card: draftToSave.card });
      } catch {
        // Silently caught at flush boundary
      }
    }
  };

  useEffect(() => {
    void loadRecentDrafts();
    if (activeTab === "character-creator") {
      const intent = useCharacterCreatorLaunchStore.getState().consume();
      if (intent) {
        (async () => {
          try {
            switch (intent.mode) {
              case "new-from-idea":
                if (intent.sourceIdea) {
                  await handleCreateDraft(intent.sourceIdea, intent.optionalContext);
                } else {
                  setViewState("welcome");
                }
                break;
              case "open-draft":
                if (intent.draftId) {
                  await handleOpenDraft(intent.draftId);
                } else {
                  setViewState("welcome");
                }
                break;
              case "edit-local-character":
                if (intent.localCharacterId) {
                  const draft = await CharacterCreatorImportService.loadExistingCharacterAsDraft(intent.localCharacterId);
                  setActiveDraft(draft);
                  setViewState("draft");
                  await loadRecentDrafts();
                } else {
                  setViewState("welcome");
                }
                break;
              case "import-card":
                if (intent.importHandle) {
                  const draft = await CharacterCreatorImportService.loadImportHandleAsDraft(intent.importHandle);
                  setActiveDraft(draft);
                  setViewState("draft");
                  await loadRecentDrafts();
                } else {
                  setViewState("welcome");
                }
                break;
              case "duplicate-hosted-character":
                if (intent.hostedCharacterId) {
                  const draft = await CharacterCreatorImportService.loadHostedCharacterAsLocalDraft(intent.hostedCharacterId);
                  setActiveDraft(draft);
                  setViewState("draft");
                  await loadRecentDrafts();
                } else {
                  setViewState("welcome");
                }
                break;
              default:
                setViewState("welcome");
                break;
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            setErrorDetails(msg);
            setViewState("error");
          }
        })();
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]);

  useEffect(() => {
    return () => {
      void flushPendingSave();
    };
  }, []);

  const handleCreateDraft = async (idea: string, optionalContext?: OptionalDraftContext) => {
    setActiveIdea(idea);
    setViewState("generating");
    setErrorDetails(null);
    setProcessEvents([]);

    abortControllerRef.current = new AbortController();

    try {
      const res = await generateCharacterCreatorDraft(
        {
          operation: "create_draft",
          sourceIdea: idea,
          optionalContext,
        },
        {
          onEvent(ev) {
            setProcessEvents((prev) => [...prev, ev]);
          },
        },
        abortControllerRef.current.signal,
      );

      const draft = await CharacterDraftService.create({
        sourceIdea: idea,
        card: res.response.draft,
        creatorMetadata: {
          inspiration: idea.includes("mimics") ? "User requested archetype inspiration" : undefined,
          designSummary: res.response.design_summary,
          assumptions: res.response.assumptions,
          warnings: res.response.warnings,
          suggestedTags: res.response.draft.data.tags || [],
          avatarPrompt: (res.response.draft.data.extensions?.["venice-forge"] as Record<string, unknown>)?.avatarPrompt as string | undefined,
          processSummary: res.response.process_summary,
        },
      });

      const updatedDraft = await CharacterDraftService.update(draft.id, {
        conceptAnalysis: res.analysis,
        processTrace: res.processEvents,
      });

      setActiveDraft(updatedDraft);
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
    await flushPendingSave();
    try {
      const d = await CharacterDraftService.get(draftId);
      if (!d) throw new Error("Draft not found.");
      setActiveDraft(d);
      setViewState("draft");
    } catch (err) {
      toast.error("Could not load draft", String(err));
    }
  };

  const handleDuplicateDraft = async (draftId: string) => {
    try {
      const dup = await CharacterDraftService.duplicate(draftId);
      toast.success("Draft duplicated", dup.card.data.name);
      await loadRecentDrafts();
    } catch (err) {
      toast.error("Could not duplicate draft", String(err));
    }
  };

  const handleDeleteDraft = async (draftId: string) => {
    try {
      await CharacterDraftService.delete(draftId);
      toast.success("Draft deleted");
      await loadRecentDrafts();
    } catch (err) {
      toast.error("Could not delete draft", String(err));
    }
  };

  const handleUpdateDraftCard = (updatedCard: CharacterCardV2Dto) => {
    if (!activeDraft) return;
    const nextDraft: CharacterCreatorDraft = {
      ...activeDraft,
      card: updatedCard,
      updatedAt: new Date().toISOString(),
    };
    setActiveDraft(nextDraft);
    pendingDraftRef.current = nextDraft;

    if (pendingSaveTimerRef.current) {
      clearTimeout(pendingSaveTimerRef.current);
    }

    pendingSaveTimerRef.current = setTimeout(async () => {
      pendingSaveTimerRef.current = null;
      await flushPendingSave();
    }, 600);
  };

  const handleSaveDraft = async () => {
    await flushPendingSave();
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
    await flushPendingSave();
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
          processSummary: res.process_summary,
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
    await flushPendingSave();
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

  const handleValidateDraft = async () => {
    await flushPendingSave();
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
    await flushPendingSave();
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
    await flushPendingSave();
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

  const handleImportCardFile = async () => {
    if (isElectron()) {
      try {
        const res = await desktopCharacterCards.chooseImportFile();
        if (res.ok && res.handle) {
          const draft = await CharacterCreatorImportService.loadImportHandleAsDraft(res.handle);
          setActiveDraft(draft);
          setViewState("draft");
          await loadRecentDrafts();
          toast.success("Card imported into Character Creator", draft.card.data.name || "Imported Card");
        }
      } catch (err) {
        toast.error("Import failed", String(err));
      }
    } else {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = ".json,image/png";
      input.onchange = async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0];
        if (!file) return;
        try {
          const text = await file.text();
          const draft = await CharacterCreatorImportService.loadImportHandleAsDraft(text);
          setActiveDraft(draft);
          setViewState("draft");
          await loadRecentDrafts();
          toast.success("Card imported into Character Creator", draft.card.data.name);
        } catch (err) {
          toast.error("Could not parse card file", String(err));
        }
      };
      input.click();
    }
  };

  const handleSelectLocalCharacterToEdit = async (characterId: string) => {
    setShowLocalPicker(false);
    try {
      const draft = await CharacterCreatorImportService.loadExistingCharacterAsDraft(characterId);
      setActiveDraft(draft);
      setViewState("draft");
      await loadRecentDrafts();
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
          onDuplicateDraft={handleDuplicateDraft}
          onDeleteDraft={handleDeleteDraft}
          onImportCard={handleImportCardFile}
          onEditLocalCharacter={() => setShowLocalPicker(true)}
          recentDrafts={recentDrafts}
        />
      )}

      {viewState === "generating" && (
        <CharacterCreatorGenerating
          onCancel={handleCancelGeneration}
          idea={activeIdea}
          events={processEvents}
          processSummary={activeDraft?.creatorMetadata?.processSummary}
          designSummary={activeDraft?.creatorMetadata?.designSummary}
        />
      )}

      {(viewState === "draft" || viewState === "revising") && activeDraft && (
        <CharacterCreatorDraftEditor
          draft={activeDraft}
          onUpdateDraft={handleUpdateDraftCard}
          onSaveDraft={handleSaveDraft}
          onValidateDraft={handleValidateDraft}
          onApproveAndCreate={() => void handleValidateDraft()}
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

      {showLocalPicker && (
        <CharacterCreatorLocalPickerModal
          onSelectCharacter={handleSelectLocalCharacterToEdit}
          onClose={() => setShowLocalPicker(false)}
        />
      )}
    </div>
  );
}
