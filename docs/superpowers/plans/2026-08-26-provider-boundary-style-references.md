# Provider Boundary and Image Studio Style References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close `PROV-001` and `PROV-005` by enforcing provider-and-operation request allowlists and adding runtime-gated, fail-closed style references to Image Studio.

**Architecture:** The main-process provider router sanitizes a request into a fresh provider-operation body before any adapter transform executes. Image Studio resolves runtime style-reference capabilities once, loads bounded local image references into the existing `ImageDraftLike.references` contract, and leaves final serialization to `buildImagePayload()`.

**Tech Stack:** TypeScript 5.8, Electron 43, React 19, Zustand 5, Vitest 4, Testing Library, i18next.

**Spec:** `docs/superpowers/specs/2026-08-26-provider-boundary-style-references-design.md`

## Global Constraints

- Work only on local `main` and preserve the existing user-authored `docs/summary_of_work.md` addition.
- Keep Replicate on its dedicated prediction lifecycle; do not add it to the generic adapter.
- Use runtime `/models` metadata through `resolveStyleReferenceCapabilities()`; add no static production model assumptions.
- Missing, malformed, disabled, or non-positive runtime reference capability metadata fails closed.
- Add no direct renderer filesystem or provider access.
- Localize every new visible string and retain native HTML control accessibility.
- Record only validation commands actually executed and results actually observed.

---

### Task 1: Provider-and-operation request policy

**Files:**
- Modify: `electron/services/providerAdapters.ts`
- Test: `electron/services/providerAdapters.test.ts`
- Test: `scripts/verify-provider-adapters.test.ts`

**Interfaces:**
- Consumes: `ProviderId`, canonical endpoints from `PROVIDER_CAPABILITIES`, existing `AdapterFn` and `ProviderRoute.transformBody`.
- Produces: `sanitizeProviderRequestBody(providerId: ProviderId, endpoint: string, body: Record<string, unknown>): Record<string, unknown>` and a router that passes only the sanitized body to adapter transforms.

- [ ] **Step 1: Add failing contract tests for Venice-field and cross-operation rejection**

Add a table-driven test that resolves each active generic chat adapter and supplies standard supported fields together with `venice_parameters`, `safe_mode`, `return_binary`, `enable_web_search`, `style_references`, `negative_prompt`, `width`, and `height`. Assert that the transformed request retains the adapter's documented standard controls but contains none of the Venice-only or image-only fields. Add a Together image test that supplies image controls plus chat-only fields and asserts the inverse boundary. Cover both prefixed model routing and the `selection` automatic-fallback argument.

- [ ] **Step 2: Run the focused tests and observe the current leak**

Run:

```bash
npx vitest run electron/services/providerAdapters.test.ts scripts/verify-provider-adapters.test.ts --no-file-parallelism
```

Expected pre-fix result: at least one new assertion fails because spread-based adapters retain unapproved input fields.

- [ ] **Step 3: Implement fresh-object provider operation policies**

Define readonly field sets per provider and endpoint. Implement sanitization by iterating the selected allowlist and copying only own properties with non-`undefined` values. Always assign the resolved real model after sanitization. Invoke the sanitizer before calling an adapter's original `transformBody`; do not sanitize only the already-transformed result. Keep provider-specific transforms responsible for Anthropic, Cohere, Gemini, and deployment mapping.

The implementation shape is:

```ts
type ProviderOperationPolicy = Readonly<Partial<Record<ProviderId, Readonly<Record<string, readonly string[]>>>>>;

export function sanitizeProviderRequestBody(
  providerId: ProviderId,
  endpoint: string,
  body: Record<string, unknown>,
): Record<string, unknown> {
  const allowedFields = PROVIDER_OPERATION_FIELDS[providerId]?.[endpoint];
  if (!allowedFields) return {};
  return Object.fromEntries(
    allowedFields
      .filter((field) => Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined)
      .map((field) => [field, body[field]]),
  );
}
```

