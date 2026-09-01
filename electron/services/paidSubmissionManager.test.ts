// @vitest-environment node

/** @fileoverview Tests for the provider-neutral durable paid-submission manager. */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { BackgroundTask } from "../../src/types/background-task";
import {
  submitDurablePaidTask,
  DispatchNotStartedError,
  __resetPaidSubmissionManagerForTests,
  type DurablePaidSubmissionInput,
} from "./paidSubmissionManager";
import {
  findActivePaidSubmission,
  persistPaidSubmissionIntent,
  markPaidSubmissionDispatching,
  markPaidSubmissionAcceptanceUnknown,
} from "./backgroundTaskManager";

vi.mock("./backgroundTaskManager", () => ({
  findActivePaidSubmission: vi.fn(),
  persistPaidSubmissionIntent: vi.fn(),
  markPaidSubmissionDispatching: vi.fn(),
  markPaidSubmissionAccepted: vi.fn(),
  markPaidSubmissionAcceptanceUnknown: vi.fn(),
}));

function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "task-1",
    type: "image",
    status: "intent_persisted",
    profileId: "p1",
    providerId: "replicate",
    operation: "image.generate",
    requestFingerprint: "sha256:fp",
    payloadHash: "sha256:payload",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

function makeInput<TAccepted>(
  overrides: Partial<DurablePaidSubmissionInput<TAccepted>> = {},
): DurablePaidSubmissionInput<TAccepted> {
  return {
    provider: "replicate",
    operation: "image.generate",
    profileId: "p1",
    requestFingerprint: "sha256:fp",
    payloadHash: "sha256:payload",
    metadata: { model: "owner/model" },
    persistIntent: vi.fn().mockResolvedValue(makeTask()),
    dispatch: vi.fn().mockResolvedValue({ remoteTaskId: "pred-1" } as TAccepted),
    getRemoteTaskId: (accepted: TAccepted) => (accepted as { remoteTaskId: string }).remoteTaskId,
    persistAccepted: vi.fn().mockResolvedValue(makeTask({ status: "queued", queueId: "pred-1" })),
    persistAcceptanceUnknown: vi.fn().mockResolvedValue(makeTask({ status: "acceptance_unknown" })),
    ...overrides,
  };
}

const findMock = vi.mocked(findActivePaidSubmission);
const intentMock = vi.mocked(persistPaidSubmissionIntent);
const dispatchingMock = vi.mocked(markPaidSubmissionDispatching);
const unknownMock = vi.mocked(markPaidSubmissionAcceptanceUnknown);

