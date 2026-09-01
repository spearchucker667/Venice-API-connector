// @vitest-environment node
//
// Regression coverage for the approved `media.generateImage` execution path.
//
// These tests verify that the executor dispatches the stored wire payload
// through `submitDurablePaidTask`, persists the returned image, updates the
// background task to completed, and handles intent-before-dispatch,
// deduplication, and ambiguous failures conservatively.

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BackgroundTask } from "../../../src/types/background-task";
import { executeApprovedGenerateImagePlan } from "./approved-media-executor";
import { buildGenerateImagePlan, type GenerateImagePlan } from "../approvals/plan-factories";
import { __resetPaidSubmissionManagerForTests } from "../../services/paidSubmissionManager";
import type {
  publishInspectorRequest as PublishInspectorRequest,
  publishInspectorCompletion as PublishInspectorCompletion,
} from "../../services/inspectorTelemetry";

const PNG_PIXEL_BASE64 = "iVBORw0KGgo";

const mocks = vi.hoisted(() => {
  const mockTasks = new Map<string, BackgroundTask>();

  function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
    const id = overrides.id ?? `task-${Date.now()}-${mockTasks.size}`;
    const now = Date.now();
    return {
      id,
      type: "image",
      status: "intent_persisted",
      profileId: "profile_1",
      providerId: "venice",
      modelId: "flux-dev",
      operation: "image.generate",
      requestFingerprint: "fp_1",
      payloadHash: "sha256:a".repeat(64).slice(0, 71),
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  }

  return {
    mockTasks,
    makeTask,
    persistPaidSubmissionIntent: vi.fn(async (input: {
      type: string;
      providerId: string;
      operation: string;
      modelId: string;
      profileId: string;
      requestFingerprint: string;
      payloadHash: string;
      metadata?: Record<string, unknown>;
    }): Promise<BackgroundTask> => {
      const task = makeTask({
        status: "intent_persisted",
        requestFingerprint: input.requestFingerprint,
        payloadHash: input.payloadHash,
        metadata: input.metadata,
      });
      mockTasks.set(task.id, task);
      return task;
    }),
    markPaidSubmissionAcceptanceUnknown: vi.fn(async (taskId: string, error: string): Promise<BackgroundTask> => {
      const task = mockTasks.get(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);
      const updated = { ...task, status: "acceptance_unknown" as const, error };
      mockTasks.set(taskId, updated);
      return updated;
    }),
    updateBackgroundTaskInMain: vi.fn(async (taskId: string, updates: {
      status: "completed";
      queueId: string;
      resultUrl: string;
      resultMediaId: string;
      acceptedAt: number;
      metadata?: Record<string, unknown>;
    }): Promise<BackgroundTask | null> => {
      const task = mockTasks.get(taskId);
      if (!task) return null;
      const updated = { ...task, ...updates };
      mockTasks.set(taskId, updated);
      return updated;
    }),
    markPaidSubmissionDispatching: vi.fn(async (taskId: string): Promise<BackgroundTask> => {
      const task = mockTasks.get(taskId);
      if (!task) throw new Error(`Task ${taskId} not found`);
      const updated = { ...task, status: "dispatching" as const };
      mockTasks.set(taskId, updated);
      return updated;
    }),
    findActivePaidSubmission: vi.fn((): BackgroundTask | undefined => {
      for (const task of mockTasks.values()) {
        if (["intent_persisted", "dispatching", "queued", "processing"].includes(task.status)) {
          return task;
        }
      }
      return undefined;
    }),
    performGuardedVeniceRequest: vi.fn(),
    publishInspectorRequest: vi.fn<typeof PublishInspectorRequest>(() => "evt-1"),
    publishInspectorCompletion: vi.fn<typeof PublishInspectorCompletion>(),
    persistGeneratedMedia: vi.fn(),
  };
});

vi.mock("../../services/backgroundTaskManager", () => ({
  persistPaidSubmissionIntent: mocks.persistPaidSubmissionIntent,
  markPaidSubmissionAcceptanceUnknown: mocks.markPaidSubmissionAcceptanceUnknown,
  updateBackgroundTaskInMain: mocks.updateBackgroundTaskInMain,
  markPaidSubmissionDispatching: mocks.markPaidSubmissionDispatching,
  findActivePaidSubmission: mocks.findActivePaidSubmission,
}));

vi.mock("../../services/guardPipeline", () => ({
  performGuardedVeniceRequest: (...args: unknown[]) => mocks.performGuardedVeniceRequest(...args),
}));

vi.mock("../../services/inspectorTelemetry", () => ({
  publishInspectorRequest: mocks.publishInspectorRequest,
  publishInspectorCompletion: mocks.publishInspectorCompletion,
}));

vi.mock("../../services/generatedMediaStore", () => ({
  persistGeneratedMedia: (...args: unknown[]) => mocks.persistGeneratedMedia(...args),
}));

function makePlan(overrides: Partial<GenerateImagePlan> = {}): GenerateImagePlan {
  const wirePayload = { model: "flux-dev", prompt: "a serene landscape", return_binary: false };
  return buildGenerateImagePlan({
    profileId: "profile_1",
    toolCallId: "call_1",
    prompt: "a serene landscape",
    modelId: "flux-dev",
    payloadHash: "sha256:a".repeat(64).slice(0, 71),
    requestFingerprint: "fp_1",
    wirePayload,
    ...overrides,
  });
}

