/** @fileoverview CharacterLibrary launch intent tests.
 *
 * Verifies that submitting a prompt in CharacterLibrary launches the canonical Character Creator
 * with a typed launch intent instead of executing inline generation.
 */

import "@testing-library/jest-dom/vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import "fake-indexeddb/auto";
import { useCharacterCreatorLaunchStore } from "../../stores/character-creator-launch-store";
import { useSettingsStore } from "../../stores/settings-store";

const mocks = vi.hoisted(() => ({
  loadMock: vi.fn(),
  listCharacterCardDraftsMock: vi.fn(),
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

vi.mock(
  "../../services/characterCards/characterCardDraftService",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("../../services/characterCards/characterCardDraftService")
      >();
    return {
      ...actual,
      listCharacterCardDrafts: mocks.listCharacterCardDraftsMock,
    };
  },
);

import { CharacterLibrary } from "./CharacterLibrary";

describe("CharacterLibrary — Canonical Character Creator Launch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listCharacterCardDraftsMock.mockResolvedValue([]);
    useCharacterCreatorLaunchStore.getState().clear();
    useSettingsStore.getState().setActiveTab("rp-studio");
  });

  it("keeps a newer draft refresh when an older request resolves last", async () => {
    let resolveOlderRequest!: (records: never[]) => void;
    const olderRequest = new Promise<never[]>((resolve) => {
      resolveOlderRequest = resolve;
    });
    mocks.listCharacterCardDraftsMock
      .mockReturnValueOnce(olderRequest)
      .mockResolvedValueOnce([
        {
          id: "draft-current",
          cardId: "card-current",
          card: {
            schema: "CharacterCardV1",
            id: "card-current",
            name: "Current draft",
            description: "",
            systemPrompt: "",
            tags: [],
            adult: false,
            exampleDialogues: [],
            createdAt: 1,
            updatedAt: 2,
          },
          createdAt: 1,
          updatedAt: 2,
        },
      ]);

    render(<CharacterLibrary onEdit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /drafts/i }));

    expect(await screen.findByText("Current draft")).toBeInTheDocument();

    await act(async () => {
      resolveOlderRequest([]);
      await olderRequest;
    });

    expect(screen.getByText("Current draft")).toBeInTheDocument();
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
