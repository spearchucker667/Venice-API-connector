# Replicate Paid-Submission Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee durable write-ahead intent, profile-scoped deduplication, financially safe ambiguity handling, restart recovery, and bounded network reads for Replicate predictions.

**Architecture:** Extract provider-neutral paid-submission orchestration from the current Venice video/audio-specific path into a focused manager that persists lifecycle state through the canonical background-task journal. Replicate supplies a provider adapter for dispatch and remote-ID extraction; a separate bounded-response helper protects both control-plane and media reads while existing URL, MIME, signature, safety, and token boundaries remain unchanged.

**Tech Stack:** Electron main process, TypeScript, atomic JSON task journal, Web Fetch API streams, Node Buffer, Vitest.

**Spec:** `docs/superpowers/specs/2026-08-31-unified-theme-ci-csp-electron-replicate-design.md`

## Global Constraints

- Durable local intent must be written successfully before a billable provider dispatch starts.
- Same-profile equivalent active submissions dispatch once, including concurrent IPC calls and restart reuse.
- `acceptance-unknown` is explicit and never automatically redispatched.
- Provider tokens, authorization headers, signed output URLs, and complete private payloads are not persisted.
- Preserve Replicate model validation, allowed output hosts, redirect checks, MIME allowlist, 50 MiB cap, signature validation, Local Family Safe Mode screening, and profile isolation.
- Do not route Replicate through the Venice `/video/queue` or `/audio/queue` wire schema.

---

### Task 1: Add explicit provider-neutral submission lifecycle types

**Files:**
- Modify: `src/types/background-task.ts`
- Modify: `src/types/background-task.test.ts`

**Interfaces:**
- Consumes: `BackgroundTask`, `BackgroundTaskStatus`, `serializeTasks()`, and strict task parsing.
- Produces: persisted paid-submission lifecycle fields usable by Venice queues and Replicate.

- [ ] **Step 1: Write failing serialization tests**

```ts
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

const task = makeTask({
  providerId: "replicate",
  operation: "image.generate",
  status: "acceptance_unknown",
  requestFingerprint: "sha256:abc",
  payloadHash: "sha256:def",
  dispatchStartedAt: 123,
});
expect(parseTasks(serializeTasks([task]))[0]).toMatchObject({
  providerId: "replicate",
  operation: "image.generate",
  status: "acceptance_unknown",
  dispatchStartedAt: 123,
});
```

- [ ] **Step 2: Run the focused type tests**

```bash
npx vitest run src/types/background-task.test.ts --no-file-parallelism
```

Expected: fail because the lifecycle status/fields are not accepted by strict parsing.

- [ ] **Step 3: Extend the persisted contract**

```ts
export type BackgroundTaskStatus =
  | "idle"
  | "intent_persisted"
  | "dispatching"
  | "acceptance_unknown"
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "aborted"
  | "timeout";

export interface BackgroundTask {
  // existing fields remain
  operation?: string;
  requestFingerprint?: string;
  payloadHash?: string;
  dispatchStartedAt?: number;
  acceptedAt?: number;
}
```

Migrate legacy `pending_finalize` during parsing or manager hydration: a real remote `queueId` becomes `queued`; a missing or placeholder remote ID becomes `acceptance_unknown`.

- [ ] **Step 4: Verify strict round-trip and legacy migration**

```bash
npx vitest run src/types/background-task.test.ts electron/services/backgroundTaskManager.paidQueue.test.ts --no-file-parallelism
```

- [ ] **Step 5: Commit lifecycle types**

```bash
git add src/types/background-task.ts src/types/background-task.test.ts electron/services/backgroundTaskManager.paidQueue.test.ts
git commit -m "feat: model paid submission lifecycle states"
```

### Task 2: Create the provider-neutral paid-submission manager

**Files:**
- Create: `electron/services/paidSubmissionManager.ts`
- Create: `electron/services/paidSubmissionManager.test.ts`
- Modify: `electron/services/backgroundTaskManager.ts`

**Interfaces:**
- Consumes: canonical task-journal create/update/fatal-flush operations.
- Produces: `submitDurablePaidTask<TAccepted>()` and restart classification.

