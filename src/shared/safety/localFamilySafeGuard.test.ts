import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SafetyGuardDecision } from "./childExploitationGuard";

vi.mock("./localFamilyGuardRules", () => ({
  runLocalFamilyGuard: vi.fn(),
}));

import { runLocalFamilyGuard } from "./localFamilyGuardRules";
import { maybeRunLocalFamilyGuard } from "./localFamilySafeGuard";

const allowedDecision: SafetyGuardDecision = {
  allow: true,
  action: "allow",
  severity: "none",
  category: "none",
  reasonCode: "ALLOWED_NO_SIGNALS",
  userMessage: "",
  developerMessage: "allowed",
  normalizedChanged: false,
  signals: [],
  audit: {
    decisionId: "test",
    createdAt: "2026-06-05T00:00:00.000Z",
    promptHash: "00000000",
    promptLength: 4,
    matchedFieldPaths: [],
  },
};

const blockedDecision: SafetyGuardDecision = {
  ...allowedDecision,
  allow: false,
  action: "block",
  severity: "critical",
  category: "csam_request",
  reasonCode: "TEST_BLOCK",
  userMessage: "legacy message",
};

describe("maybeRunLocalFamilyGuard", () => {
  beforeEach(() => {
    vi.mocked(runLocalFamilyGuard).mockReset();
    vi.mocked(runLocalFamilyGuard).mockReturnValue(allowedDecision);
  });

  it("keeps mandatory child-safety evaluation active when the optional family filter is off", async () => {
    const sendToVeniceApi = vi.fn().mockResolvedValue({ ok: true });
    const input = { text: "synthetic fixture", endpoint: "/chat/completions", method: "POST", source: "chat" as const };
    const decision = maybeRunLocalFamilyGuard(input, false);
    if (decision.allowed) await sendToVeniceApi();

    expect(runLocalFamilyGuard).toHaveBeenCalledExactlyOnceWith(input, false);
    expect(sendToVeniceApi).toHaveBeenCalled();
    expect(decision).toEqual({
      allowed: true,
      skipped: true,
      reason: "optional-local-family-filter-disabled-child-safety-checked",
      guardDecision: allowedDecision,
      category: "general",
      layer: "mandatory-child-safety",
    });
  });

  it("blocks child-exploitation content even when the optional family filter is off", () => {
    vi.mocked(runLocalFamilyGuard).mockReturnValue(blockedDecision);
    const input = { text: "synthetic blocked fixture", endpoint: "/chat/completions", method: "POST", source: "chat" as const };
    const decision = maybeRunLocalFamilyGuard(input, false);

    expect(runLocalFamilyGuard).toHaveBeenCalledExactlyOnceWith(input, false);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.category).toBe("illegal-content");
      expect(decision.layer).toBe("mandatory-child-safety");
      expect(decision.userMessage).toMatch(/mandatory child-safety protection/i);
    }
  });

  it("blocks locally and does not call the provider when Family Safe Mode is on", async () => {
    vi.mocked(runLocalFamilyGuard).mockReturnValue(blockedDecision);
    const sendToVeniceApi = vi.fn();
    const input = { text: "synthetic blocked fixture", endpoint: "/chat/completions", method: "POST", source: "chat" as const };
    const decision = maybeRunLocalFamilyGuard(input, true);
    if (decision.allowed) await sendToVeniceApi();

    expect(runLocalFamilyGuard).toHaveBeenCalledExactlyOnceWith(input, true);
    expect(sendToVeniceApi).not.toHaveBeenCalled();
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) {
      expect(decision.layer).toBe("mandatory-child-safety");
    }
  });

  it.each([
    { localFamilySafeModeEnabled: true, veniceApiSafeMode: true },
    { localFamilySafeModeEnabled: true, veniceApiSafeMode: false },
    { localFamilySafeModeEnabled: false, veniceApiSafeMode: true },
    { localFamilySafeModeEnabled: false, veniceApiSafeMode: false },
  ])("keeps local and provider settings independent: %o", (settings) => {
    vi.mocked(runLocalFamilyGuard).mockReturnValue(allowedDecision);
    const input = { text: "synthetic fixture", endpoint: "/image/generate", method: "POST", source: "image" as const };
    const result = maybeRunLocalFamilyGuard(input, settings.localFamilySafeModeEnabled);
    const providerPayload = { safe_mode: settings.veniceApiSafeMode };

    expect(result.allowed).toBe(true);
    expect(runLocalFamilyGuard).toHaveBeenCalledExactlyOnceWith(input, settings.localFamilySafeModeEnabled);
    expect(providerPayload.safe_mode).toBe(settings.veniceApiSafeMode);
    if (result.allowed) {
      expect(result.layer).toBe(
        settings.localFamilySafeModeEnabled ? "optional-family-policy" : "mandatory-child-safety"
      );
    }
  });
});
