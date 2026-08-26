// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import type { WebContents } from "electron";
import {
  __resetAgentPermissionStateForTests,
  getEffectiveAgentPermissionPreset,
  setEffectiveAgentPermissionPreset,
} from "./agent-permission-state";

function sender(id: number): WebContents {
  return { id } as WebContents;
}

describe("main-owned Document Agent permission state", () => {
  beforeEach(() => __resetAgentPermissionStateForTests());

  it("defaults unknown renderer sessions to limited_documents", () => {
    expect(getEffectiveAgentPermissionPreset(sender(1), "profile-a", "agent-1")).toBe("limited_documents");
  });

  it("applies a validated user-intent transition only to the owning sender, profile, and agent session", () => {
    const owner = sender(1);
    const other = sender(2);
    setEffectiveAgentPermissionPreset(owner, "profile-a", "agent-1", "workspace_with_approval");

    expect(getEffectiveAgentPermissionPreset(owner, "profile-a", "agent-1")).toBe("workspace_with_approval");
    expect(getEffectiveAgentPermissionPreset(owner, "profile-b", "agent-1")).toBe("limited_documents");
    expect(getEffectiveAgentPermissionPreset(owner, "profile-a", "agent-2")).toBe("limited_documents");
    expect(getEffectiveAgentPermissionPreset(other, "profile-a", "agent-1")).toBe("limited_documents");
  });

  it("rejects malformed sessions and unknown presets", () => {
    const owner = sender(1);
    expect(() => setEffectiveAgentPermissionPreset(owner, "profile-a", "../escape", "off")).toThrow(/session/i);
    expect(() => setEffectiveAgentPermissionPreset(owner, "profile-a", "agent-1", "admin" as never)).toThrow(/preset/i);
  });
});
