// @vitest-environment node
//
// Regression coverage for the P0-04 audit finding (see ROADMAP P0-04):
//
//   "executeMediaTool() calls fetch() against api.venice.ai/api/v1/models
//    and api.venice.ai/api/v1/image/generate, going around the guard
//    pipeline, capability resolver, safe-mode, retry policy, and traffic
//    inspector."
//
// These tests assert the executor routes `/image/generate` through
// `performGuardedVeniceRequest`, never the global fetch, and returns a
// canonical ChatMediaReference-shaped payload (the contract the chat-agent-
// runner expects) rather than the legacy `{mediaId, mimeType}` stub.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ToolResult } from "../../../src/agent/contracts/tool-results";
import type { performGuardedVeniceRequest as PerformGuardedVeniceRequest } from "../../services/guardPipeline";
import type {
  publishInspectorCompletion as PublishInspectorCompletion,
  publishInspectorRequest as PublishInspectorRequest,
} from "../../services/inspectorTelemetry";

// Performance pipeline must be the producer.
const mocks = vi.hoisted(() => ({
  performGuardedVeniceRequest: vi.fn<typeof PerformGuardedVeniceRequest>(),
  publishInspectorRequest: vi.fn<typeof PublishInspectorRequest>(),
  publishInspectorCompletion: vi.fn<typeof PublishInspectorCompletion>(),
}));
const {
  performGuardedVeniceRequest,
  publishInspectorRequest,
  publishInspectorCompletion,
} = mocks;

vi.mock("../../services/guardPipeline", () => ({
  performGuardedVeniceRequest: mocks.performGuardedVeniceRequest,
}));

// Inspector telemetry must be invoked for each /image/generate call.
vi.mock("../../services/inspectorTelemetry", () => ({
  publishInspectorRequest: mocks.publishInspectorRequest,
  publishInspectorCompletion: mocks.publishInspectorCompletion,
}));

// Audit must be invoked under a non-empty session id.
const audit = { record: vi.fn() };
vi.mock("./agent-services", () => ({
  getAgentServices: () => ({ audit, documents: {}, approvals: {} }),
}));

// Persistence must always run before the canonical payload is returned.
vi.mock("../../services/generatedMediaStore", () => ({}));
const persistGeneratedMedia = vi.fn();
import("../../services/generatedMediaStore").then((mod) => {
  mod.persistGeneratedMedia = persistGeneratedMedia;
});

// Raw fetch must never be called by the executor — the audit flags any
// direct HTTP call to api.venice.ai outside the guarded broker.
const fakeFetch = vi.fn();
vi.stubGlobal("fetch", fakeFetch);

// Must NOT reach the legacy auth flow:
vi.mock("../../services/secureStore", () => ({ getApiKey: vi.fn(() => "should-not-be-used") }));

import { executeMediaTool } from "./agent-tool-executor";
import { createToolExecutionContext } from "./tool-execution-context";
import { isChatMediaReferenceArrayContract } from "../../../src/shared/chatMediaReferenceContracts";

function makeMediaCtx(profileId: string, agentSessionId?: string) {
  return createToolExecutionContext({
    profileId,
    runtimeSessionId: `runtime_${profileId}`,
    senderId: 0,
    agentSessionId,
    preset: "workspace_with_approval",
  });
}

const PNG_PIXEL_BASE64 = "iVBORw0KGgo"; // 1×1 transparent PNG header
const JPEG_PIXEL_BASE64 = "/9j/"; // JPEG escape marker
const SHAM_SHA256 = "a".repeat(64);

function expectSuccessfulToolResult(result: ToolResult): asserts result is Extract<ToolResult, { ok: true }> {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
}

function expectFailedToolResult(result: ToolResult): asserts result is Extract<ToolResult, { ok: false }> {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error("Expected tool failure");
}