Use provider-specific lists sourced from official provider request documentation and the repository's implemented adapter contract. Do not use one broad OpenAI-compatible list for providers whose documented fields differ.

- [ ] **Step 4: Run the provider tests and verifier**

Run:

```bash
npx vitest run electron/services/providerAdapters.test.ts scripts/verify-provider-adapters.test.ts --no-file-parallelism
npm run verify:provider-adapters
```

Expected result: all provider adapter regression and static contract tests pass.

### Task 2: Style-reference file normalization

**Files:**
- Create: `src/utils/styleReferenceFiles.ts`
- Create: `src/utils/styleReferenceFiles.test.ts`

**Interfaces:**
- Consumes: browser `File`, supported MIME types, and the existing `ImageDraftLike.references` item shape.
- Produces: `readStyleReferenceFile(file: File): Promise<StyleReferenceInput>` and `StyleReferenceInput` with `entityId`, `name`, `mimeType`, `contentHash`, `data`, and `strength`.

- [ ] **Step 1: Write failing normalization tests**

Cover PNG/JPEG/WebP acceptance, unsupported MIME rejection, empty-file rejection, base64 extraction without a duplicated data-URL prefix, stable content hash creation, and default strength `0.5`.

- [ ] **Step 2: Run the utility test and observe the missing module failure**

Run:

```bash
npx vitest run src/utils/styleReferenceFiles.test.ts --no-file-parallelism
```

Expected pre-fix result: the new module cannot be imported.

- [ ] **Step 3: Implement the bounded pure conversion helper**

Validate `file.type` against `image/png`, `image/jpeg`, and `image/webp`; reject zero bytes; read with `FileReader.readAsDataURL`; split the base64 payload once; and derive the stable content hash through the same deterministic identity helper used by Character Scene references. Generate an opaque `entityId` without exposing a local path.

- [ ] **Step 4: Run the utility test**

Run:

```bash
npx vitest run src/utils/styleReferenceFiles.test.ts --no-file-parallelism
```

Expected result: all normalization and rejection tests pass.

### Task 3: Runtime-gated Image Studio controls and payload wiring

**Files:**
- Modify: `src/components/image/image-view.tsx`
- Test: `src/components/image/image-view.test.tsx`
- Modify: `src/i18n/resources/en-US/media.json`
- Modify mechanically: other locale `media.json` catalogs through the canonical catalog sync command

**Interfaces:**
- Consumes: `resolveStyleReferenceCapabilities(model, modelData?.model_spec)`, `readStyleReferenceFile()`, and `buildImagePayload()`.
- Produces: an accessible style-reference control that exists only while `StyleReferenceCapabilities.supported === true && maxReferences > 0`, and payload builder inputs `supportsReferences`, `maxStyleReferences`, `supportsStyleReferenceStrength`, and `references`.

- [ ] **Step 1: Add failing component tests for supported and fail-closed states**

Mock runtime model entries for: supported with strength, supported without strength, explicitly disabled, missing metadata, and a supported model with maximum zero. Assert control visibility, accessible names, add/remove behavior, maximum-count enforcement, strength visibility, serialized `style_references`, strength omission, and cleanup after switching to an unsupported model.

- [ ] **Step 2: Run the focused Image Studio test and observe missing control failures**

Run:

```bash
npx vitest run src/components/image/image-view.test.tsx --no-file-parallelism
```

Expected pre-fix result: supported-model tests cannot find the style-reference controls and generation requests contain no `style_references`.

- [ ] **Step 3: Resolve capability state once and wire generation**

Create one memoized `styleReferenceCapabilities` value and pass it to enhancer facts and generation. Keep references in component state. Clear them in an effect whenever support becomes false; trim them whenever the runtime maximum decreases. Pass the exact runtime values and current references into `buildImagePayload()`.

- [ ] **Step 4: Add the accessible controls**

