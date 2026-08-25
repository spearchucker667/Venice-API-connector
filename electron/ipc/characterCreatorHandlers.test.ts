import { describe, it, expect, vi, beforeEach } from "vitest";
import { ipcMain, dialog } from "electron";
import { clearRegisteredChannelsForTesting } from "./handlers/common";
import { registerCharacterCreatorHandlers, characterCreatorIpcChannels } from "./characterCreatorHandlers";
import type { CharacterCardV2Dto } from "../../src/types/character-card-spec";

vi.mock("electron", () => {
  type HandlerFn = (...args: unknown[]) => unknown;
  const handlers = new Map<string, HandlerFn>();
  return {
    app: { isPackaged: false },
    ipcMain: {
      handle: vi.fn((channel: string, handler: HandlerFn) => {
        handlers.set(channel, handler);
      }),
      _invoke: async (channel: string, event: unknown, payload: unknown) => {
        const handler = handlers.get(channel);
        if (!handler) throw new Error(`No handler registered for channel ${channel}`);
        return handler(event, payload);
      },
      _clear: () => handlers.clear(),
    },
    dialog: {
      showSaveDialog: vi.fn(),
    },
  };
});

vi.mock("fs/promises", () => ({
  default: {
    open: vi.fn(async () => ({
      writeFile: vi.fn(async () => undefined),
      sync: vi.fn(async () => undefined),
      close: vi.fn(async () => undefined),
    })),
    rename: vi.fn(async () => undefined),
    rm: vi.fn(async () => undefined),
  },
}));

describe("Character Creator IPC Handlers", () => {
  beforeEach(() => {
    (ipcMain as any)._clear();
    vi.clearAllMocks();
    clearRegisteredChannelsForTesting();
    registerCharacterCreatorHandlers();
  });

  it("registers validateCard handler and validates V2 card structure", async () => {
    const validCard: CharacterCardV2Dto = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Test Character",
        description: "Bio",
        personality: "Kind",
        scenario: "Park",
        first_mes: "Hi",
        mes_example: "",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "Venice Forge",
        character_version: "1.0",
        extensions: {},
      },
    };

    const res = await (ipcMain as any)._invoke(characterCreatorIpcChannels.validateCard, { senderFrame: { url: "http://localhost:5173" } }, { card: validCard });
    expect(res.ok).toBe(true);
    expect(res.valid).toBe(true);
  });

  it("exports JSON card safely without exposing private paths", async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({
      canceled: false,
      filePath: "/safe/user/documents/test-hero-character-card-v2.json",
    });

    const validCard: CharacterCardV2Dto = {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: "Test Hero",
        description: "Heroic",
        personality: "",
        scenario: "",
        first_mes: "",
        mes_example: "",
        creator_notes: "",
        system_prompt: "",
        post_history_instructions: "",
        alternate_greetings: [],
        tags: [],
        creator: "Venice Forge",
        character_version: "1.0",
        extensions: {},
      },
    };

    const res = await (ipcMain as any)._invoke(characterCreatorIpcChannels.exportCard, { senderFrame: { url: "http://localhost:5173" } }, {
      card: validCard,
      format: "json",
    });

    expect(res.ok).toBe(true);
    expect(res.canceled).toBe(false);
    expect(res.filename).toBe("test-hero-character-card-v2.json");
    expect(res.filePath).toBeUndefined(); // Does not leak full absolute path back to renderer
  });
});