function expectRecord(value: unknown, label: string): asserts value is Record<string, unknown> {
  expect(typeof value).toBe("object");
  expect(value).not.toBeNull();
  expect(Array.isArray(value)).toBe(false);
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be a record`);
  }
}

describe("executeMediaTool — P0-04 guarded broker regression", () => {
  beforeEach(() => {
    performGuardedVeniceRequest.mockReset();
    audit.record.mockReset();
    persistGeneratedMedia.mockReset();
    fakeFetch.mockReset();
    publishInspectorRequest.mockReset();
    publishInspectorRequest.mockReturnValue("evt-tool-1");
    publishInspectorCompletion.mockReset();
    persistGeneratedMedia.mockResolvedValue({
      id: "media-123",
      url: "venice-media://abc123.png",
      mimeType: "image/png",
      byteCount: 12,
      sha256: SHAM_SHA256,
    });
  });

  it("routes /image/generate through performGuardedVeniceRequest and never calls fetch", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [{ b64_json: PNG_PIXEL_BASE64 }] },
        contentType: "application/json",
      },
    });

    const result = await executeMediaTool(
      makeMediaCtx("default", "agent-session-xyz"),
      "media.generateImage",
      "call-1",
      { prompt: "a serene landscape", model: "nano-banana" },
    );

    expect(fakeFetch).not.toHaveBeenCalled();
    expect(performGuardedVeniceRequest).toHaveBeenCalledTimes(1);
    const [call] = performGuardedVeniceRequest.mock.calls;
    if (call === undefined) throw new Error("Expected guarded request call");
    const [rawRequest] = call;
    expectRecord(rawRequest, "guarded request");
    const callBody = rawRequest.body;
    expectRecord(callBody, "guarded request body");
    expect(rawRequest.endpoint).toBe("/image/generate");
    expect(rawRequest.method).toBe("POST");
    expect(rawRequest.profileId).toBe("default");
    expect(callBody.model).toBe("nano-banana");
    expect(callBody.prompt).toBe("a serene landscape");
    expect(callBody.return_binary).toBe(false);

    expectSuccessfulToolResult(result);
    expectRecord(result.data, "successful tool data");
    expectRecord(result.data.chatRef, "successful tool chatRef");
    expect(result.data.chatRef.mediaType).toBe("image");
    expect(result.data.chatRef.operation).toBe("generate");
    expect(result.data.chatRef.displayUrl).toBe("venice-media://abc123.png");
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: "media.generateImage",
        outcome: "execution",
        resourceIds: ["media-123"],
        sessionId: "runtime_default:renderer_0:agent_agent-session-xyz",
      }),
    );
  });

  it("never emits the legacy {mediaId, mimeType} stub at the top of data", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [{ b64_json: JPEG_PIXEL_BASE64 }] },
        contentType: "application/json",
      },
    });

    const result = await executeMediaTool(
      makeMediaCtx("work"),
      "media.generateImage",
      "call-2",
      { prompt: "studio lighting still-life", model: "flux-1.1-pro" },
    );

    expectSuccessfulToolResult(result);
    expectRecord(result.data, "successful tool data");
    expect(Object.keys(result.data)).toEqual(["chatRef"]);
    expect(result.data).not.toHaveProperty("mediaId");
    expect(result.data).not.toHaveProperty("mimeType");
    expect(isChatMediaReferenceArrayContract([result.data.chatRef])).toBe(true);
  });

  it("blocks when the runtime family-safe guard denies the request", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "blocked",
      block: {
        ok: false,
        status: 451,
        statusText: "Blocked by Family Safe Mode",
        headers: {},
        body: { error: "Test should be blocked", reasonCode: "TEST_BLOCK", category: "safety", severity: "high" },
        contentType: "application/json",
      },
    });

    const result = await executeMediaTool(
      makeMediaCtx("default"),
      "media.generateImage",
      "call-3",
      { prompt: "anything", model: "nano-banana" },
    );

    expectFailedToolResult(result);
    expect(result.error.code).toBe("CAPABILITY_DENIED");
    expect(result.error.message).toMatch(/Test should be blocked/);
    expect(audit.record).not.toHaveBeenCalled();
  });

  it("rejects non-string model id", async () => {
    const result = await executeMediaTool(makeMediaCtx("default"), "media.generateImage", "call-4", { prompt: "x", model: 123 });
    expectFailedToolResult(result);
    expect(result.error.code).toBe("INVALID_ARGUMENTS");
    expect(performGuardedVeniceRequest).not.toHaveBeenCalled();
  });

  it("rejects empty / oversized prompt", async () => {
    const empty = await executeMediaTool(makeMediaCtx("default"), "media.generateImage", "call-5", { prompt: "  ", model: "x" });
    expectFailedToolResult(empty);
    expect(empty.error.code).toBe("INVALID_ARGUMENTS");

    const oversized = await executeMediaTool(
      makeMediaCtx("default"),
      "media.generateImage",
      "call-6",
      { prompt: "a".repeat(5000), model: "x" },
    );
    expectFailedToolResult(oversized);
    expect(oversized.error.code).toBe("INVALID_ARGUMENTS");
  });

  it("rejects malformed / non-PNG image payload", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [{ b64_json: "this-is-not-a-real-magic-bytes" }] },
        contentType: "application/json",
      },
    });

    const result = await executeMediaTool(
      makeMediaCtx("default"),
      "media.generateImage",
      "call-7",
      { prompt: "anything", model: "x" },
    );
    expectFailedToolResult(result);
    expect(result.error.code).toBe("INTERNAL_ERROR");
    expect(persistGeneratedMedia).not.toHaveBeenCalled();
  });
});

describe("executeMediaTool — Phase C inspector telemetry (VERIFY-156)", () => {
  beforeEach(() => {
    performGuardedVeniceRequest.mockReset();
    audit.record.mockReset();
    persistGeneratedMedia.mockReset();
    fakeFetch.mockReset();
    publishInspectorRequest.mockReset();
    publishInspectorRequest.mockReturnValue("evt-tool-1");
    publishInspectorCompletion.mockReset();
    persistGeneratedMedia.mockResolvedValue({
      id: "media-123",
      url: "venice-media://abc123.png",
      mimeType: "image/png",
      byteCount: 12,
      sha256: SHAM_SHA256,
    });
  });

  it("emits request with source=main-agent, transport=venice on success", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [{ b64_json: PNG_PIXEL_BASE64 }] },
        contentType: "application/json",
      },
    });
    await executeMediaTool(makeMediaCtx("default"), "media.generateImage", "call-A", {
      prompt: "p", model: "nano-banana",
    });
    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    const [requestCall] = publishInspectorRequest.mock.calls;
    if (requestCall === undefined) throw new Error("Expected inspector request call");
    const [reqCall] = requestCall;
    expect(reqCall.source).toBe("main-agent");
    expect(reqCall.transport).toBe("venice");
    expect(reqCall.endpoint).toBe("/image/generate");
    expect(reqCall.method).toBe("POST");
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const [completionCall] = publishInspectorCompletion.mock.calls;
    if (completionCall === undefined) throw new Error("Expected inspector completion call");
    const [compCall] = completionCall;
    expect(compCall.source).toBe("main-agent");
    expect(compCall.eventId).toBe("evt-tool-1");
    if (!compCall.summaries) throw new Error("Expected inspector completion summaries");
    expect(compCall.summaries.model).toBe("nano-banana");
  });

  it("emits completion with status=451 when guard returns blocked", async () => {
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "blocked",
      block: {
        ok: false,
        status: 451,
        statusText: "Blocked by Family Safe Mode",
        headers: {},
        body: { error: "blocked", reasonCode: "TEST", category: "TEST_CAT" },
        contentType: "application/json",
      },
    });
    const result = await executeMediaTool(makeMediaCtx("default"), "media.generateImage", "call-B", {
      prompt: "p", model: "m",
    });
    expectFailedToolResult(result);
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const [completionCall] = publishInspectorCompletion.mock.calls;
    if (completionCall === undefined) throw new Error("Expected inspector completion call");
    const [compCall] = completionCall;
    expect(compCall.status).toBe(451);
    expect(compCall.error).toMatch(/blocked/i);
  });

  it("does NOT emit telemetry when dispatcher throws before reaching dispatch", async () => {
    const err = new Error("dispatcher exploded");
    performGuardedVeniceRequest.mockImplementationOnce(() => {
      throw err;
    });
    await executeMediaTool(makeMediaCtx("default"), "media.generateImage", "call-C", {
      prompt: "p", model: "m",
    });
    expect(publishInspectorRequest).toHaveBeenCalledTimes(1);
    expect(publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const [completionCall] = publishInspectorCompletion.mock.calls;
    if (completionCall === undefined) throw new Error("Expected inspector completion call");
    const [completion] = completionCall;
    expect(completion.error).toMatch(/exploded/i);
  });

  it("does NOT break tool execution when publishInspectorCompletion throws", async () => {
    publishInspectorCompletion.mockImplementationOnce(() => {
      throw new Error("bus offline");
    });
    performGuardedVeniceRequest.mockResolvedValueOnce({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [{ b64_json: PNG_PIXEL_BASE64 }] },
        contentType: "application/json",
      },
    });
    const result = await executeMediaTool(makeMediaCtx("default"), "media.generateImage", "call-D", {
      prompt: "p", model: "m",
    });
    expectSuccessfulToolResult(result);
  });

  it("non-image media tools fail closed with CAPABILITY_DENIED", async () => {
    const result = await executeMediaTool(makeMediaCtx("default"), "media.generateVideo", "call-8", { prompt: "x" });
    expectFailedToolResult(result);
    expect(result.error.code).toBe("CAPABILITY_DENIED");
    expect(performGuardedVeniceRequest).not.toHaveBeenCalled();
  });
});
