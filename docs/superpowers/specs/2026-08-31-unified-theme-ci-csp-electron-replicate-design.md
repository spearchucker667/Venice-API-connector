# Unified Theme, CI, CSP, Electron Typecheck, and Replicate Durability Design

> **Status:** Approved for implementation planning on 2026-08-31.
> **Source:** User-provided unified implementation handoff, reconciled against local `main` at `5ee33ab4950f1ec059f9f7ebf5492848833e8ac1`.

## Objective

Complete and integrate five coordinated workstreams without losing or misattributing the intentionally dirty starting worktree:

1. Theme Engine V2, YAML V2, dual light/dark variants, migration, persistence, ThemeMaker, and semantic styling.
2. CI script coverage, artifact verification, release-staging cleanup, and packaged smoke hardening.
3. Strict Electron test/shared-source TypeScript compilation in the canonical typecheck gate.
4. CSP-safe Meteocon SVG rendering without weakening production `style-src`.
5. Durable, deduplicated, restart-safe Replicate paid submissions with bounded network reads.

The implementation must preserve the Electron privilege boundary, provider secret custody, Local Family Safe Mode, profile isolation, existing SSRF and media validation, user data compatibility, and unrelated uncommitted changes.

## Reconciled Starting State

- Branch: local `main`.
- Starting commit: `5ee33ab4950f1ec059f9f7ebf5492848833e8ac1`.
- Starting remote state: local `HEAD`, `origin/main`, and `origin/HEAD` resolved to the same commit during design reconciliation.
- The worktree already contains a large uncommitted Theme Engine V2 and CI/package implementation. It is inherited work that must be reviewed and validated, not discarded or accepted solely from its session notes.
- `npx tsc --noEmit --project tsconfig.electron.test.json` currently reports 146 diagnostics and exits non-zero.
- The canonical `typecheck` script does not yet compile `tsconfig.electron.test.json`.
- Production renderer CSP intentionally keeps `style-src 'self'`; Meteocon SVGs are imported as raw strings and adapted before `dangerouslySetInnerHTML` rendering.
- Replicate submission still precedes durable background-task creation in the IPC handler.
- The existing paid-queue manager already implements useful write-ahead, fingerprinting, in-flight deduplication, ambiguity, and restart primitives for Venice video/audio operations.
- Replicate control-plane response reading still includes an unbounded `response.text()` path.
- The active shell used during reconciliation reported Node `v22.13.1`, below the repository's declared `>=22.15.0` minimum. Implementation validation must use the `.nvmrc`-selected compatible runtime.

Inherited validation statements in `docs/summary_of_work.md` are evidence to recheck against the final integrated tree, not proof that the unified task is complete.

## Worktree Ownership and Git Strategy

All implementation occurs on local `main`. No feature branch, task branch, extra worktree, pull request, history rewrite, stash, reset, blanket restore, or force push is permitted.

Before changing a dirty file, inspect its full starting diff and preserve unrelated hunks. Maintain a working ownership ledger with three categories:

- inherited changes that implement one of the five workstreams;
- new changes made to finish the unified task;
- unrelated user-authored changes that must remain unstaged and uncommitted.

Use explicit file staging. Produce logically scoped commits only after their relevant validation passes. Before publication, fetch remote metadata and stop if remote `main` contains commits absent from local `main`. Push only local `main` to remote `main`, then verify the remote SHA equals the local SHA.

## Integrated Architecture

### 1. Electron Test Typecheck

The dedicated Electron test project becomes a first-class compiler boundary:

```text
renderer source typecheck
+ Electron main source typecheck
+ Electron tests/shared-source typecheck
= canonical npm run typecheck
```

Repair diagnostics by ownership category:

- discriminated unions must be narrowed before accessing success or failure fields;
- mocks must preserve the callable signature of the mocked dependency;
- fixtures must contain the required fields of the production contract;
- IPC test helpers must return typed results instead of leaking `unknown`;
- tuple and spread use must match the mocked function signature;
- shared-source inclusion must be made intentional rather than suppressed.

Prohibited compiler fixes include `@ts-ignore`, broad `any`, relaxed strictness, skipping test folders, disabling `noEmit`, or excluding production-shared files merely to obtain a green result.

Once the standalone project passes, append it to `package.json`'s canonical `typecheck` command and add or update a contract test proving the command retains the Electron test project.

### 2. CSP-Safe Meteocon Boundary

Production CSP remains strict. The implementation must not add `'unsafe-inline'`, wildcard sources, `data:`, or `blob:` to `style-src` to accommodate bundled icons.

The Meteocon path is:

```text
@meteocons SVG source
→ Vite ?raw import
→ theme adaptation/sanitization
→ dangerouslySetInnerHTML
→ packaged renderer
```

The narrowest existing ownership boundary should transform supported SVG presentation declarations into safe SVG presentation attributes and remove the original `style` attribute. The allowed property set must be explicit. Unsupported properties, malformed declarations, event handlers, unsafe URLs, external-resource references, dangerous elements, and arbitrary attributes must not be promoted into output.

