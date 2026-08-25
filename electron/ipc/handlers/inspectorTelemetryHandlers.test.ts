// @vitest-environment node

/** @fileoverview Tests for inspector telemetry IPC bridge.
 *
 *  VERIFY-152 regression guard: main-process telemetry events reach every
 *  subscribed renderer through the dedicated `inspector:telemetry` channel
 *  and do not leak on destroyed webContents.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  emitInspectorTelemetry,
  clearInspectorTelemetryListeners,
} from "../../services/inspectorTelemetry";

const capturedHandlers = new Map<string, (...args: unknown[]) => unknown>();
const sentEvents = new Array<{ channel: string; payload: unknown }>();
const mockSender = {
  isDestroyed: vi.fn(() => false),
  send: vi.fn((channel: string, payload: unknown) => {
    sentEvents.push({ channel, payload });
  }),
};
const destroyedSender = {
  isDestroyed: vi.fn(() => true),
  send: vi.fn(),
};

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
  getProfileSessionId: vi.fn(() => "p1"),
}));

import {
  registerInspectorTelemetryHandlers,
  __resetInspectorTelemetryHandlersForTests,
} from "./inspectorTelemetryHandlers";
import { clearRegisteredChannelsForTesting } from "./common";

describe("Inspector Inspector telemetry IPC", () => {
  beforeEach(() => {
    capturedHandlers.clear();
    sentEvents.length = 0;
    mockSender.send.mockClear();
    mockSender.isDestroyed.mockClear();
    mockSender.isDestroyed.mockReturnValue(false);
    destroyedSender.send.mockClear();
    destroyedSender.isDestroyed.mockClear();
    destroyedSender.isDestroyed.mockReturnValue(true);
    __resetInspectorTelemetryHandlersForTests();
    clearInspectorTelemetryListeners();
    clearRegisteredChannelsForTesting();
  });

  it("registers subscribe/unsubscribe handlers exactly once", () => {
    registerInspectorTelemetryHandlers();
    registerInspectorTelemetryHandlers();
    expect(capturedHandlers.size).toBe(2);
    expect(capturedHandlers.has("inspector:telemetry:subscribe")).toBe(true);
    expect(capturedHandlers.has("inspector:telemetry:unsubscribe")).toBe(true);
  });

  it("does not forward events without a registered subscriber", () => {
    registerInspectorTelemetryHandlers();
    emitInspectorTelemetry({
      phase: "updated",
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
    });
    expect(sentEvents).toHaveLength(0);
  });

  it("forwards lifecycle events to subscribed senders with the dedicated channel", async () => {
    registerInspectorTelemetryHandlers();
    const subscribe = capturedHandlers.get("inspector:telemetry:subscribe")!;
    const subscribeResult = await subscribe({ sender: mockSender, senderFrame: { url: "http://localhost:5173" } });
    expect(subscribeResult).toEqual({ ok: true });

    emitInspectorTelemetry({
      phase: "updated",
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
      summaries: { taskId: "t1" },
    });

    expect(mockSender.send).toHaveBeenCalledTimes(1);
    const [, payload] = mockSender.send.mock.calls[0];
    expect(payload).toMatchObject({
      endpoint: "/audio/retrieve",
      method: "POST",
      source: "main-background",
      summaries: { taskId: "t1" },
      phase: "updated",
    });
  });

  it("delivers a follow-up `completed` event under the same eventId so the renderer can merge", () => {
    registerInspectorTelemetryHandlers();
    capturedHandlers.get("inspector:telemetry:subscribe")!({ sender: mockSender, senderFrame: { url: "http://localhost:5173" } });

    emitInspectorTelemetry({
      phase: "updated",
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
      eventId: "fixed-1",
    });
    emitInspectorTelemetry({
      phase: "completed",
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
      eventId: "fixed-1",
      status: 200,
    });

    expect(mockSender.send).toHaveBeenCalledTimes(2);
    const first = mockSender.send.mock.calls[0][1];
    const second = mockSender.send.mock.calls[1][1];
    expect((first as { eventId: string }).eventId).toBe("fixed-1");
    expect((second as { eventId: string }).eventId).toBe("fixed-1");
    expect((second as { phase: string }).phase).toBe("completed");
    expect((second as { status: number }).status).toBe(200);
  });

  it("drops destroyed senders so a closed window cannot stall the bus", () => {
    registerInspectorTelemetryHandlers();
    capturedHandlers.get("inspector:telemetry:subscribe")!({ sender: destroyedSender, senderFrame: { url: "http://localhost:5173" } });
    expect(() =>
      emitInspectorTelemetry({
        phase: "updated",
        endpoint: "/audio/retrieve",
        method: "POST",
        transport: "venice",
        source: "main-background",
      }),
    ).not.toThrow();
    expect(destroyedSender.send).not.toHaveBeenCalled();
  });

  it("stops forwarding after unsubscribe", () => {
    registerInspectorTelemetryHandlers();
    capturedHandlers.get("inspector:telemetry:subscribe")!({ sender: mockSender, senderFrame: { url: "http://localhost:5173" } });
    capturedHandlers.get("inspector:telemetry:unsubscribe")!({ sender: mockSender, senderFrame: { url: "http://localhost:5173" } });
    emitInspectorTelemetry({
      phase: "updated",
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
    });
    expect(mockSender.send).not.toHaveBeenCalled();
  });
});
