# Electron Test Typecheck Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the dedicated Electron test project's compiler debt and make it a permanent part of the canonical typecheck contract.

**Architecture:** Fix each diagnostic at its owning test fixture, mock, or shared type boundary without compiler suppression. Introduce small typed test helpers where repeated IPC `unknown` and mock-signature problems share one cause, then append the passing project to `npm run typecheck` and enforce that script contract.

**Tech Stack:** TypeScript 5.8 strict mode, Electron 43 types, Vitest 4 mocks, Node.js 22.

**Spec:** `docs/superpowers/specs/2026-08-31-unified-theme-ci-csp-electron-replicate-design.md`

## Global Constraints

- Preserve the existing dirty `tsconfig.electron.test.json` diff and inspect it before editing.
- Do not add `@ts-ignore`, `@ts-expect-error`, blanket `any`, weaker strictness, or source/test exclusions.
- Production discriminated unions remain authoritative; tests narrow them before field access.
- Test fixtures must satisfy current production contracts rather than casting incomplete objects.
- The final canonical typecheck is `tsc --noEmit && tsc --noEmit --project tsconfig.electron.json && tsc --noEmit --project tsconfig.electron.test.json`.

---

### Task 1: Lock the compiler project and diagnostic inventory

**Files:**
- Modify: `tsconfig.electron.test.json`
- Read: `/tmp/venice-forge-electron-test-tsc-baseline.log`

**Interfaces:**
- Consumes: `tsconfig.electron.json` and Vitest globals.
- Produces: a strict no-emit project covering Electron source and Electron tests.

- [ ] **Step 1: Assert the test project contract**

The effective file must retain this shape:

```json
{
  "extends": "./tsconfig.electron.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["electron/**/*"],
  "exclude": ["node_modules", "src", "dist", "dist-electron"]
}
```

- [ ] **Step 2: Regenerate a per-file diagnostic inventory**

```bash
npx tsc --noEmit --project tsconfig.electron.test.json 2>&1 | tee /tmp/venice-forge-electron-test-tsc.log
rg 'error TS[0-9]+' /tmp/venice-forge-electron-test-tsc.log | sed 's/(.*//' | sort | uniq -c | sort -nr
```

Expected initial leaders: `electron/ipc/handlers.test.ts` 23, document-agent attachment tests 19, agent-tool-executor tests 17, background-task handler tests 13, and provider-adapter tests 12.

### Task 2: Add typed IPC test invocation and result narrowing helpers

**Files:**
- Create: `electron/test/ipcTestHelpers.ts`
- Modify: `electron/ipc/handlers.test.ts`
- Modify: `electron/ipc/handlers/backgroundTaskHandlers.test.ts`
- Modify: `electron/ipc/handlers/documentAgentHandlers.attachments.test.ts`
- Modify: `electron/ipc/handlers/replicateHandlers.test.ts`

**Interfaces:**
- Consumes: captured IPC handlers returning `unknown`.
- Produces: `invokeCapturedHandler<TResult>()`, `expectOkResult()`, and `expectErrorResult()`.

- [ ] **Step 1: Write helper tests through the first failing consumer**

Replace an untyped invocation with:

```ts
const result = await invokeCapturedHandler<{ ok: true; task: BackgroundTask }>(
  capturedHandlers,
  "background:list",
  { sender: mockWebContents },
);
expect(result.ok).toBe(true);
```

Run:

```bash
npx tsc --noEmit --project tsconfig.electron.test.json
```

Expected: fail because `invokeCapturedHandler` does not exist.

- [ ] **Step 2: Implement the typed helper**

```ts
export async function invokeCapturedHandler<TResult>(
  handlers: ReadonlyMap<string, (...args: unknown[]) => unknown>,
  channel: string,
  ...args: unknown[]
): Promise<TResult> {
  const handler = handlers.get(channel);
  if (!handler) throw new Error(`No handler registered for ${channel}`);
  return await handler(...args) as TResult;
}

export function expectOkResult<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: true }> {
  expect(result.ok).toBe(true);
}

export function expectErrorResult<T extends { ok: boolean }>(
  result: T,
): asserts result is Extract<T, { ok: false }> {
  expect(result.ok).toBe(false);
}
```