If correcting the checked-in or generated asset source is demonstrably simpler and stable across builds, that is preferable to per-render work. Do not create a second general SVG pipeline.

Regression coverage must prove:

- a known affected raw icon is transformed;
- output contains no prohibited inline style;
- required visual presentation attributes survive;
- unrelated safe markup remains stable;
- malformed or unsupported style declarations do not become arbitrary attributes;
- the built renderer assets remain free of the prohibited pattern;
- packaged smoke continues observing production CSP failures without a weaker policy.

### 3. Provider-Neutral Paid-Submission Durability

Replicate must use a provider-neutral durability primitive derived from or shared with the existing paid-queue lifecycle. It must not be forced into Venice video/audio payload schemas, and provider-specific behavior must not turn `backgroundTaskManager.ts` into a Replicate monolith.

Responsibility split:

```text
Durable paid-submission manager
  - canonical request fingerprint
  - profile-scoped active deduplication
  - atomic check-and-create behavior
  - write-ahead persistence
  - durable lifecycle transitions
  - restart classification

Replicate adapter
  - model and input validation
  - provider request construction
  - acceptance response validation
  - status polling and cancellation
  - trusted output URL and media validation

Bounded network reader
  - connection/request deadline integration
  - response-body deadline
  - declared-length precheck
  - streamed byte cap
  - abort and timer cleanup
  - bounded error-body extraction
```

The canonical lifecycle is:

```text
validate request
→ derive stable provider/operation/profile/request fingerprint
→ atomically create or reuse a durable local intent
→ confirm intent persistence
→ persist dispatching transition
→ perform the paid provider request once
→ persist accepted remote ID
   or persist acceptance-unknown
→ resume polling/reconciliation without blind redispatch
```

If intent persistence fails, no provider request occurs.

Equivalent active requests in the same profile reuse or return the existing submission according to the typed IPC contract. Different profiles and meaningfully different requests do not collide. Concurrent duplicate IPC calls must yield one durable record and one provider dispatch.

The request fingerprint uses deterministic serialization of stable, semantically relevant fields. It excludes timestamps, transient local IDs, tokens, authorization headers, and other secrets. Full sensitive prompts or payloads must not be written to diagnostics merely to explain a fingerprint.

Lifecycle states must distinguish at least:

- durable intent with dispatch proven not started;
- dispatch possibly started;
- remote acceptance known with a durable remote ID;
- acceptance unknown;
- running/recovering;
- terminal success, failure, or cancellation.

After any outcome where the provider may have accepted the request, automatic resubmission is prohibited unless a verified provider idempotency or reconciliation contract makes it safe. On restart:

- an intent proven never dispatched may be eligible for first dispatch;
- a dispatch-in-progress record is conservatively reclassified as acceptance unknown;
- acceptance-unknown records are retained without blind retry;
- accepted/running records with a remote ID resume polling;
- terminal records never redispatch.

When the provider returns a remote prediction ID, persist that ID before treating the task as safely recoverable or beginning normal background polling.

Durable records and IPC results must not expose provider tokens, authorization headers, secret-bearing request bodies, internal stack traces, or prohibited signed URLs.

### 4. Bounded Replicate Network Reads

Control-plane and media reads require distinct, explicit bounds.

Control-plane response reading must enforce a small maximum byte count and a body-read deadline. It must not use unbounded `response.text()` or `response.json()` on provider-controlled data.

Output download reading must keep its deadline active until the body is fully consumed. It must reject an oversized declared `Content-Length` before reading and also count actual streamed bytes so a chunked response without a trustworthy length cannot exceed the existing 50 MiB output cap.

Tests cover:

- headers arrive but the body stalls;
- declared length exceeds the limit;
- chunked content exceeds the actual byte limit;
- oversized control-plane JSON;
- valid content under the limit;
- success and failure timer cleanup;
- preservation of redirect, host, MIME, signature, and token checks.

### 5. Theme Engine V2

The inherited theme implementation is reconciled against one canonical model:

```text
ThemeFamily
  schemaVersion: 2
  id
  name
  aliases
  variants.light.tokens
  variants.dark.tokens

AppearanceMode
  light | dark | system

ResolvedTheme
  family identity
  effective light/dark mode
  complete semantic tokens
```

Theme family identity and appearance preference are persisted independently. Changing light, dark, or system mode never substitutes an unrelated family ID.

One validator and normalizer pipeline applies to built-in, custom, and YAML themes. One registry owns collision and alias rules. One resolver combines family plus effective appearance. The DOM applicator only applies an already resolved theme through allowlisted semantic CSS variables and theme metadata.

YAML V2 validation occurs before normalization and rejects unknown structure, dangerous object keys, invalid IDs, built-in collisions, unsupported token names, invalid colors, and arbitrary CSS injection. Failed import is atomic and leaves the active theme unchanged. Serialization is deterministic and round-trippable.

Legacy IDs, single-mode themes, custom themes, and persisted settings migrate deterministically without losing valid user data. A missing variant may be generated only through an explicit, deterministic family-preserving migration policy; it must never silently resolve to an unrelated generic theme.

