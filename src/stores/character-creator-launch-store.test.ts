import { describe, it, expect, beforeEach } from "vitest";
import { useCharacterCreatorLaunchStore, openCharacterCreator } from "./character-creator-launch-store";
import { useSettingsStore } from "./settings-store";

describe("useCharacterCreatorLaunchStore", () => {
  beforeEach(() => {
    useCharacterCreatorLaunchStore.getState().clear();
    useSettingsStore.getState().setActiveTab("chat");
  });

  it("stores a launch intent and clears on consume", () => {
    openCharacterCreator({
      mode: "new-from-idea",
      sourceIdea: "Test idea",
    });

    expect(useSettingsStore.getState().activeTab).toBe("character-creator");

    const intent = useCharacterCreatorLaunchStore.getState().consume();
    expect(intent).not.toBeNull();
    expect(intent?.mode).toBe("new-from-idea");
    expect(intent?.sourceIdea).toBe("Test idea");

    // Second consume returns null (consumed exactly once)
    const secondConsume = useCharacterCreatorLaunchStore.getState().consume();
    expect(secondConsume).toBeNull();
  });

  it("clears pending intent cleanly", () => {
    useCharacterCreatorLaunchStore.getState().launch({
      mode: "edit-local-character",
      localCharacterId: "char_123",
    });

    expect(useCharacterCreatorLaunchStore.getState().pendingIntent?.localCharacterId).toBe("char_123");
    useCharacterCreatorLaunchStore.getState().clear();
    expect(useCharacterCreatorLaunchStore.getState().pendingIntent).toBeNull();
  });
});