describe("submitDurablePaidTask", () => {
  beforeEach(() => {
    __resetPaidSubmissionManagerForTests();
    findMock.mockReset().mockReturnValue(undefined);
    intentMock.mockReset().mockResolvedValue(makeTask());
    dispatchingMock.mockReset().mockResolvedValue(makeTask({ status: "dispatching" }));
    unknownMock.mockReset().mockResolvedValue(makeTask({ status: "acceptance_unknown" }));
  });

  afterEach(() => {
    __resetPaidSubmissionManagerForTests();
  });

  it("persists intent before dispatch", async () => {
    const events: string[] = [];
    const result = await submitDurablePaidTask({
      ...makeInput(),
      persistIntent: async () => { events.push("persist"); return makeTask(); },
      dispatch: async () => { events.push("dispatch"); return { remoteTaskId: "pred-1" }; },
      persistAccepted: async () => { events.push("accepted"); return makeTask({ status: "queued", queueId: "pred-1" }); },
    });

    expect(events).toEqual(["persist", "dispatch", "accepted"]);
    expect(result.kind).toBe("submitted");
  });

  it("does not dispatch when intent persistence fails", async () => {
    const dispatch = vi.fn();
    const result = await submitDurablePaidTask({
      ...makeInput(),
      persistIntent: vi.fn().mockRejectedValue(new Error("disk full")),
      dispatch,
    });

    expect(result.kind).toBe("pre_dispatch_failure");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("does not dispatch when the dispatching transition fails", async () => {
    const dispatch = vi.fn();
    intentMock.mockResolvedValueOnce(makeTask());
    dispatchingMock.mockRejectedValueOnce(new Error("journal lock failed"));

    const result = await submitDurablePaidTask({
      ...makeInput(),
      dispatch,
    });

    expect(result.kind).toBe("pre_dispatch_failure");
    expect(dispatch).not.toHaveBeenCalled();
  });

  it("classifies post-dispatch failures as acceptance_unknown", async () => {
    const persistAcceptanceUnknown = vi.fn().mockResolvedValue(makeTask({ status: "acceptance_unknown" }));

    const result = await submitDurablePaidTask({
      ...makeInput(),
      dispatch: vi.fn().mockRejectedValue(new Error("network error after transmission")),
      persistAcceptanceUnknown,
    });

    expect(result.kind).toBe("acceptance_unknown");
    expect(persistAcceptanceUnknown).toHaveBeenCalledWith("task-1", "network error after transmission");
  });

  it("classifies DispatchNotStartedError as pre_dispatch_failure", async () => {
    intentMock.mockResolvedValueOnce(makeTask());
    dispatchingMock.mockResolvedValueOnce(makeTask({ status: "dispatching" }));

    const result = await submitDurablePaidTask({
      ...makeInput(),
      dispatch: vi.fn().mockRejectedValue(new DispatchNotStartedError("validation failed before request")),
    });

    expect(result.kind).toBe("pre_dispatch_failure");
    expect(unknownMock).not.toHaveBeenCalled();
  });

  it("deduplicates concurrent equivalent submissions", async () => {
    let dispatches = 0;
    intentMock.mockResolvedValue(makeTask());
    dispatchingMock.mockResolvedValue(makeTask({ status: "dispatching" }));

    const input = makeInput({
      dispatch: async () => {
        dispatches++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { remoteTaskId: "pred-1" };
      },
    });

    const [first, second] = await Promise.all([
      submitDurablePaidTask(input),
      submitDurablePaidTask(input),
    ]);

    expect(dispatches).toBe(1);
    expect(first.kind).toBe("submitted");
    expect(second.kind).toBe("submitted");
  });

  it("reuses a persisted active submission with the same payload", async () => {
    findMock.mockReturnValueOnce(makeTask({ status: "queued", queueId: "pred-1" }));

    const result = await submitDurablePaidTask(makeInput());

    expect(result.kind).toBe("reused");
    expect(intentMock).not.toHaveBeenCalled();
  });

  it("returns a conflict when the persisted active submission has a different payload", async () => {
    findMock.mockReturnValueOnce(makeTask({ payloadHash: "sha256:other" }));

    const result = await submitDurablePaidTask(makeInput());

    expect(result.kind).toBe("conflict");
    expect("error" in result && result.error).toContain("IDEMPOTENCY_CONFLICT");
  });

  it("does not deduplicate submissions for different profiles", async () => {
    let dispatches = 0;
    intentMock.mockResolvedValue(makeTask());
    dispatchingMock.mockResolvedValue(makeTask({ status: "dispatching" }));

    const base = makeInput({
      dispatch: async () => {
        dispatches++;
        return { remoteTaskId: "pred-1" };
      },
    });

    const first = await submitDurablePaidTask({ ...base, profileId: "p1" });
    const second = await submitDurablePaidTask({ ...base, profileId: "p2" });

    expect(dispatches).toBe(2);
    expect(first.kind).toBe("submitted");
    expect(second.kind).toBe("submitted");
  });

  it("does not deduplicate submissions with different payload hashes", async () => {
    let dispatches = 0;
    intentMock.mockResolvedValue(makeTask());
    dispatchingMock.mockResolvedValue(makeTask({ status: "dispatching" }));

    const base = makeInput({
      dispatch: async () => {
        dispatches++;
        return { remoteTaskId: "pred-1" };
      },
    });

    const first = await submitDurablePaidTask({ ...base, payloadHash: "sha256:payload-a" });
    const second = await submitDurablePaidTask({ ...base, payloadHash: "sha256:payload-b" });

    expect(dispatches).toBe(2);
    expect(first.kind).toBe("submitted");
    expect(second.kind).toBe("submitted");
  });

  it("returns acceptance_unknown when persistAcceptanceUnknown itself fails", async () => {
    const dispatchError = new Error("provider connection dropped after bytes sent");

    const result = await submitDurablePaidTask({
      ...makeInput(),
      dispatch: vi.fn().mockRejectedValue(dispatchError),
      persistAcceptanceUnknown: vi.fn().mockRejectedValue(new Error("disk full")),
    });

    expect(result.kind).toBe("acceptance_unknown");
    if (result.kind !== "acceptance_unknown") return;
    expect(result.error).toBe(dispatchError.message);
    expect(result.task.status).toBe("acceptance_unknown");
  });

  it("prevents same-fingerprint different-payload concurrent calls from both dispatching", async () => {
    let dispatches = 0;
    let intents = 0;
    const persistedTasks: BackgroundTask[] = [];
    dispatchingMock.mockResolvedValue(makeTask({ status: "dispatching" }));

    // Simulate the real manager: findActivePaidSubmission sees tasks after
    // persistIntent completes.
    findMock.mockImplementation((query) =>
      persistedTasks.find(
        (t) =>
          t.profileId === query.profileId &&
          t.providerId === query.providerId &&
          t.operation === query.operation &&
          t.requestFingerprint === query.requestFingerprint,
      ),
    );

    const base = makeInput({
      persistIntent: async () => {
        intents++;
        await new Promise((resolve) => setTimeout(resolve, 5));
        const task = makeTask({
          id: `task-${intents}`,
          payloadHash: intents === 1 ? "sha256:payload-a" : "sha256:payload-b",
        });
        persistedTasks.push(task);
        return task;
      },
      dispatch: async () => {
        dispatches++;
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { remoteTaskId: "pred-1" };
      },
    });

    const [first, second] = await Promise.all([
      submitDurablePaidTask({ ...base, payloadHash: "sha256:payload-a" }),
      submitDurablePaidTask({ ...base, payloadHash: "sha256:payload-b" }),
    ]);

    // Only one intent may be written and only one provider dispatch may occur.
    expect(intents).toBe(1);
    expect(dispatches).toBe(1);

    const kinds = new Set([first.kind, second.kind]);
    expect(kinds.has("submitted")).toBe(true);
    expect(kinds.has("conflict")).toBe(true);
  });
});
