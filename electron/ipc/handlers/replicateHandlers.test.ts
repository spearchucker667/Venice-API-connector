// @vitest-environment node

/** @fileoverview Tests for the Replicate IPC handler with durable write-ahead submission. */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  expectErrorResult,
  expectOkResult,
  invokeCapturedHandler,
} from "../../test/ipcTestHelpers";
import type { BackgroundTask } from "../../../src/types/background-task";

const capturedHandlers = new Map<string, (...args: unknown[]) => unknown>();
const mockWebContents = {
  isDestroyed: vi.fn(() => false),
  send: vi.fn(),
};

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => "/tmp/vf-replicate-test"),
    getVersion: vi.fn(() => "1.0.0-test"),
  },
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
      capturedHandlers.set(channel, handler);
    }),
  },
  WebContents: {},
}));

vi.mock("./common", () => ({
  registerIpcChannel: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    capturedHandlers.set(channel, handler);
  }),
  registerPrivilegedIpcChannel: vi.fn((channel: string, handler: (...args: unknown[]) => unknown) => {
    capturedHandlers.set(channel, handler);
  }),
  safeSendToRenderer: vi.fn(),
}));

vi.mock("../../services/profileSession", () => ({
  getProfileSessionId: vi.fn(() => "p1"),
}));

vi.mock("../../services/secureStore", () => ({
  getProviderApiKey: vi.fn(() => "r8_test_token"),
}));

vi.mock("../../services/replicateService", () => ({
  createReplicatePrediction: vi.fn(),
  validateReplicateModel: vi.fn((model: string) => model),
}));

vi.mock("../../services/backgroundTaskManager", () => ({
  persistPaidSubmissionIntent: vi.fn(),
  markPaidSubmissionAccepted: vi.fn(),
  markPaidSubmissionAcceptanceUnknown: vi.fn(),
}));

vi.mock("../../services/paidSubmissionManager", () => ({
  submitDurablePaidTask: vi.fn(),
}));

import {
  createReplicatePrediction,
  validateReplicateModel,
} from "../../services/replicateService";
import { submitDurablePaidTask } from "../../services/paidSubmissionManager";
import { registerReplicateHandlers } from "./replicateHandlers";

const submitDurablePaidTaskMock = vi.mocked(submitDurablePaidTask);
const createPredictionMock = vi.mocked(createReplicatePrediction);
const validateReplicateModelMock = vi.mocked(validateReplicateModel);

type ReplicateGenerateImageResult =
  | { ok: true; disposition: "submitted" | "reused"; task: BackgroundTask }
  | { ok: false; disposition: "acceptance_unknown"; task: BackgroundTask; error: string }
  | { ok: false; disposition: "pre_dispatch_failure" | "conflict"; error: string };

function invoke<TResult>(channel: string, ...args: unknown[]): Promise<TResult> {
  return invokeCapturedHandler<TResult>(
    capturedHandlers,
    channel,
    { sender: mockWebContents },
    ...args,
  );
}

function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "task-123",
    type: "image",
    status: "queued",
    providerId: "replicate",
    queueId: "pred-123",
    profileId: "p1",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  } as BackgroundTask;
}

describe("registerReplicateHandlers", () => {
  beforeEach(() => {
    capturedHandlers.clear();
    submitDurablePaidTaskMock.mockReset();
    createPredictionMock.mockReset();
    validateReplicateModelMock.mockReset();
    validateReplicateModelMock.mockImplementation((model) => {
      if (typeof model !== "string") throw new Error("Invalid model");
      return model;
    });
    registerReplicateHandlers();
  });

  it("registers the generateImage channel", () => {
    expect(capturedHandlers.has("replicate:generateImage")).toBe(true);
  });

  it("submits a durable paid task with deterministic fingerprints", async () => {
    submitDurablePaidTaskMock.mockResolvedValueOnce({
      kind: "submitted",
      task: makeTask(),
    });

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expectOkResult(result);
    expect(result.disposition).toBe("submitted");
    expect(submitDurablePaidTaskMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: "replicate",
        operation: "image.generate",
        profileId: "p1",
        requestFingerprint: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        payloadHash: expect.stringMatching(/^sha256:[a-f0-9]{64}$/),
        metadata: { model: "black-forest-labs/flux-schnell" },
        dispatch: expect.any(Function),
        getRemoteTaskId: expect.any(Function),
        persistIntent: expect.any(Function),
        persistAccepted: expect.any(Function),
        persistAcceptanceUnknown: expect.any(Function),
      }),
    );
  });

  it("returns a reused task without redispatching", async () => {
    submitDurablePaidTaskMock.mockResolvedValueOnce({
      kind: "reused",
      task: makeTask(),
    });

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expectOkResult(result);
    expect(result.disposition).toBe("reused");
    expect(createPredictionMock).not.toHaveBeenCalled();
  });

  it("maps acceptance_unknown to a typed error result", async () => {
    submitDurablePaidTaskMock.mockResolvedValueOnce({
      kind: "acceptance_unknown",
      task: makeTask({ status: "acceptance_unknown" }),
      error: "Replicate prediction creation timed out before acceptance was confirmed.",
    });

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expectErrorResult(result);
    expect(result.disposition).toBe("acceptance_unknown");
    expect("task" in result && result.task).toBeDefined();
    expect(result.error).toMatch(/timed out|acceptance/i);
  });

  it("maps pre_dispatch_failure to a typed error result", async () => {
    submitDurablePaidTaskMock.mockResolvedValueOnce({
      kind: "pre_dispatch_failure",
      error: "disk full",
    });

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expectErrorResult(result);
    expect(result.disposition).toBe("pre_dispatch_failure");
    expect(result.error).toMatch(/disk full/i);
  });

  it("maps conflict to a typed error result", async () => {
    submitDurablePaidTaskMock.mockResolvedValueOnce({
      kind: "conflict",
      error: "IDEMPOTENCY_CONFLICT: same logical key used with different payload.",
    });

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expectErrorResult(result);
    expect(result.disposition).toBe("conflict");
    expect(result.error).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("returns an error when the API token is missing", async () => {
    const { getProviderApiKey } = await import("../../services/secureStore");
    vi.mocked(getProviderApiKey).mockReturnValueOnce(null);

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expectErrorResult(result);
    expect(result.error).toMatch(/token is not configured/i);
    expect(submitDurablePaidTaskMock).not.toHaveBeenCalled();
  });

  it("returns an error for invalid input", async () => {
    validateReplicateModelMock.mockImplementationOnce(() => {
      throw new Error("Invalid model");
    });

    const result = await invoke<ReplicateGenerateImageResult>("replicate:generateImage", {
      model: "invalid/model/with/path",
      input: { prompt: "a cat" },
    });

    expectErrorResult(result);
    expect(result.error).toMatch(/Invalid model/i);
    expect(submitDurablePaidTaskMock).not.toHaveBeenCalled();
  });
});
