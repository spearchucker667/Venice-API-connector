// @vitest-environment node

/** @fileoverview Tests for the guard pipeline (prompt + response screening).
 *
 *  VERIFY-154 regression guard: every `checkLocalFamilyGuard` evaluation
 *  emits exactly one inspector telemetry pair stamped with source=main-guard
 *  and transport=local, tagged with the matching guardOutcome, and the
 *  emit never breaks the evaluation when telemetry fails.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const inspectorEvents = new Array<{ kind: "request" | "completion"; source?: string; transport?: string; guardOutcome?: string; status?: number; error?: string; eventId?: string; endpoint?: string; method?: string }>();

vi.mock("./inspectorTelemetry", () => ({
  publishInspectorRequest: vi.fn(() => "evt-guard-test"),
  publishInspectorCompletion: vi.fn((args: Record<string, unknown>) => {
    inspectorEvents.push({ kind: "completion", ...args });
    return "evt-guard-test";
  }),
  emitInspectorTelemetry: vi.fn(),
  subscribeInspectorTelemetry: vi.fn(() => () => {}),
  clearInspectorTelemetryListeners: vi.fn(),
}));

vi.mock("../../src/shared/safety", async () => {
  return {
    maybeRunLocalFamilyGuard: vi.fn((_input: unknown, enabled: boolean) =>
      enabled
        ? {
            allowed: false,
            userMessage: "blocked",
            guardDecision: {
              reasonCode: "TEST_BLOCK",
              category: "TEST_CAT",
              severity: "high",
            },
          }
        : { allowed: true, skipped: true },
    ),
    SafetyGuardBlockedError: class extends Error {
      decision: { reasonCode: string; category: string; userMessage: string };
      constructor(dec: { reasonCode: string; category: string; userMessage: string }) {
        super(dec.userMessage);
        this.decision = dec;
      }
    },
    screenResponseBody: vi.fn(() => ({ allowed: true })),
    safetyBlockBodyFromResponseScreen: vi.fn(() => ({ error: "blocked" })),
  };
});

vi.mock("./runtimeSafetySettings", () => ({
  getRuntimeLocalFamilySafeModeEnabled: vi.fn(() => true),
  getRuntimeVeniceApiSafeMode: vi.fn(() => false),
}));

vi.mock("./veniceClient", () => ({
  performVeniceRequest: vi.fn(async () => ({ ok: true, status: 200, body: {} })),
}));

vi.mock("../../src/shared/veniceSafeMode", () => ({
  applyVeniceApiSafeMode: (e: string, b: unknown) => b,
}));

vi.mock("../agent/runtime/trusted-agent-request", () => ({
  composeTrustedRequest: (r: unknown) => r,
}));

import { checkLocalFamilyGuard, performGuardedVeniceRequest } from "./guardPipeline";
import {
  publishInspectorRequest,
  publishInspectorCompletion,
} from "./inspectorTelemetry";

beforeEach(() => {
  inspectorEvents.length = 0;
  vi.mocked(publishInspectorRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
  vi.mocked(publishInspectorCompletion as unknown as ReturnType<typeof vi.fn>).mockClear();
  (publishInspectorRequest as unknown as ReturnType<typeof vi.fn>).mockReturnValue("evt-guard-test");
});

describe("Guard pipeline inspector telemetry", () => {
  it("emits request+completion with source=main-guard and transport=local when blocked", () => {
    const block = checkLocalFamilyGuard({
      endpoint: "/chat/completions",
      method: "POST",
      payload: { hello: "world" },
      source: "venice-client",
    });
    expect(block?.status).toBe(451);
    expect(inspectorEvents).toHaveLength(1);
    const completion = inspectorEvents[0];
    expect(completion.kind).toBe("completion");
    expect(completion.source).toBe("main-guard");
    expect(completion.transport).toBe("local");
    expect(completion.endpoint).toBe("/chat/completions");
    expect(completion.method).toBe("POST");
    expect(completion.guardOutcome).toBe("block");
    expect(completion.status).toBe(451);
    expect(completion.eventId).toBe("evt-guard-test");
  });

  it("emits guardOutcome=allow when miss", async () => {
    const maybeRunGuard = (await import("../../src/shared/safety")).maybeRunLocalFamilyGuard;
    vi.mocked(maybeRunGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: true,
      skipped: false,
    });
    const result = checkLocalFamilyGuard({
      endpoint: "/chat/completions",
      method: "POST",
      payload: {},
      source: "venice-client",
    });
    expect(result).toBeNull();
    expect(inspectorEvents).toHaveLength(1);
    expect(inspectorEvents[0].guardOutcome).toBe("allow");
    expect(inspectorEvents[0].status).toBe(200);
  });

  it("emits guardOutcome=skipped when Adult Mode is on", async () => {
    const maybeRunGuard = (await import("../../src/shared/safety")).maybeRunLocalFamilyGuard;
    vi.mocked(maybeRunGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: true,
      skipped: true,
    });
    checkLocalFamilyGuard({
      endpoint: "/chat/completions",
      method: "POST",
      payload: {},
      source: "venice-client",
    });
    expect(inspectorEvents[0].guardOutcome).toBe("skipped");
  });

  it("does NOT throw when telemetry fails (publishCompletion throws)", async () => {
    const maybeRunGuard = (await import("../../src/shared/safety")).maybeRunLocalFamilyGuard;
    vi.mocked(maybeRunGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValueOnce({
      allowed: true,
      skipped: false,
    });
    vi.mocked(publishInspectorCompletion as unknown as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error("bus offline");
    });
    expect(() =>
      checkLocalFamilyGuard({
        endpoint: "/chat/completions",
        method: "POST",
        payload: {},
        source: "venice-client",
      }),
    ).not.toThrow();
  });

  it("performGuardedVeniceRequest returns upstream response on allow path", async () => {
    const maybeRunGuard = (await import("../../src/shared/safety")).maybeRunLocalFamilyGuard;
    vi.mocked(maybeRunGuard as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      allowed: true,
      skipped: false,
    });
    const out = await performGuardedVeniceRequest({
      endpoint: "/chat/completions",
      method: "POST",
      body: {},
    });
    expect(out.kind).toBe("response");
  });
});