- [ ] **Step 1: Write failing persistence-order and deduplication tests**

```ts
it("persists intent before dispatch", async () => {
  const events: string[] = [];
  const result = await submitDurablePaidTask({
    provider: "replicate",
    operation: "image.generate",
    profileId: "p1",
    requestFingerprint: "sha256:request",
    payloadHash: "sha256:payload",
    metadata: { model: "owner/model" },
    persistIntent: async () => { events.push("persist"); return makeTask(); },
    dispatch: async () => { events.push("dispatch"); return { remoteTaskId: "pred-1" }; },
    persistAccepted: async () => { events.push("accepted"); return makeTask({ queueId: "pred-1" }); },
  });
  expect(events).toEqual(["persist", "dispatch", "accepted"]);
  expect(result.kind).toBe("submitted");
});

it("does not dispatch when intent persistence fails", async () => {
  const dispatch = vi.fn();
  await expect(submitDurablePaidTask({
    provider: "replicate",
    operation: "image.generate",
    profileId: "p1",
    requestFingerprint: "sha256:request",
    payloadHash: "sha256:payload",
    metadata: { model: "owner/model" },
    persistIntent: vi.fn().mockRejectedValue(new Error("disk full")),
    dispatch,
    getRemoteTaskId: (accepted: { remoteTaskId: string }) => accepted.remoteTaskId,
    persistAccepted: vi.fn(),
    persistAcceptanceUnknown: vi.fn(),
  })).resolves.toMatchObject({ kind: "pre_dispatch_failure" });
  expect(dispatch).not.toHaveBeenCalled();
});
```

Add a `Promise.all` test proving two equivalent concurrent calls invoke `dispatch` once, a different-profile test proving no collision, and a changed-payload test proving an explicit conflict.

- [ ] **Step 2: Define the manager API**

```ts
export interface DurablePaidSubmissionInput<TAccepted> {
  provider: string;
  operation: string;
  profileId: string;
  requestFingerprint: string;
  payloadHash: string;
  metadata: Record<string, string | number | boolean>;
  persistIntent(): Promise<BackgroundTask>;
  dispatch(): Promise<TAccepted>;
  getRemoteTaskId(accepted: TAccepted): string;
  persistAccepted(taskId: string, remoteTaskId: string): Promise<BackgroundTask>;
  persistAcceptanceUnknown(taskId: string, message: string): Promise<BackgroundTask>;
}

export type DurablePaidSubmissionResult =
  | { kind: "submitted"; task: BackgroundTask }
  | { kind: "reused"; task: BackgroundTask }
  | { kind: "acceptance_unknown"; task: BackgroundTask }
  | { kind: "pre_dispatch_failure"; error: string }
  | { kind: "conflict"; error: string };
```

- [ ] **Step 3: Implement atomic in-process check-and-create**

Use a map keyed by `profileId:provider:operation:requestFingerprint:payloadHash`. Perform persisted active-task lookup before starting a new promise, then store the new promise before its first asynchronous dispatch boundary. Remove only the matching promise in `finally`.

- [ ] **Step 4: Classify dispatch failures conservatively**

Define a private `DispatchNotStartedError` for failures proven to occur before request transmission. All other `dispatch()` failures after the durable `dispatching` transition call `persistAcceptanceUnknown()` and return `kind: "acceptance_unknown"`.

- [ ] **Step 5: Expose narrow fatal journal operations from the background manager**

Add functions whose names describe the state transition:

```ts
export async function persistPaidSubmissionIntent(input: BackgroundTaskCreateInput): Promise<BackgroundTask>;
export async function markPaidSubmissionDispatching(taskId: string): Promise<BackgroundTask>;
export async function markPaidSubmissionAccepted(taskId: string, remoteTaskId: string): Promise<BackgroundTask>;
export async function markPaidSubmissionAcceptanceUnknown(taskId: string, error: string): Promise<BackgroundTask>;
export function findActivePaidSubmission(query: { profileId: string; providerId: string; operation: string; requestFingerprint: string; payloadHash?: string }): BackgroundTask | undefined;
```

