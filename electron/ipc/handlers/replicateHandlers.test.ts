// @vitest-environment node

/** @fileoverview Tests for the Replicate IPC handler. */

import { describe, it, expect, beforeEach, vi } from "vitest";

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
  createBackgroundTaskInMain: vi.fn(),
}));

import { createReplicatePrediction } from "../../services/replicateService";
import { createBackgroundTaskInMain } from "../../services/backgroundTaskManager";
import { registerReplicateHandlers } from "./replicateHandlers";

const createPredictionMock = vi.mocked(createReplicatePrediction);
const createTaskMock = vi.mocked(createBackgroundTaskInMain);

function invoke(channel: string, ...args: unknown[]) {
  const handler = capturedHandlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return handler({ sender: mockWebContents }, ...args);
}

describe("registerReplicateHandlers", () => {
  beforeEach(() => {
    capturedHandlers.clear();
    createPredictionMock.mockReset();
    createTaskMock.mockReset();
    registerReplicateHandlers();
  });

  it("registers the generateImage channel", () => {
    expect(capturedHandlers.has("replicate:generateImage")).toBe(true);
  });

  it("creates a prediction and a background task", async () => {
    createPredictionMock.mockResolvedValueOnce({ id: "pred-123", status: "starting", input: { prompt: "a cat" } });
    createTaskMock.mockResolvedValueOnce({
      id: "task-123",
      type: "image",
      status: "queued",
      providerId: "replicate",
      queueId: "pred-123",
      profileId: "p1",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });

    const result = await invoke("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expect(result.ok).toBe(true);
    expect(createPredictionMock).toHaveBeenCalledWith("r8_test_token", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });
    expect(createTaskMock).toHaveBeenCalledWith(expect.objectContaining({
      type: "image",
      providerId: "replicate",
      queueId: "pred-123",
      modelId: "black-forest-labs/flux-schnell",
      profileId: "p1",
    }));
  });

  it("returns an error when the API token is missing", async () => {
    const { getProviderApiKey } = await import("../../services/secureStore");
    vi.mocked(getProviderApiKey).mockReturnValueOnce(null);

    const result = await invoke("replicate:generateImage", {
      model: "black-forest-labs/flux-schnell",
      input: { prompt: "a cat" },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/token is not configured/i);
    expect(createPredictionMock).not.toHaveBeenCalled();
  });

  it("returns an error for invalid input", async () => {
    const { validateReplicateModel } = await import("../../services/replicateService");
    validateReplicateModel.mockImplementationOnce(() => {
      throw new Error("Invalid model");
    });

    const result = await invoke("replicate:generateImage", {
      model: "invalid/model/with/path",
      input: { prompt: "a cat" },
    });

    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Invalid model/i);
  });
});