- [ ] **Step 3: Migrate repeated `unknown` result assertions**

Use explicit local result unions matching the handler contract. Narrow with `expectOkResult` or `expectErrorResult` before accessing `task`, `data`, or `error`.

- [ ] **Step 4: Verify the affected files have no diagnostics**

```bash
npx tsc --noEmit --project tsconfig.electron.test.json 2>&1 | tee /tmp/electron-tsc-after-ipc.log
! rg 'electron/ipc/handlers\.test\.ts|backgroundTaskHandlers\.test\.ts|documentAgentHandlers\.attachments\.test\.ts|replicateHandlers\.test\.ts' /tmp/electron-tsc-after-ipc.log
```

- [ ] **Step 5: Commit the typed IPC test boundary**

```bash
git add electron/test/ipcTestHelpers.ts electron/ipc/handlers.test.ts electron/ipc/handlers/backgroundTaskHandlers.test.ts electron/ipc/handlers/documentAgentHandlers.attachments.test.ts electron/ipc/handlers/replicateHandlers.test.ts
git commit -m "test: type Electron IPC handler fixtures"
```

### Task 3: Repair agent runtime union narrowing and mock signatures

**Files:**
- Modify: `electron/agent/runtime/agent-tool-executor.test.ts`
- Modify: `electron/agent/runtime/chat-agent-runner.telemetry.test.ts`
- Modify: `electron/agent/runtime/chat-agent-runner.test.ts`
- Modify: `electron/agent/runtime/trusted-agent-request.test.ts`

**Interfaces:**
- Consumes: `ToolResult`, `CustomAgentLayer`, and current runtime callable signatures.
- Produces: test assertions that compile against the real discriminated unions.

- [ ] **Step 1: Replace direct union-field access with discriminant narrowing**

Use:

```ts
expect(result.ok).toBe(true);
if (!result.ok) throw new Error(result.error.message);
expect(result.data).toEqual(expectedData);
```

For failure cases:

```ts
expect(result.ok).toBe(false);
if (result.ok) throw new Error("Expected tool failure");
expect(result.error.code).toBe("PERMISSION_DENIED");
```

- [ ] **Step 2: Type hoisted forwarding mocks from their source functions**

Replace untyped spreads with:

```ts
const requestMock = vi.fn<Parameters<typeof trustedAgentRequest>, ReturnType<typeof trustedAgentRequest>>();
```

If Vitest's installed overload uses a single function generic, use:

```ts
const requestMock = vi.fn<typeof trustedAgentRequest>();
```

Call the mock with the exact required three arguments rather than forwarding an inferred empty tuple.

- [ ] **Step 3: Build complete custom-layer fixtures**

```ts
const customLayer: CustomAgentLayer = {
  kind: "custom",
  name: "test-layer",
  content: "test instructions",
};
```

Do not assign `TrustedRuntimeLayer` or `ToolRuntimeLayer` to a `CustomAgentLayer` fixture.

- [ ] **Step 4: Run the runtime tests and compiler**

```bash
npx vitest run electron/agent/runtime/agent-tool-executor.test.ts electron/agent/runtime/chat-agent-runner.telemetry.test.ts electron/agent/runtime/chat-agent-runner.test.ts electron/agent/runtime/trusted-agent-request.test.ts --no-file-parallelism
npx tsc --noEmit --project tsconfig.electron.test.json
```

- [ ] **Step 5: Commit the runtime test repairs**

```bash
git add electron/agent/runtime/agent-tool-executor.test.ts electron/agent/runtime/chat-agent-runner.telemetry.test.ts electron/agent/runtime/chat-agent-runner.test.ts electron/agent/runtime/trusted-agent-request.test.ts
git commit -m "test: align agent runtime fixtures with strict types"
```

### Task 4: Repair complete service fixtures and platform mocks

