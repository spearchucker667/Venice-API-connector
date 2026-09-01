// @vitest-environment node

/** @fileoverview Tests for the background-task type contract and serialization. */

import { describe, it, expect } from "vitest";
import {
  parseTasks,
  serializeTasks,
  createBackgroundTask,
  isValidBackgroundTask,
  type BackgroundTask,
} from "./background-task";

function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "task-1",
    type: "image",
    status: "queued",
    profileId: "p1",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

describe("background-task serialization", () => {
  it("round-trips paid-submission lifecycle fields", () => {
    const task = makeTask({
      providerId: "replicate",
      operation: "image.generate",
      status: "acceptance_unknown",
      requestFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      payloadHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      dispatchStartedAt: 123,
    });

    expect(parseTasks(serializeTasks([task]))[0]).toMatchObject({
      providerId: "replicate",
      operation: "image.generate",
      status: "acceptance_unknown",
      requestFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      payloadHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
      dispatchStartedAt: 123,
    });
  });

  it("accepts both prefixed and bare SHA-256 payload hashes", () => {
    const bare = makeTask({ payloadHash: "abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" });
    const prefixed = makeTask({ payloadHash: "sha256:abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789" });

    expect(isValidBackgroundTask(bare)).toBe(true);
    expect(isValidBackgroundTask(prefixed)).toBe(true);
  });

  it("rejects malformed payload hashes", () => {
    const bad = makeTask({ payloadHash: "sha256:short" });
    expect(isValidBackgroundTask(bad)).toBe(false);
  });

  it("creates tasks with operation and lifecycle timestamps", () => {
    const task = createBackgroundTask({
      type: "image",
      profileId: "p1",
      providerId: "replicate",
      operation: "image.generate",
      requestFingerprint: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      payloadHash: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
    });

    expect(task.operation).toBe("image.generate");
    expect(task.requestFingerprint).toBe("sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
    expect(task.payloadHash).toBe("sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
    expect(task.status).toBe("queued");
  });

  it("migrates legacy pending_finalize with a real queueId to queued", () => {
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        {
          id: "legacy-1",
          type: "video",
          status: "pending_finalize",
          queueId: "queue-real",
          profileId: "p1",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const tasks = parseTasks(raw);
    expect(tasks[0].status).toBe("queued");
    expect(tasks[0].queueId).toBe("queue-real");
  });

  it("migrates legacy pending_finalize without a real queueId to acceptance_unknown", () => {
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        {
          id: "legacy-2",
          type: "image",
          status: "pending_finalize",
          queueId: "pending",
          profileId: "p1",
          providerId: "replicate",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    const tasks = parseTasks(raw);
    expect(tasks[0].status).toBe("acceptance_unknown");
    expect(tasks[0].error).toMatch(/acceptance unknown/i);
  });

  it("drops tasks with invalid statuses during strict parsing", () => {
    const raw = JSON.stringify({
      version: 1,
      tasks: [
        {
          id: "bad",
          type: "image",
          status: "not_a_status",
          profileId: "p1",
          createdAt: 1,
          updatedAt: 1,
        },
      ],
    });

    expect(parseTasks(raw)).toHaveLength(0);
  });
});
