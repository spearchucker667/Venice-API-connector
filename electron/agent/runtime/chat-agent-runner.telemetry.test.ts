import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  const publishInspectorRequest = vi.fn(() => "evt-chat-runner-1");
  const publishInspectorCompletion = vi.fn();
  const performGuardedVeniceRequest = vi.fn();
  return { publishInspectorRequest, publishInspectorCompletion, performGuardedVeniceRequest };
});

const { publishInspectorRequest, publishInspectorCompletion, performGuardedVeniceRequest } = mocks;

vi.mock("../../services/guardPipeline", () => ({
  performGuardedVeniceRequest: (rawRequest: unknown, options: { onDelta?: (c: unknown) => void } = {}) =>
    mocks.performGuardedVeniceRequest(rawRequest, options),
}));

vi.mock("../../services/inspectorTelemetry", () => ({
  publishInspectorRequest: (...args: unknown[]) => mocks.publishInspectorRequest(...args),
  publishInspectorCompletion: (...args: unknown[]) => mocks.publishInspectorCompletion(...args),
}));

vi.mock("./agent-tool-executor", () => ({
  executeAgentTool: vi.fn(),
}));

import { runChatAgentLoop } from "./chat-agent-runner";

beforeEach(() => {
  performGuardedVeniceRequest.mockReset();
  publishInspectorRequest.mockClear();
  publishInspectorCompletion.mockClear();
  publishInspectorRequest.mockReturnValue("evt-chat-runner-1");
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("runChatAgentLoop — Phase C inspector telemetry (VERIFY-157)", () => {
  it("emits request and completion on success path reusing eventId", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: { status: 200, body: { choices: [{ message: { role: "assistant", content: "" }, finish_reason: "stop", index: 0 }] } },
    });

    await runChatAgentLoop(
      { profileId: "p1", body: { messages: [] } },
      () => undefined
    );

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(publishInspectorRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "main-agent",
        transport: "venice",
        endpoint: "/chat/completions",
        method: "POST",
      })
    );
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-chat-runner-1");
    expect(completionArg.status).toBe(200);
    expect(completionArg.source).toBe("main-agent");
    expect(completionArg.transport).toBe("venice");
  });

  it("emits completion with status=451 on guard-block path", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "blocked",
      block: { body: { error: "blocked", reasonCode: "FAMILY_VIOLATION", category: "safety" } },
    });

    await runChatAgentLoop(
      { profileId: "p1", body: { messages: [] } },
      () => undefined
    );

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-chat-runner-1");
    expect(completionArg.status).toBe(451);
  });

  it("emits completion with error when dispatcher throws", async () => {
    performGuardedVeniceRequest.mockRejectedValueOnce(new Error("upstream timeout"));

    await expect(
      runChatAgentLoop(
        { profileId: "p1", body: { messages: [] } },
        () => undefined
      )
    ).rejects.toThrow("upstream timeout");

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = publishInspectorCompletion.mock.calls[0][0] as Record<string, unknown>;
    expect(completionArg.eventId).toBe("evt-chat-runner-1");
    expect(completionArg.error).toEqual(expect.stringContaining("upstream timeout"));
  });

  it("does not break the loop when telemetry throws", async () => {
    publishInspectorRequest.mockImplementationOnce(() => {
      throw new Error("telemetry down");
    });
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: { status: 200, body: { choices: [] } },
    });

    await expect(
      runChatAgentLoop(
        { profileId: "p1", body: { messages: [] } },
        () => undefined
      )
    ).resolves.toBeDefined();

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
  });
});
