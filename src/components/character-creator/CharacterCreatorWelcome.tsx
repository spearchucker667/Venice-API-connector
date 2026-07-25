/**
 * @fileoverview Character Creator splash screen and idea composer.
 */

import { useState } from "react";
import { UserRoundPen, Sparkles, FolderOpen, FileUp, Edit3, ChevronDown, ChevronUp } from "lucide-react";
import type { CharacterCreatorDraftSummary, OptionalDraftContext } from "../../types/character-creator";

interface Props {
  onCreateDraft: (idea: string, context?: OptionalDraftContext) => void;
  onOpenDraft: (draftId: string) => void;
  onImportCard: () => void;
  onEditLocalCharacter: () => void;
  recentDrafts: CharacterCreatorDraftSummary[];
  isGenerating?: boolean;
}

export function CharacterCreatorWelcome({
  onCreateDraft,
  onOpenDraft,
  onImportCard,
  onEditLocalCharacter,
  recentDrafts,
  isGenerating = false,
}: Props) {
  const [idea, setIdea] = useState("");
  const [showAdvancedContext, setShowAdvancedContext] = useState(false);
  const [context, setContext] = useState<OptionalDraftContext>({});

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!idea.trim() || isGenerating) return;
    onCreateDraft(idea.trim(), context);
  };

  return (
    <div className="flex flex-col items-center justify-start min-h-full p-6 md:p-10 max-w-4xl mx-auto overflow-y-auto">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center gap-3 mb-8">
        <div className="p-4 rounded-2xl bg-accent/10 border border-accent/20 text-accent mb-2">
          <UserRoundPen className="w-10 h-10" />
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-text-primary tracking-tight">
          Character Creator
        </h1>
        <p className="text-sm md:text-base text-text-secondary font-medium max-w-xl">
          Turn a rough idea into a complete, editable character card.
        </p>
        <p className="text-xs md:text-sm text-text-muted max-w-2xl leading-relaxed mt-1">
          Start with a sentence, a detailed concept, or an existing character archetype. The creator will build a complete draft that you can inspect, rewrite, save, or export. Nothing is added to your character library until you approve it.
        </p>
        <div className="mt-1 px-3 py-1 rounded-full bg-surface-elevated border border-border text-[11px] font-mono text-text-muted">
          Creator model: <span className="text-accent font-semibold">GLM 5.2</span> (Immutable)
        </div>
      </div>

      {/* Idea Intake Form */}
      <form onSubmit={handleStart} className="w-full flex flex-col gap-4 mb-10 bg-surface/50 p-6 rounded-2xl border border-border/60 shadow-sm">
        <div className="flex flex-col gap-2">
          <label htmlFor="character-idea-input" className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Character Concept
          </label>
          <textarea
            id="character-idea-input"
            value={idea}
            onChange={(e) => setIdea(e.target.value)}
            placeholder="Example: I want a brooding nocturnal detective who protects a corrupt city without killing."
            rows={3}
            className="w-full p-4 text-sm rounded-xl bg-surface-elevated border border-border focus:outline-none focus:border-accent text-text-primary resize-y min-h-[90px]"
          />
        </div>

        {/* Optional Context Accordion */}
        <div className="border-t border-border/40 pt-3">
          <button
            type="button"
            onClick={() => setShowAdvancedContext(!showAdvancedContext)}
            className="flex items-center gap-2 text-xs text-text-secondary hover:text-text-primary font-medium"
          >
            {showAdvancedContext ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span>Optional Design Constraints & Context</span>
          </button>

          {showAdvancedContext && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3 pt-2">
              <div>
                <label className="text-[11px] text-text-muted font-medium">Setting / World</label>
                <input
                  type="text"
                  placeholder="e.g. Neo-Gothic metropolis, 1920s Noir"
                  value={context.setting || ""}
                  onChange={(e) => setContext({ ...context, setting: e.target.value })}
                  className="w-full p-2 text-xs rounded-lg bg-surface border border-border text-text-primary mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted font-medium">Tone</label>
                <input
                  type="text"
                  placeholder="e.g. Gritty, melancholic, satirical"
                  value={context.tone || ""}
                  onChange={(e) => setContext({ ...context, tone: e.target.value })}
                  className="w-full p-2 text-xs rounded-lg bg-surface border border-border text-text-primary mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted font-medium">Relationship to User</label>
                <input
                  type="text"
                  placeholder="e.g. Reluctant ally, mysterious informant"
                  value={context.relationship || ""}
                  onChange={(e) => setContext({ ...context, relationship: e.target.value })}
                  className="w-full p-2 text-xs rounded-lg bg-surface border border-border text-text-primary mt-1"
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted font-medium">Content Rating</label>
                <select
                  value={context.contentRating || "general"}
                  onChange={(e) => setContext({ ...context, contentRating: e.target.value })}
                  className="w-full p-2 text-xs rounded-lg bg-surface border border-border text-text-primary mt-1"
                >
                  <option value="general">General / PG</option>
                  <option value="mature">Mature / Dark Themes</option>
                  <option value="adult">Adult Uncensored</option>
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 mt-2">
          <div className="text-[11px] text-text-muted italic">
            All generated content remains a draft until you approve it.
          </div>
          <button
            type="submit"
            disabled={!idea.trim() || isGenerating}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-accent text-accent-contrast font-medium text-sm flex items-center justify-center gap-2 hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            <Sparkles className="w-4 h-4" />
            <span>Create Draft</span>
          </button>
        </div>
      </form>

      {/* Secondary Quick Actions */}
      <div className="flex flex-wrap items-center justify-center gap-3 w-full mb-10">
        <button
          type="button"
          onClick={onImportCard}
          className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-primary flex items-center gap-2 transition-colors"
        >
          <FileUp className="w-4 h-4 text-accent" />
          <span>Import Existing Card</span>
        </button>
        <button
          type="button"
          onClick={onEditLocalCharacter}
          className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-primary flex items-center gap-2 transition-colors"
        >
          <Edit3 className="w-4 h-4 text-accent" />
          <span>Edit Local Character</span>
        </button>
      </div>

      {/* Three Step Instruction Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full mb-10">
        <div className="p-4 rounded-xl bg-surface/30 border border-border/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">1</span>
            <span>Describe</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Enter anything from a one-line concept to a detailed character outline.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface/30 border border-border/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">2</span>
            <span>Review</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Inspect and edit the identity, personality, scenario, greeting, dialogue examples, and behavioral instructions.
          </p>
        </div>
        <div className="p-4 rounded-xl bg-surface/30 border border-border/40 flex flex-col gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-accent">
            <span className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center text-[10px]">3</span>
            <span>Create</span>
          </div>
          <p className="text-xs text-text-secondary leading-relaxed">
            Approve the final draft to add the character to your local library or export a compatible card.
          </p>
        </div>
      </div>

      {/* Recent Drafts Section */}
      {recentDrafts.length > 0 && (
        <div className="w-full flex flex-col gap-3 pt-4 border-t border-border/40">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary flex items-center gap-2">
            <FolderOpen className="w-4 h-4" />
            <span>Recent Unfinished Drafts</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {recentDrafts.map((d) => (
              <div
                key={d.id}
                onClick={() => onOpenDraft(d.id)}
                className="p-3 rounded-xl bg-surface border border-border hover:border-accent/40 cursor-pointer flex flex-col gap-1 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-text-primary truncate">{d.name}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-surface-elevated text-text-muted font-mono">
                    Rev {d.revision}
                  </span>
                </div>
                <p className="text-[11px] text-text-muted line-clamp-1 italic">{d.sourceIdea}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
