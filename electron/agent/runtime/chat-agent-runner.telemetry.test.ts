import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { performGuardedVeniceRequest as PerformGuardedVeniceRequest } from "../../services/guardPipeline";
import type {
  publishInspectorCompletion as PublishInspectorCompletion,
  publishInspectorRequest as PublishInspectorRequest,
} from "../../services/inspectorTelemetry";
import { createToolExecutionContext } from "./tool-execution-context";

const mocks = vi.hoisted(() => {
  const publishInspectorRequest = vi.fn<typeof PublishInspectorRequest>();
  const publishInspectorCompletion = vi.fn<typeof PublishInspectorCompletion>();
  const performGuardedVeniceRequest = vi.fn<typeof PerformGuardedVeniceRequest>();
  return { publishInspectorRequest, publishInspectorCompletion, performGuardedVeniceRequest };
});

const { publishInspectorRequest, publishInspectorCompletion, performGuardedVeniceRequest } = mocks;

vi.mock("../../services/guardPipeline", () => ({
  performGuardedVeniceRequest: mocks.performGuardedVeniceRequest,
}));

vi.mock("../../services/inspectorTelemetry", () => ({
  publishInspectorRequest: mocks.publishInspectorRequest,
  publishInspectorCompletion: mocks.publishInspectorCompletion,
}));

vi.mock("./agent-tool-executor", () => ({
  executeAgentTool: vi.fn(),
}));

import { runChatAgentLoop } from "./chat-agent-runner";

function firstCompletionArg(): Parameters<typeof publishInspectorCompletion>[0] {
  const [call] = publishInspectorCompletion.mock.calls;
  if (call === undefined) {
    throw new Error("Expected publishInspectorCompletion to have been called");
  }
  const [arg] = call;
  return arg;
}

const toolExecutionContext = createToolExecutionContext({
  profileId: "p1",
  runtimeSessionId: "runtime_p1",
  senderId: 0,
  preset: "workspace_with_approval",
});
const onDelta = () => undefined;

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
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { choices: [{ message: { role: "assistant", content: "" }, finish_reason: "stop", index: 0 }] },
        contentType: "application/json",
      },
    });

    await runChatAgentLoop(
      { profileId: "p1", body: { messages: [] } },
      toolExecutionContext,
      onDelta,
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
    const completionArg = firstCompletionArg();
    expect(completionArg.eventId).toBe("evt-chat-runner-1");
    expect(completionArg.status).toBe(200);
    expect(completionArg.source).toBe("main-agent");
    expect(completionArg.transport).toBe("venice");
  });

  it("emits completion with status=451 on guard-block path", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "blocked",
      block: {
        ok: false,
        status: 451,
        statusText: "Blocked by Family Safe Mode",
        headers: {},
        body: { error: "blocked", reasonCode: "FAMILY_VIOLATION", category: "safety" },
        contentType: "application/json",
      },
    });

    await runChatAgentLoop(
      { profileId: "p1", body: { messages: [] } },
      toolExecutionContext,
      onDelta,
    );

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = firstCompletionArg();
    expect(completionArg.eventId).toBe("evt-chat-runner-1");
    expect(completionArg.status).toBe(451);
  });

  it("emits completion with error when dispatcher throws", async () => {
    performGuardedVeniceRequest.mockRejectedValueOnce(new Error("upstream timeout"));

    await expect(
      runChatAgentLoop(
        { profileId: "p1", body: { messages: [] } },
        toolExecutionContext,
        onDelta,
      )
    ).rejects.toThrow("upstream timeout");

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const completionArg = firstCompletionArg();
    expect(completionArg.eventId).toBe("evt-chat-runner-1");
    expect(completionArg.error).toEqual(expect.stringContaining("upstream timeout"));
  });

  it("does not break the loop when telemetry throws", async () => {
    publishInspectorRequest.mockImplementationOnce(() => {
      throw new Error("telemetry down");
    });
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { choices: [] },
        contentType: "application/json",
      },
    });

    await expect(
      runChatAgentLoop(
        { profileId: "p1", body: { messages: [] } },
        toolExecutionContext,
        onDelta,
      )
    ).resolves.toBeDefined();

    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
  });
});