Render the section only when runtime capability evidence is affirmative and the maximum is positive. Use an associated file-input label, `accept="image/png,image/jpeg,image/webp"`, a status/count description, native range inputs for supported strength, and named remove buttons. Disable the file input at the runtime maximum. Report rejected files through the existing toast store without including local paths or file contents.

- [ ] **Step 5: Add source-language keys and synchronize catalogs**

Add scoped `imageStudioRuntime` keys for the section label, help/count text, file chooser, selected reference, strength, remove action, unsupported file error, empty file error, and limit notification. Run the existing catalog synchronization command identified from `package.json`; do not manually invent non-English translations.

- [ ] **Step 6: Run focused UI, capability, payload, and localization tests**

Run:

```bash
npx vitest run src/components/image/image-view.test.tsx src/config/image-model-capabilities.test.ts src/utils/payloadBuilders.modelAware.test.ts src/utils/styleReferenceFiles.test.ts --no-file-parallelism
npm run verify:i18n
npm run verify:i18n-hardcoded-regressions
```

Expected result: all focused tests and localization gates pass.

### Task 4: Canonical documentation and full requested validation

**Files:**
- Modify: `docs/ROADMAP.md`
- Modify: `docs/summary_of_work.md`

**Interfaces:**
- Consumes: final changed-file list and actual command outputs.
- Produces: truthful closure entries for `PROV-001` and `PROV-005`, with external paid-provider and headed accessibility acceptance still open.

- [ ] **Step 1: Run the requested repository gates**

Run serially:

```bash
npm run lint:eslint
npm run typecheck
npm run verify:contracts
npm run build
```

Record exact pass/fail results and separate task-caused failures from unrelated pre-existing failures.

- [ ] **Step 2: Update the canonical roadmap and session handoff**

Mark only `PROV-001` and `PROV-005` locally closed. Preserve the existing CodeQL session entry in `docs/summary_of_work.md`, update `Latest Session Summary`, append a dated Session History entry, and record only commands executed in this worktree. Keep `VF-VERIFY-005` externally blocked.

- [ ] **Step 3: Re-run documentation and contract-sensitive gates after documentation changes**

Run:

```bash
npm run verify:markdown-links
npm run verify:agent-docs
npm run verify:roadmap-current
```

Expected result: documentation links, handoff rules, and roadmap freshness pass.

### Task 5: Commit, publish, and verify remote main

**Files:**
- Stage only the scoped implementation, tests, localized catalogs, roadmap, handoff, spec, and plan.

**Interfaces:**
- Consumes: validated local `main` changes and remote state.
- Produces: complete local commits pushed directly to `origin/main` with remote SHA verification.

- [ ] **Step 1: Inspect all repository state**

Run:

```bash
test "$(git branch --show-current)" = "main"
git symbolic-ref --quiet --short HEAD | grep -qx 'main'
git status --short
git diff
git diff --cached
git remote -v
git branch -vv
```

Confirm the existing user-authored handoff text is preserved and intentionally incorporated only in the final documentation commit.

- [ ] **Step 2: Stage explicitly and commit logical changes**

Stage named task files only, inspect `git diff --cached`, and create concise imperative commits. Do not use `git add .`, `git add -A`, `git commit -a`, or history rewriting.

- [ ] **Step 3: Verify that remote main has not advanced**

Run:

```bash
git fetch origin main
git rev-list --left-right --count origin/main...main
git log --oneline origin/main..main
```

Stop without pushing if `origin/main` contains commits absent from local `main`.

- [ ] **Step 4: Push and verify the exact remote commit**

Run:

```bash
git push
LOCAL_HEAD="$(git rev-parse main)"
REMOTE_HEAD="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
test -n "$REMOTE_HEAD"
test "$LOCAL_HEAD" = "$REMOTE_HEAD"
```

Expected result: remote `main` resolves to the validated local `main` commit.
