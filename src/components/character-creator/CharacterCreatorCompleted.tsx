/**
 * @fileoverview Character creation completion screen with actions.
 */

import { CheckCircle2, MessageSquare, User, FileUp, Sparkles, Edit3 } from "lucide-react";
import type { CharacterCardV1 } from "../../types/rp";

interface Props {
  character: CharacterCardV1;
  onStartChat: () => void;
  onViewCharacter: () => void;
  onContinueEditing: () => void;
  onExportCard: () => void;
  onCreateAnother: () => void;
}

export function CharacterCreatorCompleted({
  character,
  onStartChat,
  onViewCharacter,
  onContinueEditing,
  onExportCard,
  onCreateAnother,
}: Props) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[450px] h-full p-6 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
        <CheckCircle2 className="w-8 h-8" />
      </div>

      <h2 className="text-xl font-bold text-text-primary mb-1">Character Created</h2>
      <p className="text-xs text-text-muted mb-6">
        “<span className="text-text-primary font-semibold">{character.name}</span>” has been saved to your local character library.
      </p>

      {/* Primary & Secondary Actions */}
      <div className="flex flex-col gap-2.5 w-full">
        <button
          type="button"
          onClick={onStartChat}
          className="w-full py-2.5 rounded-xl bg-accent text-accent-contrast font-medium text-xs flex items-center justify-center gap-2 hover:opacity-90 transition-opacity"
        >
          <MessageSquare className="w-4 h-4" />
          <span>Start Chat</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onViewCharacter}
            className="py-2 px-3 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-primary flex items-center justify-center gap-1.5 transition-colors"
          >
            <User className="w-3.5 h-3.5" />
            <span>View Character</span>
          </button>
          <button
            type="button"
            onClick={onContinueEditing}
            className="py-2 px-3 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-primary flex items-center justify-center gap-1.5 transition-colors"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Continue Editing</span>
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={onExportCard}
            className="py-2 px-3 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-secondary flex items-center justify-center gap-1.5 transition-colors"
          >
            <FileUp className="w-3.5 h-3.5 text-accent" />
            <span>Export Card</span>
          </button>
          <button
            type="button"
            onClick={onCreateAnother}
            className="py-2 px-3 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-secondary flex items-center justify-center gap-1.5 transition-colors"
          >
            <Sparkles className="w-3.5 h-3.5 text-accent" />
            <span>Create Another</span>
          </button>
        </div>
      </div>
    </div>
  );
}
