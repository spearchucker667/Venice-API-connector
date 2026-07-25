/**
 * @fileoverview Transient launch-intent store for Character Creator integration.
 *
 * Facilitates safe, profile-aware navigation into the Character Creator workflow
 * from external entry points (RP Studio, Character Editor, Character Library, Hosted Cards).
 */

import { create } from "zustand";
import { useSettingsStore } from "./settings-store";
import type { OptionalDraftContext } from "../types/character-creator";

export type CharacterCreatorLaunchMode =
  | "new-from-idea"
  | "open-draft"
  | "edit-local-character"
  | "import-card"
  | "duplicate-hosted-character"
  | "new-from-image";

export interface CharacterCreatorLaunchIntent {
  id: string;
  mode: CharacterCreatorLaunchMode;
  createdAt: string;

  sourceIdea?: string;
  draftId?: string;
  localCharacterId?: string;
  importHandle?: string;
  hostedCharacterId?: string;
  sourceMediaId?: string;

  optionalContext?: OptionalDraftContext;
}

export interface CharacterCreatorLaunchState {
  pendingIntent: CharacterCreatorLaunchIntent | null;

  launch(intent: Omit<CharacterCreatorLaunchIntent, "id" | "createdAt">): void;
  consume(): CharacterCreatorLaunchIntent | null;
  clear(): void;
}

export const useCharacterCreatorLaunchStore = create<CharacterCreatorLaunchState>((set, get) => ({
  pendingIntent: null,

  launch(intent) {
    const id =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `intent_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

    set({
      pendingIntent: {
        ...intent,
        id,
        createdAt: new Date().toISOString(),
      },
    });
  },

  consume() {
    const current = get().pendingIntent;
    if (current) {
      set({ pendingIntent: null });
    }
    return current;
  },

  clear() {
    set({ pendingIntent: null });
  },
}));

/**
 * Global helper to trigger entry into the canonical Character Creator flow.
 * Sets the pending launch intent and navigates to the character-creator tab.
 */
export function openCharacterCreator(
  intent: Omit<CharacterCreatorLaunchIntent, "id" | "createdAt">,
): void {
  useCharacterCreatorLaunchStore.getState().launch(intent);
  useSettingsStore.getState().setActiveTab("character-creator");
}