describe("executeApprovedGenerateImagePlan", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockTasks.clear();
    __resetPaidSubmissionManagerForTests();

    mocks.persistGeneratedMedia.mockResolvedValue({
      id: "media_1",
      url: "venice-media://media_1.png",
      mimeType: "image/png",
      byteCount: 12,
    });

    mocks.performGuardedVeniceRequest.mockResolvedValue({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: { "x-request-id": "req_1" },
        body: { images: [{ b64_json: PNG_PIXEL_BASE64 }] },
        contentType: "application/json",
      },
    });
  });

  afterEach(() => {
    __resetPaidSubmissionManagerForTests();
  });

  it("persists intent before dispatching to the provider", async () => {
    await executeApprovedGenerateImagePlan(makePlan());

    expect(mocks.persistPaidSubmissionIntent).toHaveBeenCalledTimes(1);
    expect(mocks.performGuardedVeniceRequest).toHaveBeenCalledTimes(1);
    const dispatchCall = mocks.performGuardedVeniceRequest.mock.calls[0];
    if (dispatchCall === undefined) throw new Error("Expected dispatch call");
    const [dispatchArgs] = dispatchCall;
    expect(dispatchArgs.endpoint).toBe("/image/generate");
    expect(dispatchArgs.method).toBe("POST");
    expect(dispatchArgs.body).toEqual(makePlan().wirePayload);
  });

  it("returns a canonical ChatMediaReference and completed task on success", async () => {
    const result = await executeApprovedGenerateImagePlan(makePlan());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("Expected success");
    expect(result.chatRef.mediaType).toBe("image");
    expect(result.chatRef.operation).toBe("generate");
    expect(result.chatRef.mediaId).toBe("media_1");
    expect(result.chatRef.displayUrl).toBe("venice-media://media_1.png");
    expect(result.chatRef.modelId).toBe("flux-dev");
    expect(result.task.status).toBe("completed");
    expect(result.task.resultMediaId).toBe("media_1");
    expect(result.task.resultUrl).toBe("venice-media://media_1.png");
    expect(mocks.updateBackgroundTaskInMain).toHaveBeenCalledTimes(1);
  });

  it("deduplicates concurrent identical submissions", async () => {
    const plan = makePlan();

    mocks.performGuardedVeniceRequest.mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        kind: "response",
        response: {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { "x-request-id": "req_1" },
          body: { images: [{ b64_json: PNG_PIXEL_BASE64 }] },
          contentType: "application/json",
        },
      };
    });

    const [first, second] = await Promise.all([
      executeApprovedGenerateImagePlan(plan),
      executeApprovedGenerateImagePlan(plan),
    ]);

    expect(mocks.persistPaidSubmissionIntent).toHaveBeenCalledTimes(1);
    expect(mocks.performGuardedVeniceRequest).toHaveBeenCalledTimes(1);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
  });

  it("classifies a Family Safe Mode block as a pre-dispatch failure", async () => {
    mocks.performGuardedVeniceRequest.mockResolvedValue({
      kind: "blocked",
      block: {
        ok: false,
        status: 451,
        statusText: "Blocked",
        headers: {},
        body: { error: "Blocked by Family Safe Mode" },
        contentType: "application/json",
      },
    });

    const result = await executeApprovedGenerateImagePlan(makePlan());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toMatch(/Family Safe Mode/i);
    expect(result.task).toBeUndefined();
  });

  it("classifies a 4xx provider response as a pre-dispatch failure", async () => {
    mocks.performGuardedVeniceRequest.mockResolvedValue({
      kind: "response",
      response: {
        ok: false,
        status: 400,
        statusText: "Bad Request",
        headers: {},
        body: { error: "Bad request" },
        contentType: "application/json",
      },
    });

    const result = await executeApprovedGenerateImagePlan(makePlan());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toMatch(/400/);
    expect(result.task).toBeUndefined();
  });

  it("marks acceptance_unknown when dispatch fails after transmission", async () => {
    mocks.performGuardedVeniceRequest.mockRejectedValue(new Error("network timeout"));

    const result = await executeApprovedGenerateImagePlan(makePlan());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toMatch(/network timeout/);
    expect(result.task).toBeDefined();
    expect(result.task?.status).toBe("acceptance_unknown");
    expect(mocks.markPaidSubmissionAcceptanceUnknown).toHaveBeenCalledTimes(1);
  });

  it("returns acceptance_unknown when the response body lacks a valid image", async () => {
    mocks.performGuardedVeniceRequest.mockResolvedValue({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [] },
        contentType: "application/json",
      },
    });

    const result = await executeApprovedGenerateImagePlan(makePlan());

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("Expected failure");
    expect(result.error).toMatch(/valid base64 image/i);
    expect(result.task?.status).toBe("acceptance_unknown");
  });

  it("emits inspector telemetry for the provider dispatch", async () => {
    await executeApprovedGenerateImagePlan(makePlan());

    expect(mocks.publishInspectorRequest).toHaveBeenCalledTimes(1);
    const [requestCall] = mocks.publishInspectorRequest.mock.calls;
    if (requestCall === undefined) throw new Error("Expected inspector request call");
    const [req] = requestCall;
    expect(req.source).toBe("main-agent");
    expect(req.transport).toBe("venice");
    expect(req.endpoint).toBe("/image/generate");
    expect(req.method).toBe("POST");

    expect(mocks.publishInspectorCompletion).toHaveBeenCalledTimes(1);
    const [completionCall] = mocks.publishInspectorCompletion.mock.calls;
    if (completionCall === undefined) throw new Error("Expected inspector completion call");
    const [comp] = completionCall;
    expect(comp.source).toBe("main-agent");
    expect(comp.status).toBe(200);
  });
});