ThemeMaker edits a complete family. Its Light and Dark controls select a preview/editing variant, not a different theme ID. Preview and runtime use the same resolver. Save, apply, cancel, import, and export operate on the entire family.

The inherited Theme Engine V2 diff must be reviewed for these contracts and retested after the Electron, CSP, and Replicate changes are integrated.

### 6. CI, Packaging, and Release Staging

The inherited workflow changes remain subject to final-tree verification.

Required topology:

- Node comes from `.nvmrc`.
- Script coverage runs through `npm run test:coverage:scripts`.
- The build job requires script coverage.
- Theme verification runs in canonical CI/contracts.
- Existing audit policy remains intentional and documented.
- Platform-sensitive and packaged smoke jobs retain their dependency ordering.
- External actions stay pinned to immutable SHAs.

Release cleanup may remove only explicitly allowlisted staging directories. It must refuse the repository root, release root, filesystem root, traversal, symlink escape, and unknown directory names. Packaged smoke consumes unpacked applications before cleanup; `verify-dist` consumes final artifacts after cleanup and rejects unknown release entries. Cleanup remains idempotent and cross-platform.

## Error and User-Visible Semantics

- Invalid theme or YAML input fails atomically and preserves the previous active configuration.
- CSP transformation rejects or removes unsupported presentation input without relaxing renderer policy.
- A Replicate error proven to occur before dispatch may be represented as safely retryable.
- A Replicate error after dispatch may have begun is `acceptance-unknown`, not a generic retryable failure.
- IPC exposes structured states for new submission, reused active submission, recovering accepted task, acceptance unknown, and pre-dispatch hard failure.
- If no current UI consumes an ambiguity state, backend state must still remain accurate and representable; misleading automatic retry UI must not be introduced.
- Logs use established redaction and safe diagnostic metadata only.

## Test Strategy

Use failing focused tests before or with each behavior change, then broaden after each tranche.

### Focused Gates

- `npx tsc --noEmit --project tsconfig.electron.test.json`
- Electron compiler contract tests
- Meteocon transformation and sanitizer tests
- raw/build CSP verifier tests
- packaged Electron CSP smoke
- Replicate service bounded-read tests
- Replicate IPC submission-order tests
- paid-submission persistence, deduplication, crash-window, and restart tests
- theme schema, YAML, migration, resolver, persistence, ThemeMaker, and catalog tests
- CI contract, script coverage, release cleanup, and distribution verifier tests

### Broad Gates

Run the repository-required sequence with a compatible `.nvmrc` runtime:

```bash
npm run lint:eslint
npm run typecheck
npm test
npm run verify:safety-guard
npm run verify:markdown-links
npm run verify:contracts
npm run build
npm run ci
```

Also run relevant i18n checks after visible UI changes, standalone theme and CSP verifiers, script coverage, release metadata/distribution checks, and the strongest feasible packaged application sequence.

Run repository Vitest suites serially where shared IndexedDB or global-state contracts require it. Do not weaken a gate, fixture, expected result, sanitizer, CSP, or coverage threshold to obtain a pass.

## Documentation and Evidence

Before completion:

- update `docs/summary_of_work.md` with the final integrated session, commands, exact results, failures, and manual QA;
- update `docs/ROADMAP.md` for verified closed, open, blocked, or deferred items;
- update `docs/DOCS_INDEX.md` for documentation authority changes;
- document Replicate state/recovery semantics;
- document the CSP root cause and unchanged production directive;
- document the Electron diagnostic categories and final compiler result;
- document theme inventory, migrations, YAML security, and manual visual status;
- document release output topology, cleanup ownership, and smoke dependencies.

Historical or inherited validation claims must not be reported as final-tree results unless the command is rerun successfully.

## Completion and Publication

The unified task is complete only when all five workstreams satisfy their focused contracts, the strongest applicable broad gates have actually passed, required documentation reflects the final tree, unrelated dirty work remains preserved, task changes are committed on local `main`, and local `main` is pushed to remote `main` and verified at the expected SHA.

If remote `main` advances, required checks fail, packaging cannot be run, branch protection rejects the direct push, or external paid/manual acceptance remains unavailable, report the exact limitation without overwriting history or claiming closure.

## Explicitly Prohibited Actions

- Discarding, stashing, resetting, cleaning, or blanket-restoring the dirty worktree.
- Rebuilding completed inherited work solely to simplify authorship.
- Creating a feature branch, task branch, pull request, or extra worktree.
- Weakening production CSP or SVG sanitization.
- Sending a paid request before durable intent persistence.
- Blindly retrying acceptance-unknown paid submissions.
- Persisting or logging credentials, authorization headers, or secret-bearing payloads.
- Bypassing existing SSRF, redirect, MIME, signature, IPC, profile, safety, or secure-storage boundaries.
- Hiding Electron diagnostics with compiler suppression or exclusions.
- Substituting a generic theme family during appearance changes.
- Enabling unsafe release cleanup without proven downstream artifact ownership.
- Claiming validation, packaging, hosted CI, CodeQL, manual QA, or publication that was not actually completed.
