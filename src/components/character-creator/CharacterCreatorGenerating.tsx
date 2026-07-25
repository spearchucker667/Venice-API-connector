/**
 * @fileoverview Deterministic progress and generation screen for Character Creator.
 */

import { useEffect, useState } from "react";
import { Loader2, XCircle } from "lucide-react";

interface Props {
  onCancel: () => void;
  idea: string;
}

const PROGRESS_STEPS = [
  "Building identity",
  "Developing personality",
  "Writing scenario",
  "Creating first message",
  "Checking consistency",
];

export function CharacterCreatorGenerating({ onCancel, idea }: Props) {
  const [activeStepIndex, setActiveStepIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveStepIndex((prev) => (prev < PROGRESS_STEPS.length - 1 ? prev + 1 : prev));
    }, 1800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] h-full p-6 text-center max-w-lg mx-auto">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded-full bg-accent/10 border border-accent/30 flex items-center justify-center text-accent animate-pulse">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      </div>

      <h2 className="text-lg font-bold text-text-primary mb-2">Generating Character Draft</h2>
      <p className="text-xs text-text-muted mb-6 max-w-md line-clamp-2 italic">
        “{idea}”
      </p>

      {/* Progress Steps */}
      <div className="w-full bg-surface/60 rounded-xl border border-border p-4 mb-6 flex flex-col gap-2.5">
        {PROGRESS_STEPS.map((step, idx) => {
          const isDone = idx < activeStepIndex;
          const isCurrent = idx === activeStepIndex;

          return (
            <div key={step} className="flex items-center gap-3 text-xs">
              <div className={`w-2.5 h-2.5 rounded-full ${isDone ? "bg-emerald-500" : isCurrent ? "bg-accent animate-ping" : "bg-border"}`} />
              <span className={`font-medium ${isDone ? "text-text-secondary line-through opacity-70" : isCurrent ? "text-text-primary font-bold" : "text-text-muted"}`}>
                {step}
              </span>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={onCancel}
        className="px-4 py-2 rounded-xl bg-surface border border-border hover:bg-surface-elevated text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-2 transition-colors"
      >
        <XCircle className="w-4 h-4 text-rose-400" />
        <span>Cancel Generation</span>
      </button>
    </div>
  );
}
