// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ChatMessage } from "../../types/venice";
import { MessageBubble } from "./message-bubble";

const testSettings = vi.hoisted(() => ({
  redTeamMode: false,
  localFamilySafeModeEnabled: false,
  characterSceneGenerationEnabled: false,
  audioPreferences: {
    chatTts: { showMessageControls: false },
  },
}));

vi.mock("../../stores/settings-store", () => ({
  useSettingsStore: (selector: (state: typeof testSettings) => unknown) =>
    selector(testSettings),
}));

vi.mock("../../shared/safety", () => ({
  maybeRunLocalFamilyGuard: vi.fn(() => ({ allowed: true as const })),
}));

vi.mock("../../stores/media-send-to", () => ({
  copyText: vi.fn(async () => true),
}));

import { copyText } from "../../stores/media-send-to";

beforeEach(() => {
  vi.mocked(copyText).mockClear();
});

describe("MessageBubble code-block copy regression (BUG-004)", () => {
  it("copies fenced code with non-ASCII and astral Unicode unchanged", async () => {
    const rawCode = "const greeting = 'Hej, 世界 👩🏽‍💻 — café';";
    const message: ChatMessage = {
      role: "assistant",
      content: `\`\`\`typescript\n${rawCode}\n\`\`\``,
    };

    render(
      <MessageBubble
        message={message}
        index={0}
        onCopy={() => {}}
        onDelete={() => {}}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Copy" }));

    expect(copyText).toHaveBeenCalledTimes(1);
    expect(copyText).toHaveBeenCalledWith(rawCode);
  });
});
