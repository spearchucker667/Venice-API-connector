/**
 * @fileoverview Safe error display component for Character Creator preserving user work.
 */

import { AlertCircle, RotateCcw, ArrowLeft, Copy } from "lucide-react";
import { toast } from "../../stores/toast-store";

interface Props {
  error: string;
  onRetry: () => void;
  onReturnToDraft: () => void;
  hasDraftWork?: boolean;
}

export function CharacterCreatorError({
  error,
  onRetry,
  onReturnToDraft,
  hasDraftWork = false,
}: Props) {
  const handleCopyError = () => {
    navigator.clipboard.writeText(error);
    toast.success("Error details copied to clipboard");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-6 text-center max-w-lg mx-auto">
      <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-4">
        <AlertCircle className="w-8 h-8" />
      </div>

      <h2 className="text-lg font-bold text-text-primary mb-2">Character Creator Error</h2>
      <p className="text-xs text-text-muted mb-4 max-w-md">
        An error occurred during generation or card processing. Your current draft and idea have been preserved.
      </p>

      {/* Error Details Box */}
      <div className="w-full bg-surface/60 rounded-xl border border-rose-500/20 p-4 mb-6 text-left">
        <div className="flex items-center justify-between text-xs text-rose-400 font-bold mb-1">
          <span>Diagnostic Message</span>
          <button
            type="button"
            onClick={handleCopyError}
            className="hover:underline flex items-center gap-1 text-[11px] font-medium"
          >
            <Copy className="w-3 h-3" />
            <span>Copy</span>
          </button>
        </div>
        <p className="text-xs text-text-secondary font-mono break-all line-clamp-4">
          {error}
        </p>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 w-full justify-center">
        {hasDraftWork && (
          <button
            type="button"
            onClick={onReturnToDraft}
            className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-secondary flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Draft</span>
          </button>
        )}
        <button
          type="button"
          onClick={onRetry}
          className="px-5 py-2 rounded-xl bg-accent text-accent-contrast font-medium text-xs flex items-center gap-1.5 hover:opacity-90 transition-opacity"
        >
          <RotateCcw className="w-4 h-4" />
          <span>Retry Operation</span>
        </button>
      </div>
    </div>
  );
}
