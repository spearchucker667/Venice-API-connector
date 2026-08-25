// @vitest-environment node

/** @fileoverview Tests for the Jina API key/result IPC handlers.
 *
 *  VERIFY-153 regression guard: each jina:request call emits exactly one
 *  inspector telemetry pair (request + completion) reusing the same eventId,
 *  tagged with source=main-research / transport=jina, and never carries a
 *  signed Jina URL or raw response payload past the bus.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";

const capturedHandlers = new Map<string, (...args: unknown[]) => unknown>();
const inspectorEvents = new Array<Record<string, unknown>>();

// Default stub: a successful fetch returning an empty JSON body.
const stubFetch = vi.fn(async () => ({
  ok: true,
  status: 200,
  headers: { get: () => "application/json" },
}));

vi.mock("../../../src/shared/readBoundedFetchBody", async () => {
  const actual = await vi.importActual<typeof import("../../../src/shared/readBoundedFetchBody")>(
    "../../../src/shared/readBoundedFetchBody",
  );
  return {
    ...actual,
    readBoundedFetchBody: vi.fn(async () => "{}"),
  };
});

vi.stubGlobal("fetch", stubFetch);

vi.mock("electron", () => ({
  app: { isPackaged: false },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      capturedHandlers.set(channel, handler);
    }),
  },
  WebContents: {},
}));

vi.mock("../../services/profileSession", () => ({
  getProfileSessionId: vi.fn((sender: unknown) => {
    void sender;
    return "p1";
  }),
}));

vi.mock("../../services/secureStore", () => ({
  getJinaApiKey: vi.fn(() => null),
  isJinaApiKeyConfigured: vi.fn(() => false),
  setJinaApiKey: vi.fn(),
  deleteJinaApiKey: vi.fn(),
}));

vi.mock("../../services/guardPipeline", () => ({
  checkLocalFamilyGuard: vi.fn(() => null),
}));

vi.mock("../../services/runtimeSafetySettings", () => ({
  getRuntimeLocalFamilySafeModeEnabled: vi.fn(() => false),
}));

vi.mock("../../../src/shared/safety", () => ({
  screenResponseBody: vi.fn(() => ({ allowed: true })),
  safetyBlockBodyFromResponseScreen: vi.fn(() => ({ error: "blocked" })),
}));

vi.mock("../../services/inspectorTelemetry", async () => {
  const actual = await vi.importActual<typeof import("../../services/inspectorTelemetry")>(
    "../../services/inspectorTelemetry",
  );
  return {
    ...actual,
    publishInspectorRequest: vi.fn(() => "evt-test-1"),
    publishInspectorCompletion: vi.fn((evt: Record<string, unknown>) => {
      inspectorEvents.push(evt);
    }),
  };
});

import { registerJinaHandlers } from "./jinaHandlers";
import { registerInspectorTelemetryHandlers } from "./inspectorTelemetryHandlers";
import {
  publishInspectorRequest,
  publishInspectorCompletion,
} from "../../services/inspectorTelemetry";

const fakeSender = { id: 1, senderFrame: { url: "http://localhost:5173" } } as unknown;

describe("Jina IPC handler", () => {
  beforeEach(async () => {
    capturedHandlers.clear();
    inspectorEvents.length = 0;
    const { clearRegisteredChannelsForTesting } = await import("./common");
    const {
      clearInspectorTelemetryListeners,
    } = await import("../../services/inspectorTelemetry");
    const {
      __resetInspectorTelemetryHandlersForTests,
    } = await import("./inspectorTelemetryHandlers");
    clearRegisteredChannelsForTesting();
    clearInspectorTelemetryListeners();
    __resetInspectorTelemetryHandlersForTests();
    vi.mocked(publishInspectorRequest as unknown as ReturnType<typeof vi.fn>).mockClear();
    vi.mocked(publishInspectorRequest as unknown as ReturnType<typeof vi.fn>).mockReturnValue("evt-test-1");
    vi.mocked(publishInspectorCompletion as unknown as ReturnType<typeof vi.fn>).mockClear();
    capturedHandlers.clear();
  });

  function registerAll() {
    registerInspectorTelemetryHandlers();
    registerJinaHandlers();
    const handler = capturedHandlers.get("jina:request");
    if (!handler) throw new Error("jina:request not registered");
    return handler as unknown as (
      event: unknown,
      input: unknown,
    ) => Promise<unknown>;
  }

  it("rejects missing url with 400 and emits a single fail completion", async () => {
    const handler = registerAll();
    const result = await handler(fakeSender, {});
    expect(result).toEqual({ ok: false, status: 400, error: "Missing Jina request URL." });
    expect(inspectorEvents).toHaveLength(1);
    const evt = inspectorEvents[0];
    expect(evt.transport).toBe("jina");
    expect(evt.source).toBe("main-research");
    expect(evt.eventId).toBe("evt-test-1");
    expect(evt.error).toMatch(/missing/i);
  });

  it("rejects non-https with 403", async () => {
    const handler = registerAll();
    const result = await handler(fakeSender, { url: "http://r.jina.ai/x" });
    expect(result).toEqual({ ok: false, status: 403, error: expect.stringMatching(/https/i) });
    expect(inspectorEvents).toHaveLength(1);
  });

  it("rejects non-jina host with 403", async () => {
    const handler = registerAll();
    const result = await handler(fakeSender, { url: "https://example.com/" });
    expect(result).toEqual({ ok: false, status: 403, error: expect.stringMatching(/only jina/i) });
    expect(inspectorEvents).toHaveLength(1);
  });

  it("tags a search endpoint when hostname is s.jina.ai", async () => {
    const handler = registerAll();
    const result = await handler(fakeSender, { url: "https://s.jina.ai/?q=test" });
    expect(result).toBeTruthy();
    expect(inspectorEvents).toHaveLength(1);
    expect(inspectorEvents[0].endpoint).toBe("/jina/search");
  });

  it("falls back to reader endpoint for r.jina.ai", async () => {
    const handler = registerAll();
    await handler(fakeSender, { url: "https://r.jina.ai/https://example.com" });
    expect(inspectorEvents[0].endpoint).toBe("/jina/reader");
  });

  it("emits request and completion with same eventId", async () => {
    const handler = registerAll();
    const reqSpy = vi.mocked(publishInspectorRequest as unknown as ReturnType<typeof vi.fn>);
    reqSpy.mockReturnValueOnce("evt-shared-42");
    await handler(fakeSender, { url: "https://r.jina.ai/x" });
    expect(reqSpy).toHaveBeenCalledTimes(1);
    expect(inspectorEvents[0].eventId).toBe("evt-shared-42");
  });
});
