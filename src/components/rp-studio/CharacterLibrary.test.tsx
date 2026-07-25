/** @fileoverview CharacterLibrary launch intent tests.
 *
 * Verifies that submitting a prompt in CharacterLibrary launches the canonical Character Creator
 * with a typed launch intent instead of executing inline generation.
 */

import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { useCharacterCreatorLaunchStore } from "../../stores/character-creator-launch-store";
import { useSettingsStore } from "../../stores/settings-store";

const mocks = vi.hoisted(() => ({
  loadMock: vi.fn(),
  upsertMock: vi.fn(),
}));

vi.mock("../../stores/character-card-store", () => {
  const cards: unknown[] = [];
  const state = {
    cards,
    hasLoaded: true,
    isLoading: false,
    error: null as string | null,
    load: mocks.loadMock,
    upsert: mocks.upsertMock,
    remove: vi.fn(),
    setSearchQuery: vi.fn(),
    searchQuery: "",
  };
  const fn = (selector: (s: typeof state) => unknown) => selector(state);
  (fn as unknown as { getState: () => typeof state }).getState = () => state;
  return { useCharacterCardStore: fn };
});

vi.mock("../../services/rpHelpers", () => ({
  startNormalChatForCharacter: vi.fn(),
}));

import { CharacterLibrary } from "./CharacterLibrary";

describe("CharacterLibrary — Canonical Character Creator Launch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useCharacterCreatorLaunchStore.getState().clear();
    useSettingsStore.getState().setActiveTab("rp-studio");
  });

  it("launches Character Creator on prompt submit", () => {
    render(<CharacterLibrary onEdit={vi.fn()} />);

    const input = screen.getByPlaceholderText("Auto-create prompt...");
    fireEvent.change(input, { target: { value: "Make a dark vigilante detective" } });
    fireEvent.click(screen.getByRole("button", { name: /build character/i }));

    // Verifies navigation to character-creator tab
    expect(useSettingsStore.getState().activeTab).toBe("character-creator");

    // Verifies launch intent was published
    const intent = useCharacterCreatorLaunchStore.getState().consume();
    expect(intent).not.toBeNull();
    expect(intent?.mode).toBe("new-from-idea");
    expect(intent?.sourceIdea).toBe("Make a dark vigilante detective");
  });

  it("launches Character Creator when Character Creator button is clicked", () => {
    render(<CharacterLibrary onEdit={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: /character creator/i }));

    expect(useSettingsStore.getState().activeTab).toBe("character-creator");
    const intent = useCharacterCreatorLaunchStore.getState().consume();
    expect(intent?.mode).toBe("new-from-idea");
  });
});
