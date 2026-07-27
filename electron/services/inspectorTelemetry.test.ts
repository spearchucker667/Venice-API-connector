// @vitest-environment node
import { describe, it, expect, beforeEach } from "vitest";

import {
  subscribeInspectorTelemetry,
  emitInspectorTelemetry,
  publishInspectorRequest,
  publishInspectorCompletion,
  clearInspectorTelemetryListeners,
} from "./inspectorTelemetry";

describe("inspectorTelemetry bus", () => {
  beforeEach(() => {
    clearInspectorTelemetryListeners();
  });

  it("delivers a published event to a single subscriber", () => {
    const received: string[] = [];
    subscribeInspectorTelemetry((event) => received.push(event.eventId));
    const id = emitInspectorTelemetry({
      phase: "updated",
      endpoint: "/chat/completions",
      method: "POST",
      transport: "venice",
      source: "main-guard",
    });
    expect(received).toEqual([id]);
  });

  it("isolates subscribers with the unsubscribe handle", () => {
    const received: string[] = [];
    const unsubscribe = subscribeInspectorTelemetry((event) => received.push(event.eventId));
    emitInspectorTelemetry({ phase: "updated", endpoint: "/models", method: "GET", transport: "venice", source: "main-guard" });
    unsubscribe();
    emitInspectorTelemetry({ phase: "updated", endpoint: "/models", method: "GET", transport: "venice", source: "main-guard" });
    expect(received).toHaveLength(1);
  });

  it("reuses a provided eventId so the renderer can merge lifecycle updates", () => {
    const seen: Array<{ eventId: string; phase: string; status?: number }> = [];
    subscribeInspectorTelemetry((event) => seen.push({ eventId: event.eventId, phase: event.phase, status: event.status }));
    const id = publishInspectorRequest({
      source: "main-background",
      transport: "venice",
      endpoint: "/audio/retrieve",
      method: "POST",
      summaries: { taskId: "t1", model: "model-a" },
    });
    publishInspectorCompletion({
      source: "main-background",
      transport: "venice",
      endpoint: "/audio/retrieve",
      method: "POST",
      summaries: { taskId: "t1", model: "model-a" },
      eventId: id,
      status: 200,
    });
    expect(seen).toHaveLength(2);
    expect(seen[0].eventId).toBe(id);
    expect(seen[0].phase).toBe("updated");
    expect(seen[1].eventId).toBe(id);
    expect(seen[1].phase).toBe("completed");
    expect(seen[1].status).toBe(200);
  });

  it("maps an error event to the failed phase", () => {
    let capturedPhase: string | undefined;
    subscribeInspectorTelemetry((event) => {
      capturedPhase = event.phase;
    });
    publishInspectorCompletion({
      source: "main-background",
      transport: "venice",
      endpoint: "/audio/retrieve",
      method: "POST",
      error: "audio retrieve failed",
    });
    expect(capturedPhase).toBe("failed");
  });

  it("swallows listener exceptions so a faulty subscriber cannot break emitters", () => {
    subscribeInspectorTelemetry(() => {
      throw new Error("boom");
    });
    const received: string[] = [];
    subscribeInspectorTelemetry((event) => received.push(event.eventId));
    expect(() =>
      emitInspectorTelemetry({
        phase: "updated",
        endpoint: "/models",
        method: "GET",
        transport: "venice",
        source: "main-guard",
      }),
    ).not.toThrow();
    expect(received).toHaveLength(1);
  });
});
