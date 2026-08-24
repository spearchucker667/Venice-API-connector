// @vitest-environment node

/** @fileoverview Tests for the Replicate polling integration in the background task manager. */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "node:fs/promises";
import fsSync from "node:fs";
import os from "node:os";
import path from "node:path";

// eslint-disable-next-line no-var
var TMP_USERDATA: string;

vi.mock("electron", () => {
  const tempRoot = fsSync.mkdtempSync(path.join(os.tmpdir(), "vf-bg-replicate-"));
  fsSync.mkdirSync(path.join(tempRoot, "UserData"), { recursive: true });
  TMP_USERDATA = fsSync.realpathSync(path.join(tempRoot, "UserData"));
  return {
    app: {
      getPath: vi.fn((name: string) => {
        if (name === "userData") return TMP_USERDATA;
        return os.tmpdir();
      }),
    },
  };
});

vi.mock("./secureStore", () => ({
  getProviderApiKey: vi.fn(() => "r8_test_token"),
}));

vi.mock("./generatedMediaStore", () => ({
  persistGeneratedMedia: vi.fn(async (_bytes: Buffer, mimeType: string) => ({
    id: "a".repeat(64),
    url: `venice-media://${"a".repeat(64)}`,
    mimeType,
    byteCount: 4,
    sha256: "a".repeat(64),
  })),
}));

vi.mock("../../src/shared/safety/mediaScreener", () => ({
  identifyAndValidateGeneratedMedia: vi.fn(async () => ({
    allowed: true,
    userMessage: undefined,
  })),
}));

vi.mock("./runtimeSafetySettings", () => ({
  getRuntimeLocalFamilySafeModeEnabled: vi.fn(() => false),
  getRuntimeVeniceApiSafeMode: vi.fn(() => false),
}));

vi.mock("./replicateService", () => ({
  pollReplicatePrediction: vi.fn(),
  downloadReplicateOutput: vi.fn(),
  cancelReplicatePrediction: vi.fn(),
}));

import { pollReplicatePrediction, downloadReplicateOutput } from "./replicateService";
import {
  initBackgroundTaskManager,
  createBackgroundTaskInMain,
  cancelBackgroundTaskInMain,
  getBackgroundTask,
  listBackgroundTasks,
  __resetBackgroundTaskManagerForTests,
  __flushBackgroundTaskPersistenceForTests,
} from "./backgroundTaskManager";

describe("backgroundTaskManager Replicate integration", () => {
  beforeEach(async () => {
    await __resetBackgroundTaskManagerForTests();
    vi.mocked(pollReplicatePrediction).mockReset();
    vi.mocked(downloadReplicateOutput).mockReset();
    const tasksFile = path.join(TMP_USERDATA, "background-tasks", "tasks.json");
    try {
      await fs.unlink(tasksFile);
    } catch {
      // ignore
    }
  });

  afterEach(async () => {
    const dir = path.join(TMP_USERDATA, "background-tasks");
    try {
      const entries = await fs.readdir(dir);
      await Promise.all(entries.map((e) => fs.unlink(path.join(dir, e)).catch(() => undefined)));
    } catch {
      // directory may not exist
    }
  });

  it("creates a Replicate image task and polls it to completion", async () => {
    vi.useFakeTimers();
    vi.mocked(pollReplicatePrediction)
      .mockResolvedValueOnce({ kind: "pending", prediction: { id: "pred-1", status: "processing", input: {} } })
      .mockResolvedValueOnce({
        kind: "completed",
        prediction: { id: "pred-1", status: "succeeded", input: {} },
        outputUrl: "https://replicate.delivery/out.png",
      });
    vi.mocked(downloadReplicateOutput).mockResolvedValueOnce({
      buffer: Buffer.from("image"),
      mimeType: "image/png",
    });

    const task = await createBackgroundTaskInMain({
      type: "image",
      providerId: "replicate",
      queueId: "pred-1",
      modelId: "black-forest-labs/flux-schnell",
      profileId: "p1",
    });

    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(4000);

    const latest = getBackgroundTask(task.id);
    expect(latest?.status).toBe("completed");
    expect(latest?.resultUrl).toMatch(/^venice-media:\/\//);
    expect(latest?.resultMediaId).toBeDefined();
    expect(downloadReplicateOutput).toHaveBeenCalledWith("https://replicate.delivery/out.png");

    vi.useRealTimers();
  });

  it("marks Replicate task failed when polling reports failure", async () => {
    vi.useFakeTimers();
    vi.mocked(pollReplicatePrediction).mockResolvedValueOnce({
      kind: "failed",
      prediction: { id: "pred-2", status: "failed", input: {} },
      error: "NSFW content detected",
    });

    const task = await createBackgroundTaskInMain({
      type: "image",
      providerId: "replicate",
      queueId: "pred-2",
      modelId: "black-forest-labs/flux-schnell",
      profileId: "p1",
    });

    await vi.advanceTimersByTimeAsync(0);

    const latest = getBackgroundTask(task.id);
    expect(latest?.status).toBe("failed");
    expect(latest?.error).toBe("NSFW content detected");

    vi.useRealTimers();
  });

  it("marks Replicate task aborted when prediction is canceled", async () => {
    vi.useFakeTimers();
    vi.mocked(pollReplicatePrediction).mockResolvedValueOnce({
      kind: "canceled",
      prediction: { id: "pred-3", status: "canceled", input: {} },
    });

    const task = await createBackgroundTaskInMain({
      type: "image",
      providerId: "replicate",
      queueId: "pred-3",
      modelId: "black-forest-labs/flux-schnell",
      profileId: "p1",
    });

    await vi.advanceTimersByTimeAsync(0);

    const latest = getBackgroundTask(task.id);
    expect(latest?.status).toBe("aborted");

    vi.useRealTimers();
  });

  it("attempts real provider cancellation for Replicate tasks", async () => {
    const task = await createBackgroundTaskInMain({
      type: "image",
      providerId: "replicate",
      queueId: "pred-4",
      modelId: "black-forest-labs/flux-schnell",
      profileId: "p1",
    });

    await cancelBackgroundTaskInMain(task.id);
    const latest = listBackgroundTasks()[0];
    expect(latest?.status).toBe("aborted");
    expect(latest?.metadata?.cancellationUnsupported).toBe(true);
  });

  it("persists the Replicate task across restart and resumes polling", async () => {
    const task = await createBackgroundTaskInMain({
      type: "image",
      providerId: "replicate",
      queueId: "pred-5",
      modelId: "black-forest-labs/flux-schnell",
      profileId: "p1",
    });
    await __flushBackgroundTaskPersistenceForTests();

    // Simulate process restart: reset in-memory state but leave journal on disk.
    await __resetBackgroundTaskManagerForTests();

    vi.useFakeTimers();
    vi.mocked(pollReplicatePrediction).mockResolvedValueOnce({
      kind: "pending",
      prediction: { id: "pred-5", status: "starting", input: {} },
    });

    await initBackgroundTaskManager();
    const recovered = getBackgroundTask(task.id);
    expect(recovered).not.toBeNull();
    expect(recovered?.status).toBe("queued");

    await vi.advanceTimersByTimeAsync(0);
    expect(getBackgroundTask(task.id)?.status).toBe("processing");

    vi.useRealTimers();
  });
});