**Files:**
- Modify: `electron/services/providerAdapters.test.ts`
- Modify: `electron/services/chatFolderBackupService.test.ts`
- Modify: `electron/services/chatStorage.test.ts`
- Modify: `electron/services/bridgeServer.test.ts`
- Modify: `electron/services/windowsCredentialStore.test.ts`
- Modify: `electron/services/themeService.test.ts`
- Modify: `electron/services/configService.test.ts`
- Modify: `electron/services/syncFolderWatcher.test.ts`
- Modify: `electron/services/syncBridge.test.ts`
- Modify: `electron/services/backgroundTaskManager.test.ts`
- Modify: `electron/services/backgroundTaskManager.paidQueue.test.ts`
- Modify: `electron/services/backgroundTaskManager.restart-idempotency.test.ts`
- Modify: `electron/services/videoRetrieveService.telemetry.test.ts`
- Modify: `electron/services/secureStore.test.ts`
- Modify: `electron/ipc/updates.test.ts`
- Modify: `electron/ipc/configHandlers.test.ts`

**Interfaces:**
- Consumes: current production constructor arguments, `BackgroundTask`, filesystem result types, and Electron platform APIs.
- Produces: complete, typed service fixtures with no production cast escape hatches.

- [ ] **Step 1: Replace incomplete background-task literals**

Use a local factory:

```ts
function makeBackgroundTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "task-1",
    type: "image",
    status: "queued",
    profileId: "profile-1",
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}
```

- [ ] **Step 2: Type environment restoration without assigning `undefined`**

```ts
const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});
```

When the property was absent, use `vi.unstubAllGlobals()` instead of assigning an optional function.

- [ ] **Step 3: Match filesystem and Electron mock signatures**

Use `vi.fn<typeof fs.readFile>()`, `vi.fn<typeof fs.writeFile>()`, and the exact imported function type. Supply every required argument and return a value accepted by the declared overload.

- [ ] **Step 4: Fix source-owned type incompatibilities only when tests expose a real contract defect**

If a production return type contradicts all call sites, update the production signature and its focused test together. Do not change runtime behavior merely to quiet a fixture.

- [ ] **Step 5: Run service tests and the standalone compiler**

```bash
npm run test:electron
npx tsc --noEmit --project tsconfig.electron.test.json
```

Expected: zero TypeScript diagnostics.

- [ ] **Step 6: Commit the service fixture repairs**

Stage only the service and IPC test paths actually changed, then:

```bash
git diff --cached --check
git commit -m "test: complete Electron service fixtures"
```

### Task 5: Add the Electron test project to canonical typecheck

**Files:**
- Modify: `package.json`
- Modify: `package-scripts.test.ts`
- Modify if canonical script test lives elsewhere: the existing script-contract test identified by `rg 'tsconfig.electron.json' --glob '*.test.ts'`.

**Interfaces:**
- Consumes: a zero-error `tsconfig.electron.test.json` project.
- Produces: canonical script containing all three compiler commands.

- [ ] **Step 1: Write the failing script-contract assertion**

```ts
expect(pkg.scripts.typecheck).toBe(
  "tsc --noEmit && tsc --noEmit --project tsconfig.electron.json && tsc --noEmit --project tsconfig.electron.test.json",
);
```

- [ ] **Step 2: Run the focused contract test**

```bash
npx vitest run package-scripts.test.ts --no-file-parallelism
```

Expected: fail because the third compiler project is absent.

- [ ] **Step 3: Update the script**

```json
"typecheck": "tsc --noEmit && tsc --noEmit --project tsconfig.electron.json && tsc --noEmit --project tsconfig.electron.test.json"
```

- [ ] **Step 4: Run the terminal validation**

```bash
npx vitest run package-scripts.test.ts --no-file-parallelism
npx tsc --noEmit --project tsconfig.electron.test.json
npm run typecheck
npm run test:electron
```

- [ ] **Step 5: Commit canonical integration**

```bash
git add package.json package-scripts.test.ts tsconfig.electron.test.json
git diff --cached --check
git commit -m "build: typecheck Electron tests"
```

If the script-contract test is not `package-scripts.test.ts`, stage the discovered canonical test path instead.