Each mutating operation updates in-memory state and awaits `flushPersistFatal()` before returning success.

- [ ] **Step 6: Implement restart classification**

During hydration:

```text
intent_persisted with no dispatchStartedAt -> retain as safe first-dispatch candidate; do not dispatch from generic hydration
dispatching -> acceptance_unknown
acceptance_unknown -> retain and do not poll or dispatch
queued/processing with real remote ID -> resume provider polling
terminal -> retain with no dispatch
```

- [ ] **Step 7: Run manager and restart tests**

```bash
npx vitest run electron/services/paidSubmissionManager.test.ts electron/services/backgroundTaskManager.paidQueue.test.ts electron/services/backgroundTaskManager.restart-idempotency.test.ts --no-file-parallelism
```

- [ ] **Step 8: Commit provider-neutral durability**

```bash
git add electron/services/paidSubmissionManager.ts electron/services/paidSubmissionManager.test.ts electron/services/backgroundTaskManager.ts electron/services/backgroundTaskManager.paidQueue.test.ts electron/services/backgroundTaskManager.restart-idempotency.test.ts
git commit -m "feat: add durable paid submission manager"
```

### Task 3: Route Replicate through write-ahead submission

**Files:**
- Modify: `electron/ipc/handlers/replicateHandlers.ts`
- Modify: `electron/ipc/handlers/replicateHandlers.test.ts`
- Modify: `electron/services/backgroundTaskManager.replicate.test.ts`

**Interfaces:**
- Consumes: `submitDurablePaidTask()` and Replicate create/poll services.
- Produces: typed IPC result with no direct prediction-before-task window.

- [ ] **Step 1: Rewrite the handler test to require durable orchestration**

Mock `submitDurablePaidTask` and assert the handler supplies:

```ts
expect(submitDurablePaidTaskMock).toHaveBeenCalledWith(expect.objectContaining({
  provider: "replicate",
  operation: "image.generate",
  profileId: "p1",
  requestFingerprint: expect.stringMatching(/^sha256:/),
  payloadHash: expect.stringMatching(/^sha256:/),
  metadata: { model: "black-forest-labs/flux-schnell" },
  dispatch: expect.any(Function),
}));
```

Assert `createBackgroundTaskInMain` is no longer imported or called by this handler.

- [ ] **Step 2: Add deterministic fingerprinting**

Create a stable serializer for `{ model, input }` that recursively sorts object keys, preserves array order, rejects cyclic values, and hashes UTF-8 bytes with SHA-256. Return lowercase `sha256:<hex>` strings. Do not include the API token or profile ID inside the payload hash; profile scoping is part of the manager key.

- [ ] **Step 3: Map durable outcomes to IPC**

```ts
type ReplicateGenerateImageResult =
  | { ok: true; disposition: "submitted" | "reused"; task: BackgroundTask }
  | { ok: false; disposition: "acceptance_unknown"; task: BackgroundTask; error: string }
  | { ok: false; disposition: "pre_dispatch_failure" | "conflict"; error: string };
```

Redact error text at the handler boundary. Do not return internal stack traces.

- [ ] **Step 4: Run handler and manager integration tests**

```bash
npx vitest run electron/ipc/handlers/replicateHandlers.test.ts electron/services/backgroundTaskManager.replicate.test.ts electron/services/paidSubmissionManager.test.ts --no-file-parallelism
```

- [ ] **Step 5: Commit Replicate integration**

```bash
git add electron/ipc/handlers/replicateHandlers.ts electron/ipc/handlers/replicateHandlers.test.ts electron/services/backgroundTaskManager.replicate.test.ts
git commit -m "fix: journal Replicate submissions before dispatch"
```

### Task 4: Add bounded response-body reading

**Files:**
- Create: `electron/services/boundedResponseReader.ts`
- Create: `electron/services/boundedResponseReader.test.ts`
- Modify: `electron/services/replicateService.ts`
- Modify: `electron/services/replicateService.test.ts`

