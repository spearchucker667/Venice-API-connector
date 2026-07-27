// @vitest-environment node

import { describe, it, expect, beforeEach } from "vitest";

import { useInspectorStore } from "./inspector-store";

describe("useInspectorStore.upsertByEventId", () => {
  beforeEach(() => {
    useInspectorStore.setState({ logs: [] });
  });

  it("creates a new redacted row for an unseen eventId", () => {
    useInspectorStore.getState().upsertByEventId({
      eventId: "evt-1",
      phase: "updated",
      timestamp: 100,
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
      summaries: { taskId: "t1", model: "model-a" },
    });

    const logs = useInspectorStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe("evt-1");
    expect(logs[0].endpoint).toBe("/audio/retrieve");
    expect(logs[0].method).toBe("POST");
    expect(logs[0].callOutcome).toBe("pending");
    expect(logs[0].requestBody).toEqual({ summaries: { taskId: "t1", model: "model-a" } });
  });

  it("merges subsequent events with the same eventId into the existing row", () => {
    useInspectorStore.getState().upsertByEventId({
      eventId: "evt-2",
      phase: "updated",
      timestamp: 100,
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
    });
    useInspectorStore.getState().upsertByEventId({
      eventId: "evt-2",
      phase: "completed",
      timestamp: 200,
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
      status: 200,
      summaries: { durationMs: 50 },
    });

    const logs = useInspectorStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].id).toBe("evt-2");
    expect(logs[0].callOutcome).toBe("success");
    expect(logs[0].status).toBe(200);
    expect(logs[0].durationMs).toBe(50);
  });

  it("maps failed phases onto the error call outcome", () => {
    useInspectorStore.getState().upsertByEventId({
      eventId: "evt-err",
      phase: "failed",
      timestamp: 100,
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
      error: "audio retrieve failed",
    });

    expect(useInspectorStore.getState().logs[0].callOutcome).toBe("error");
    expect(useInspectorStore.getState().logs[0].error).toBe("audio retrieve failed");
  });

  it("clears only the external logs", () => {
    useInspectorStore.getState().addLog({
      endpoint: "/chat/completions",
      method: "POST",
      transport: "venice",
      requestHeaders: {},
      requestBody: { prompt_redacted: true },
    });
    useInspectorStore.getState().upsertByEventId({
      eventId: "evt-3",
      phase: "completed",
      timestamp: 100,
      endpoint: "/audio/retrieve",
      method: "POST",
      transport: "venice",
      source: "main-background",
    });

    useInspectorStore.getState().clearExternalLogs();
    const logs = useInspectorStore.getState().logs;
    expect(logs).toHaveLength(1);
    expect(logs[0].endpoint).toBe("/chat/completions");
  });

  it("caps the inspector log list at 100 entries", () => {
    for (let i = 0; i < 105; i++) {
      useInspectorStore.getState().upsertByEventId({
        eventId: `evt-${i}`,
        phase: "updated",
        timestamp: 1000 + i,
        endpoint: "/models",
        method: "GET",
        transport: "venice",
        source: "main-guard",
      });
    }
    expect(useInspectorStore.getState().logs.length).toBe(100);
  });
});