**Interfaces:**
- Consumes: Fetch `Response`, maximum bytes, deadline, and optional parent abort signal.
- Produces: `readResponseBufferBounded()` and `readResponseTextBounded()`.

- [ ] **Step 1: Write failing reader tests**

Cover declared oversized length, chunked overflow, stalled body after headers, valid body, and timer cleanup:

```ts
await expect(readResponseBufferBounded(response, {
  maxBytes: 16,
  timeoutMs: 25,
  label: "Replicate control response",
})).rejects.toThrow(/timed out/i);
```

- [ ] **Step 2: Implement the bounded reader**

```ts
export interface BoundedReadOptions {
  maxBytes: number;
  timeoutMs: number;
  label: string;
  signal?: AbortSignal;
}

export async function readResponseBufferBounded(
  response: Response,
  options: BoundedReadOptions,
): Promise<Buffer>;

export async function readResponseTextBounded(
  response: Response,
  options: BoundedReadOptions,
): Promise<string> {
  return (await readResponseBufferBounded(response, options)).toString("utf8");
}
```

Reject a numeric `Content-Length` above `maxBytes` before reading. For streamed bodies, race each `reader.read()` against the deadline/abort signal, count actual bytes, cancel the reader in `finally`, and clear all timers/listeners. For non-stream test mocks, race `arrayBuffer()` against the same deadline and validate its final length.

- [ ] **Step 3: Replace Replicate control-plane `response.text()`**

Add exported constants:

```ts
export const MAX_CONTROL_RESPONSE_BYTES = 1024 * 1024;
export const CONTROL_BODY_TIMEOUT_MS = 30_000;
```

Use `readResponseTextBounded` before JSON parsing. A create-prediction timeout or truncated/oversized acceptance response after dispatch is classified as acceptance unknown by the paid-submission manager.

- [ ] **Step 4: Keep the download deadline active through body completion**

Move timer cleanup so it occurs after redirects are handled or `readResponseBufferBounded()` completes. Use `MAX_DOWNLOAD_BYTES` and `DOWNLOAD_TIMEOUT_MS` for the entire final-body read. Preserve manual redirect validation at every hop.

- [ ] **Step 5: Run bounded-read and Replicate tests**

```bash
npx vitest run electron/services/boundedResponseReader.test.ts electron/services/replicateService.test.ts --no-file-parallelism
```

- [ ] **Step 6: Commit bounded network reads**

```bash
git add electron/services/boundedResponseReader.ts electron/services/boundedResponseReader.test.ts electron/services/replicateService.ts electron/services/replicateService.test.ts
git commit -m "fix: bound Replicate response body reads"
```

### Task 5: Run Replicate security and lifecycle regression gates

**Files:**
- Modify only for factual contract updates: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: completed durability and network-read implementation.
- Produces: evidence that no prior provider boundary regressed.

- [ ] **Step 1: Search for bypass paths**

```bash
rg -n 'createReplicatePrediction\(' electron src --glob '*.ts'
rg -n 'response\.text\(\)|response\.json\(\)' electron/services/replicateService.ts
```

Expected: prediction creation is reachable through the durable submission adapter; no unbounded Replicate response reads remain.

- [ ] **Step 2: Run focused and broad Electron tests**

```bash
npx vitest run electron/services/paidSubmissionManager.test.ts electron/services/boundedResponseReader.test.ts electron/services/replicateService.test.ts electron/ipc/handlers/replicateHandlers.test.ts electron/services/backgroundTaskManager.replicate.test.ts electron/services/backgroundTaskManager.paidQueue.test.ts electron/services/backgroundTaskManager.restart-idempotency.test.ts --no-file-parallelism
npm run test:electron
npm run typecheck
```

- [ ] **Step 3: Verify no secrets entered persistence fixtures**

```bash
rg -n 'Authorization|Bearer r8_|replicate\.delivery/.+\?' electron/services/paidSubmissionManager.ts electron/services/backgroundTaskManager.ts src/types/background-task.ts
```

Expected: no persisted field or log contains those values. Test-only token fixtures remain confined to test files.
