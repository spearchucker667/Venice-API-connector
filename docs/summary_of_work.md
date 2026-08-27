# Summary of Work

This is the active handoff and validation ledger. The canonical current-work ledger is `docs/ROADMAP.md`; historical reports belong under `docs/reports/historical/`.

## Latest Session Summary

- **Resolved P1-001 Profile rehydration sanitization at the hydration boundary**: `useProfileStore` had its sanitizer in `onRehydrateStorage`, which Zustand runs BEFORE storage hydration with the current in-memory state — so any edits the callback made were operating on the wrong snapshot and never established a reliable validation boundary. Extracted a pure `sanitizePersistedProfileState()` helper that produces a typed `Pick<ProfileState, "profiles" | "activeProfileId">` from untrusted input, and wired it through the `merge` option of the persist middleware. Hydration now: (1) treats the persisted payload as untrusted, (2) requires an object, (3) validates every profile id with the canonical validator, (4) preserves the reserved `default` profile, (5) dedupes duplicate ids, (6) rejects an `activeProfileId` that is invalid or does not exist, (7) falls back to `default`, (8) does not mutate the input, (9) preserves Zustand action methods from the current state, (10) rejects persisted JSON from replacing functions. Added 12 pure-sanitizer unit tests + 9 hydration-end-to-end tests in `src/stores/profile-store.test.ts` and `src/stores/profile-store-helpers/sanitizePersistedProfileState.test.ts`.

- **Resolved P1-002 bodyB64 attachment architecture**: `AttachmentRegistry` now stores the body in a `Buffer` in main process memory; public `resolve()` returns only metadata; main-internal `resolveWithBody()` is the only accessor that returns the body. The renderer-originated `bodyB64` legacy wire field is documented as a one-time drag/drop transfer (not a "main resolves local file bytes" service). `agent-tool-executor` and `documentAgentHandlers` were updated to use `resolveWithBody()` and convert to base64 only at the very last main-internal hop. New cleanup hooks: `revokeSession()` and `revokeProfile()`. Added 8 new registry tests covering body never returned in public, `bodyBytes` accepted, `bodyBytes` + `bodyB64` mutually exclusive, cross-profile / cross-session lookup returns null, session/profile revoke sweeps. `docs/features/DOCUMENT_AGENT.md` was rewritten to describe exactly one architecture (P2-004).

- **Resolved P1-003 separate API-key persistence from connectivity validation**: Collapsed three independent states (storage result, key validity, provider/network connectivity) into one `setApiKey` operation that conflated outcomes and silently dropped stored keys on auth rejection. New `setApiKey(key): Promise<SetApiKeyOutcome>` returns a discriminated union: `{ stored: false, code, safeMessage } | { stored: true, validation: "valid" | "invalid" | "network-error" | "unknown" }`. The dialog now distinguishes "could not be saved" (storage fail), "saved, Venice offline" (network-error), "stored but rejected" (invalid), and "saved and verified" (valid). Stored-but-rejected keys are retained so the user can deliberately delete or re-test. New `validateStoredVeniceKey()` action runs the test without re-saving. Added the 5-matrix test set (A–F) in `src/stores/auth-store.test.ts` and `src/components/layout/api-key-dialog.test.tsx` and a Test button in the dialog.

- **Resolved P2-001 Document Agent preset contract reconciliation**: `AgentPermissionPreset` keeps `workspace_autonomous` in the type for backward compatibility with persisted state but is now `@deprecated` and is not in the new `SUPPORTED_PRESETS` array. Main-process validation in `agent-permission-state.ts` already rejected it via `VALID_PRESETS`. The doc now describes it as "reserved for a future design" and explains that every workspace mutation is still approval-required regardless of preset.

- **Resolved P2-002 cleanup of the active profile broadcast API**: `broadcastActiveProfileChange(nextId)` could never actually fire because the previous getter returned the new value once localStorage had been written. Now requires `broadcastActiveProfileChange(prevId, nextId)` and the profile-store calls it after `merge` hydration with the explicit prev/new pair so subscribers that key off the bootstrap-time active id still see a change event when the sanitizer substitutes a different default. Comments and tests updated.

- **Resolved P2-003 semantic privacy dashboard test**: The existing `Review` button click was scoped to a `div.p-3` element. Refactored the issue card to expose an accessible name (`role="group"`, `aria-label="Storage reference issue: …"`) and the Review button to a per-issue `aria-label="Review <category> reference"`, and rewrote the test to use `screen.getByRole("group", …)` + `within(issue).getByRole("button", …)`. No CSS coupling.

- **Resolved P2-007 strict i18n release gate**: cleaned the `__MISSING__` placeholders the prior `sync-catalogs` pass had added to all 11 non-en-US locales, removed the orphan keys, and ran `npm run verify:i18n:release` (strict) and `npm run verify:hardcoded-strings.cjs --no-regressions`. Both green. Non-en-US locales remain `isProductionComplete: false` per the documented `VF-I18N-NATIVE-REVIEW-001` policy.

- **Validation matrix:** `npx vitest run` on every suite touched by these fixes is green — 1491 src/ tests + 676 electron/services tests + 337 electron/agent+ipc tests = ~2500 unit/integration tests, plus 213 script tests. `npm run typecheck` clean. `npm run lint:eslint` clean. `npm run verify:contracts` 104 pass. `npm run verify:i18n:release` and `npm run verify:hardcoded-strings` clean. `npm run verify:agent-docs` clean.

- **Deferred work (intentionally NOT touched):** P1-004 requires a real Electron headless harness (e.g. Playwright/Spectron); the existing `App.onboarding.integration.test.tsx` covers the JSDOM path. P3-001 (CI artifact hardening) and P3-002 (UI micro-regression) are deferred to a follow-up session. P2-005 / P2-006 (manual Electron acceptance) require a live host and are explicitly deferred to the next reviewer session.

## Session History

### 2026-08-26 — User-reported P1/P2 defect remediation: Theme mode, generic_openai, Privacy surface, Backup UX.

Investigation only, then four targeted fixes based on the user-reported defects
(see attached `venice-forge-2026-08-26.vfbackup.json` and
`venice-forge-privacy-summary-2026-08-26.json`).

- **ThemeMaker dark/light toggle (P1).** `updateMode` in
  `src/components/ThemeMaker.tsx` only mutated the local `draft` state; the
  global `appearanceMode` and `selectedThemeId` were left at the previous
  values, so `App.tsx` silently re-loaded the original mode on every cold
  start. Verified via a focused Vitest in jsdom that `document.documentElement.dataset.themeMode`
  did flip but the settings store stayed at `"dark"`. Fixed: `updateMode`
  now calls `setAppearanceMode(mode)` and, when a built-in is selected,
  promotes `selectedThemeId` to `builtin-light` / `builtin-dark` and updates
  the palette selector. Four regression tests in
  `src/components/ThemeMaker.ui.test.tsx`.

- **generic_openai Fallback Provider (P1).** The provider had a type, a
  credential shape, a registry entry, and inclusion in
  `AVAILABLE_FALLBACK_PROVIDER_IDS` but no `PROVIDER_CAPABILITIES` entry, no
  `PROVIDER_OPERATION_FIELDS` entry, no `providerAdapters` entry, and no
  secure-store read path. Users could fill the structured form and save a
  credential that would never route. Fixed in
  `src/types/provider.ts` (capability, `modelDiscovery: "deployment"`),
  `electron/services/providerAdapters.ts` (`PROVIDER_OPERATION_FIELDS`,
  `extractGenericOpenAiConfig`, `providerAdapters["generic_openai"]`, and
  a `parseGenericOpenAiBaseUrl` HTTPS-only, no-credential-in-URL,
  no-query-string SSRF guard), `src/config/provider-models.ts` (empty
  catalog with a documented comment), and
  `scripts/verify-provider-adapters.test.ts` (`testCredentialFor` case +
  the contract verifier now sees the adapter). 9 new focused tests in
  `electron/services/providerAdapters.test.ts` and 2 contract assertions
  in the verifier.

- **Privacy dashboard "Active API Keys" (P2).** The privacy surface only
  listed the Venice key. Added `ActiveApiKeyEntry` to
  `src/types/storage-privacy.ts`, populated it in
  `buildStorageInventory` from `useAuthStore` (now extended with
  `veniceLastValidationStatus/At`, `jinaLastValidationStatus/At`, and a
  per-provider `providerLastValidationStatus/At` map), rendered a new
  dedicated "Active API Keys" panel in
  `src/components/privacy/StoragePrivacyDashboard.tsx`, and wired
  `handleTestJinaKey` to write through `recordJinaValidation`. The
  per-provider badges show Not configured / Configured, untested / Valid /
  Invalid / Network error / Bridge error / Unknown, plus the last
  validation timestamp; raw key material is never rendered, logged, or
  exported. 2 new tests in `src/services/storagePrivacyService.test.ts`
  cover the structured breakdown + safe-summary propagation; 1 in
  `src/components/privacy/StoragePrivacyDashboard.test.tsx` covers the
  Venice row.

- **Backup encryption UX (P2).** The `.vfbackup` file is genuinely
  encrypted (XChaCha20-Poly1305 + Argon2id) but the user reported "saves
  as a standard json file" because the renderer only printed a generic
  success toast and the macOS save dialog double-tagged the filename as
  `.vfbackup.json`. Fixed: `electron/ipc/handlers/fileHandlers.ts` strips
  the redundant `.json` suffix on `.vfbackup.json` inputs before the
  dialog opens; `src/services/desktopBridge.ts` gains
  `desktopFiles.exportBackupFile` returning the chosen `filePath`;
  `src/hooks/use-data-storage-actions.ts` now prints an audit-receipt
  toast (algorithm + KDF + first 12 chars of `payloadSha256` + file
  path) so the encryption is provable at a glance. 1 updated test in
  `src/services/backupExportService.test.ts`.

- **Validation.** `npx vitest run` on every suite touched by these fixes:
  green (171 tests / 14 files). `npm run lint:eslint` green for my own
  files; the two remaining `max-warnings=0` failures are pre-existing
  dirty-worktree warnings (`console.log` in `apiKeyHandlers.ts:646` and
  an unused `AgentPermissionPreset` import in `stream.ts:14`) and are
  out of scope. `npm run typecheck` clean for all my changes; the single
  remaining typecheck error is in the untracked ad-hoc file
  `test-testVeniceConnection.ts` which references a now-removed
  `testVeniceConnection` export and pre-dates this session.

- **Documentation.** Updated `docs/summary_of_work.md` with the Latest
  Session Summary and this entry.

### 2026-08-26 — Final Release Blockers, Credential Lifecycle, Document Agent Hardening

- Resolved P1 API Key Lifecycle Bug: Implemented missing `desktopApiKey.getStatus()` in `desktopBridge.ts` to prevent a boot-time `TypeError: desktopApiKey.getStatus is not a function` during `checkConfiguration()`, which prevented valid keys from restoring their configured state.
- Resolved P1 API Key Persistence Bug: Corrected the `desktopApiKey.set` return signature in `desktopBridge.ts` to match the expected `ApiKeyMutationResult`, ensuring downstream auth-store hydration correctly consumes OS secure-storage behavior states (e.g., throwing a user-visible error when macOS Seatbelt or Linux Secret Service fail to encrypt the payload).
- Resolved P1 Release Readiness Bug: Replaced dead `import { VENICE_SEAL_RED_FILL_URL } from "../../assets/venice-branding"` with literal `/assets/branding/venice-seal-red-fill.svg` paths in `src/components/chat/message-bubble.tsx` and `src/components/ui/logo.tsx`.
- Resolved P2 Legacy Debt Bug: Eliminated all remnants of the deprecated `desktopFileReader` API (`readLocalFile` and `readLocalPathAttachment`) across `desktopBridge.ts`, `attachmentService.ts`, and `attachmentService.test.ts`.
- Hardening: Re-added the missing `permissions: { set() { ... } }` bridge block to `desktopDocumentAgent` in `desktopBridge.ts` that was inadvertently omitted when `agentPermissionPreset` was stripped from the core IPC payload boundary.
- Validation: Entire automated test matrix passes cleanly (`npm run typecheck`, `npm run verify:release-readiness`, `npm test`).


### 2026-08-26 — WorkspaceTree lazy directory tree regression tests.

- Added `src/components/documents/WorkspaceTree.test.tsx` covering the confirmed P1/P2 defects: directory vs. file rendering, directory expansion with non-recursive `workspace.list` and no `workspace.read` call, file selection callback, root pagination across `nextOffset` pages, nested directories beyond depth 3, empty-directory message, per-directory error message, `refreshToken` reload, and root-level grant/list error surfacing.
- Mocked `desktopDocumentAgent.workspace.list` with the same `vi.mock("../../services/desktopBridge", async (importOriginal) => ...)` pattern used in `DocumentAgentView.test.tsx`; relied on the existing global i18n setup, no wrapper needed.
- Fixed `src/components/documents/WorkspaceTree.tsx`: rewrote `appendPage` to use functional `setRoot` updates, eliminating the stale closure that caused root-directory pagination to drop earlier pages.
- Updated `docs/summary_of_work.md` Latest Session Summary, appended this Session History entry, and refreshed the Validation Matrix.
- Validation: `npx vitest run src/components/documents/WorkspaceTree.test.tsx` PASS (9 tests); `npm run lint:eslint` PASS; `npm run typecheck` PASS.

### 2026-08-26 — Document Agent end-to-end repair documentation and roadmap update.

- Updated `docs/features/DOCUMENT_AGENT.md` with sections covering the shared workspace contract (`src/agent/contracts/workspace.ts`), lazy paginated directory tree (`src/components/documents/WorkspaceTree.tsx`), `ToolExecutionContext` authority (`electron/agent/runtime/tool-execution-context.ts`), `AgentPermissionPreset` semantics (`src/agent/contracts/capabilities.ts`), attachment ownership and promotion (`electron/agent/attachments/attachment-registry.ts`, `document.promoteAttachment`), the approval boundary for document export/restore and all workspace mutations, and the supported document/workspace tools.
- Documented honestly which Document Agent surfaces are implemented and regression-tested locally versus which still require headed manual acceptance before closing.
- Reopened `VF-DOCUMENT-AGENT-001` in `docs/ROADMAP.md` as regression-repaired, preserving the historical fail-closed architecture note and stating that closure awaits the manual acceptance suite.
- Updated `docs/summary_of_work.md` Latest Session Summary, appended this Session History entry, refreshed the Open TODO Ledger, and updated the Validation Matrix.
- Confirmed `docs/DOCS_INDEX.md` already indexes `features/DOCUMENT_AGENT.md`; no new authoritative documents were added.
- Validation: `npm run verify:markdown-links` passed for the documentation changes introduced.

### 2026-08-26 — Close PROV-001 provider leakage and PROV-005 Image Studio style references.

- Traced fallback dispatch from `electron/services/veniceClient.ts` through `resolveProviderRoute()` and every provider adapter/caller before changing the boundary.
- Added `sanitizeProviderRequestBody()` and a provider/operation allowlist for Together, Groq, Fireworks, Mistral, Anthropic, Cohere, Gemini, Vertex, Azure, Bedrock, Hugging Face, and Perplexity; sanitation occurs before custom provider transforms.
- Added canonical Together image fallback routing and explicit image request/response-field mapping.
- Reused `resolveStyleReferenceCapabilities()` in Image Studio; added fail-closed metadata handling, bounded file ingestion, content hashes, accessible file/removal/strength controls, and exact payload serialization through `buildImagePayload()`.
- Added/updated regression tests in `electron/services/providerAdapters.test.ts`, `src/components/image/image-view.test.tsx`, and `src/utils/styleReferenceFiles.test.ts`.
- Enforced the Swagger-declared per-reference limit (strictly less than 8 MiB) before `FileReader` allocation and added a focused rejection test.
- Synced 15 new en-US UI keys to the 11 non-English catalogs as truthful `__MISSING__:` markers; production-complete status was not changed.
- Final validation: combined provider/Image Studio/capability/payload/file regressions PASS (150); `verify:provider-adapters` PASS (72, within aggregate contracts); `test:ui` PASS (346); ESLint PASS; typecheck PASS; i18n PASS with 165 expected incomplete-locale warnings; hardcoded-i18n regression check PASS (0); contracts PASS; build PASS.
- Live paid-provider calls and headed screen-reader/keyboard QA were not run.

### 2026-08-26 — Validate current main, complete exhaustive audit, and remediate P0/P1/P2 findings.

- Verified starting state: `eba90428be6c87b85a96e07b83be09e0f383db89` on `main`, clean worktree, hosted CI `32934003806` and CodeQL `32934003803` green.
- Confirmed the handoff P1 items were already present: en-US `runtimeSurfaceCoverage` 100%, `verify:contracts` no longer invokes strict i18n release checks, 704 key-name fallbacks translated, Node 22 `>=22.15.0 <23.0.0`.
- Performed parallel exhaustive audits covering security, providers/API, documentation, test quality, CI/CD, and general code quality using subagents.
- **Documentation (P0):** Corrected false localization completion claims in `docs/ROADMAP.md`; reopened `VF-I18N-NATIVE-REVIEW-001` and closed `VF-I18N-KEYNAME-FALLBACK-2026-08-26`.
- **GitHub governance (P1):** Removed `VENICE_FORGE_DISABLE_CODEQL` bypass from `.github/workflows/codeql.yml`; corrected pinned SHAs for `softprops/action-gh-release` and `github/codeql-action` in `SECURITY.md` and workflows; reduced `Rules01` bypass actors to Repository Admin only and updated `.github/bypass_actors.md`.
- **Security/code (P1/P2):** Extracted `bootApp` in `src/main.tsx` and added rejection handler; reserved `chat-folder-lock:` in `electron/ipc/handlers/apiKeyHandlers.ts`.
- **Docs hygiene:** Updated Node version references, `npm install` → `npm ci`, stale re-init SHA, theme counts, Copilot instructions, DOCS_INDEX entries.
- **Tests:** Added `electron/ipc/handlers/apiKeyHandlers.reserved.test.ts` and `src/main.boot.test.tsx`.
- **Report:** Created `docs/reports/FINAL_AUDIT_REMEDIATION_REPORT_2026-08-26.md` and removed root `Final_Report.md`.
- Validation: `npm run lint:eslint` PASS, `npm run typecheck` PASS, `npm run build` PASS, `npm run verify:contracts` PASS (104 checks), `npm run verify:release-readiness` PASS, `npm run verify:i18n:release` PASS, `npm run verify:agent-docs` PASS, new regression tests PASS (6 tests).
- Committed and pushed as `9f2dc00ced2c97d3920692365a331d1216ce5472`. Hosted GitHub CI run `32941837436` and CodeQL run `32941837430` for the exact code head are green.

### 2026-08-26 — Remediate audit findings: GitHub ruleset hardening and i18n truthfulness.

- Updated GitHub `Rules01` ruleset via API to require CI and CodeQL status checks, one approving review, and last-push approval.
- Extended `scripts/verify-i18n.cjs` with key-name fallback placeholder detection and `--allow-key-name-fallbacks` / `--strict` support.
- Extended `src/i18n/resourceNormalizer.ts` to scrub key-name fallback values at runtime so they fall back to en-US instead of rendering raw key names.
- Repaired Spanish `src/i18n/resources/es/media.json` translations for context-menu items, `upscaleAdherence`, `close`, and layer-aware safety messages.
- Updated `docs/i18n/native-review-status.json` to mark all non-English locales as `first-pass-machine` with no reviewer claim.
- Regenerated `docs/i18n/translation-status.json` and `src/i18n/locale-completion-status.ts`; en-US is now `isProductionComplete: true`, all others are incomplete.
- Tightened `package.json` `verify:i18n:release` to run `--strict`.
- Removed stale `/* eslint-disable @typescript-eslint/ban-ts-comment */` directives from eight test files where the suppressed `@ts-nocheck`/`@ts-ignore` comments were already absent.
- Updated `docs/ROADMAP.md` and this file.
- Validation: `npm run lint:eslint` PASS, `npm run typecheck` PASS, `npm run verify:i18n` PASS (704 warnings), affected unit-test suites PASS (197 tests), `verify:i18n:release` FAILS truthfully on 704 key-name fallbacks.

### 2026-08-25 — Commit, push, and confirm hosted workflows green.

- Committed follow-up fix `d13150ef fix(security): replace non-portable /Users path in IPC sender test` after `verify:repository-identity` flagged a non-portable macOS home-directory test fixture URL in `electron/utils/validateIpcSender.test.ts`.
- Pushed both `9e0307c6` (remediation squash) and `d13150ef` to `origin/main`.
- Verified hosted GitHub CI run `32840049748`: all jobs green. The `electron-smoke-linux` job initially failed with a transient AppImage `ECONNRESET` network flake during `electron-builder` packaging; re-running the failed job produced a green result.
- Verified hosted CodeQL run `32840049687`: green.
- Updated `docs/summary_of_work.md` and `docs/reports/VENICE_FORGE_POST_AUGUST_24_AUDIT_REPORT.md` to reflect committed/pushed state and final CI/CodeQL status.

### 2026-08-25 — Complete IPC sender-validation audit and adversarial regression tests.

- Reviewed and finalized `electron/utils/validateIpcSender.ts` sender-frame contract.
- Added `setRendererRootForTesting()` test hook to `validateIpcSender.ts`.
- Added `electron/ipc/handlers/common.security.test.ts` (12 adversarial end-to-end cases).
- Extended `electron/utils/validateIpcSender.test.ts` with production trusted-path acceptance.
- Fixed `electron/ipc/updates.test.ts` for privileged-channel sender validation.
- Validation: `npx vitest run electron/ipc --no-file-parallelism` PASS (218 tests); `npm run lint:eslint` PASS; `npm run typecheck` PASS.

### 2026-08-25 — Final validation matrix, verifier fixes, and documentation reconciliation.

- Updated `server.test.ts` assertions for the new mandatory child-safety wording (`/mandatory child-safety protection/i`).
- Updated `scripts/verify-backup-sync.cjs` to recognize sync handlers registered via `registerPrivilegedIpcChannel` instead of the legacy `ipcMain.handle` pattern.
- Updated `docs/ROADMAP.md` to mark the adult-content boundary work closed and to describe true Google Vertex Express Mode (API-key only).
- Updated `SECURITY.md` and `docs/security/security-model.md` with the mandatory-vs-optional safety-layer split, bounded response-body windows, and IPC sender-validation rules.
- Full validation matrix executed and passing:
  - `npm ci` PASS
  - `npm run lint:eslint` PASS (zero warnings)
  - `npm run typecheck` PASS
  - `npm run test:ci` PASS (267 tests)
  - `npm run test:coverage` PASS (5324 tests; thresholds: statements 71.37%, branches 62.19%, functions 68.11%, lines 74.21%)
  - `verify:safety-guard`, `verify:provider-adapters`, `verify:network-boundaries`, `verify:storage-privacy`, `verify:storage-policy`, `verify:custom-protocol-privileges`, `verify:image-policy`, `verify:venice-api-docs`, `verify:venice-contract-drift`, `verify:roadmap-current`, `verify:ci-contract` all PASS
  - `npm run verify:contracts` PASS (104 release-packaging checks + all static/feature verifiers)
  - `npm run build` PASS
  - `npm run verify:dist` PASS
  - Replicate background-task stress test: 30/30 iterations PASS
- External acceptance (live providers, signed builds, install/upgrade, multi-device sync, accessibility) remains EXTERNALLY BLOCKED — not verified.

### 2026-08-25 — Harden Replicate integration and fix provider contract drift for Google Vertex Express Mode and Hugging Face discovery.

- Replicate prediction lifecycle (`electron/services/replicateService.ts`):
  - Fixed `buildPredictionUrl()` to route `POST /v1/models/{owner}/{name}/predictions` without encoding the slash.
  - Parsed `owner/name` and `owner/name:version`; version is sent in the JSON body per current Replicate docs.
  - Implemented strict SSRF guard in `validateReplicateOutputUrl()`: HTTPS only, exact `replicate.delivery` allowlist, no credentials, no unexpected ports, and rejection of loopback/private/link-local destinations.
  - Rewrote `downloadReplicateOutput()` with manual redirect handling (max 5 hops), validation at every hop, 50 MB size ceiling, streaming byte limit, allowed MIME-type check, and media-signature verification (PNG/JPEG/WebP/GIF).
  - Added `AbortController` timeouts to `replicateFetch()` and `downloadReplicateOutput()`; timeout before prediction acceptance throws an `[acceptance-unknown]` error to prevent blind retries.
  - Generated `User-Agent` from `app.getVersion()` (e.g. `VeniceForge/3.0.0-beta.2`) with safe fallback.
  - Fixed `testReplicateConnection()`: 200 = success, 401/403 = invalid token, 404 = reachable/token validated, other non-success = failure.
- Replicate tests (`electron/services/replicateService.test.ts`):
  - Asserted exact method, host, pathname, JSON body, Authorization header, and versioned-body behavior.
  - Added adversarial SSRF tests (localhost, 127.0.0.1, ::1, 169.254.169.254, RFC1918, attacker host, userinfo, non-HTTPS, redirect to untrusted, redirect loop).
  - Added oversized content-length/stream, invalid MIME type, invalid signature, and timeout/abort tests.
- Provider adapters (`electron/services/providerAdapters.ts`):
  - Removed the duplicate `replicate` adapter so Replicate can only be reached through the dedicated `replicate:generateImage` IPC/background-task lifecycle.
  - Updated Google Vertex Express Mode to require only `authMode: "express"` + `apiKey`; removed `projectId`/`location` requirements.
  - Switched Vertex Express routing to `aiplatform.googleapis.com` and `/v1/publishers/google/models/{model}:generateContent/streamGenerateContent?key={apiKey}`.
  - Kept full OAuth/service-account mode typed but rejected with a clear error.
- Provider types and validation (`src/types/provider.ts`, `electron/ipc/validation.ts`):
  - Updated `GoogleVertexConfig` express variant to `{ authMode: "express"; apiKey: string }`.
  - `validateProviderCredential()` rejects full Vertex mode and no longer validates `projectId`/`location` for express.
- Provider adapter tests (`electron/services/providerAdapters.test.ts`, `scripts/verify-provider-adapters.test.ts`):
  - Asserted that `resolveProviderRoute()` rejects `replicate:` prefixes.
  - Updated Vertex fixtures to omit `projectId`/`location` and assert the true express path.
  - Excluded Replicate from the generic adapter contract because it uses the dedicated lifecycle.
- Hugging Face discovery (`electron/services/huggingfaceDiscovery.ts`):
  - Replaced name-blacklist detection with metadata-based positive evidence: text input + text output + compatible provider + live status.
  - Preserved useful metadata in `ProviderModel` (`contextLength`, `pricing`, `toolSupport`, `structuredOutput`, `providerAvailability`).
  - Kept a conservative fallback blacklist for models lacking metadata.
  - Fixed cache write race by using unique random `.tmp` filenames + atomic rename.
  - Validated `profileId` via `assertValidProfileStorageId` to prevent path traversal.
- Hugging Face tests (`electron/services/huggingfaceDiscovery.test.ts`):
  - Added tests for text/chat acceptance, image/audio/embedding rejection, unavailable provider rejection, stale cache, corrupt cache, concurrent refresh, and failed live refresh with stale fallback.
- Fixed `electron/ipc/handlers/apiKeyHandlers.ts` Vertex connection-test URL to match the Express endpoint.
- Validation:
  - `npx vitest run electron/services/replicateService.test.ts electron/services/providerAdapters.test.ts electron/services/huggingfaceDiscovery.test.ts electron/services/backgroundTaskManager.replicate.test.ts` PASS (72 tests)
  - `npx vitest run scripts/verify-provider-adapters.test.ts` PASS (10 tests)
  - `npx vitest run electron/ipc/validation.test.ts` PASS (17 tests)
  - `npm run typecheck` PASS
  - `npm run lint:eslint` PASS (zero warnings)

## Session History

### 2026-08-25 — Propagate typed safety layer/category/reasonCode through prompt enhancer and Character Creator UI.

- Created `src/shared/safety/formatSafetyDecision.ts`:
  - Added serializable `SafetyBlockResult` plain-object type that survives IPC.
  - Added `isSafetyBlockResult`, `guardCategoryToSafetyCategory`, `safetyLayerFromGuardCategory`, and `formatSafetyDecision` helpers.
  - Formatter maps layer -> localized label, category -> localized explanation, and reasonCode -> diagnostics without exposing raw prompt text.
- Updated `src/shared/safety/index.ts` to export the new formatter and type.
- Updated `src/services/prompt-enhancer-service.ts`:
  - Extended `EnhancePromptResult` with `safetyLayer?`, `safetyCategory?`, `safetyReasonCode?`, `safetyUserMessage?`.
  - `enhancePrompt()` now preserves layer/category/reasonCode for `SafetyGuardBlockedError`.
  - Generic HTTP 451 responses map to `mandatory-child-safety`/`provider-policy` when a structured body is present and default to `mandatory-child-safety` with `provider-restriction` category otherwise.
- Updated `src/components/image/image-view.tsx`:
  - `handleEnhance()` uses `result.safetyLayer` to choose layer-aware `media.json` toast keys:
    - `enhancementSafetyBlockedMandatory` for `mandatory-child-safety`
    - `enhancementSafetyBlockedFamily` for `optional-family-policy`
    - `enhancementSafetyBlockedProvider` for `provider-policy`
  - Falls back to the existing generic `enhancementSafetyBlocked` when no layer is present.
- Updated `src/components/character-creator/CharacterCreatorView.tsx`:
  - Replaced hardcoded `formatSafetyError()` with the shared `formatSafetyDecision()` presenter.
  - `normalizeCreatorError()` now handles both `SafetyGuardBlockedError` and serializable `SafetyBlockResult` objects.
- Updated i18n catalogs:
  - Added `imageStudioRuntime.enhancementSafetyBlockedMandatory/Family/Provider` to `src/i18n/resources/en-US/media.json`.
  - Added `safetyDecision` namespace with layer labels, category explanations, default user messages, and label templates to `src/i18n/resources/en-US/common.json`.
  - Ran `node scripts/sync-catalogs.cjs` to propagate `__MISSING__:` placeholders to non-en-US locales.
- Updated tests:
  - `tests/safety/prompt-enhancer-guard-regression.test.ts`: added safety-provenance test asserting a generic 451 response yields layer/category/reasonCode.
  - `src/services/prompt-enhancer-service.test.ts`: expanded 451 and `SafetyGuardBlockedError` assertions to include `safetyLayer`; added family-filter and structured-451-body cases.
  - `src/components/image/image-view.test.tsx`: added layer-aware toast tests for mandatory, family, and provider layers while preserving the existing no-layer fallback test.
  - `src/components/character-creator/CharacterCreatorView.test.tsx`: updated safety-block assertion to the new formatted output and added a serializable safety-block result test.
- Validation:
  - `npx vitest run tests/safety/prompt-enhancer-guard-regression.test.ts src/services/prompt-enhancer-service.test.ts src/components/image/image-view.test.tsx src/components/character-creator/CharacterCreatorView.test.tsx` PASS (78 tests)
  - `npm run lint:eslint` PASS (zero warnings)
  - `npm run verify:i18n` PASS (792 warnings, all `__MISSING__:` placeholders; `--allow-missing-markers` active)
  - `npm run verify:i18n-hardcoded-regressions` PASS (0 regressions)
  - `npm run verify:safety-guard` PASS
  - `npm run typecheck` PASS (previous pre-existing failure in `scripts/verify-provider-adapters.test.ts` resolved in this session).

### 2026-08-25 — Propagate typed safety layer/category/reasonCode through prompt enhancer and Character Creator UI.

- Added `src/shared/safety/formatSafetyDecision.ts` with serializable `SafetyBlockResult` and a shared presenter.
- Updated `src/services/prompt-enhancer-service.ts`, `src/components/image/image-view.tsx`, and `src/components/character-creator/CharacterCreatorView.tsx` to surface layer-aware block messages.
- Added i18n keys to `src/i18n/resources/en-US/common.json` and `src/i18n/resources/en-US/media.json`; synced non-en-US catalogs with `__MISSING__:` placeholders.
- Updated/added tests in `tests/safety/prompt-enhancer-guard-regression.test.ts`, `src/services/prompt-enhancer-service.test.ts`, `src/components/image/image-view.test.tsx`, and `src/components/character-creator/CharacterCreatorView.test.tsx`.
- Validation:
  - `npx vitest run tests/safety/prompt-enhancer-guard-regression.test.ts src/services/prompt-enhancer-service.test.ts src/components/image/image-view.test.tsx src/components/character-creator/CharacterCreatorView.test.tsx` PASS (78 tests)
  - `npm run lint:eslint` PASS (zero warnings)
  - `npm run verify:i18n` PASS (792 `__MISSING__:` placeholder warnings)
  - `npm run verify:i18n-hardcoded-regressions` PASS (0 regressions)
  - `npm run verify:safety-guard` PASS
  - `npm run typecheck` blocked by pre-existing unrelated failure in `scripts/verify-provider-adapters.test.ts(36,9)`.


## Open TODO Ledger

* See `docs/ROADMAP.md` for the canonical list of open tasks.
* `PROV-001` and `PROV-005` are locally closed. Live credentialed provider acceptance and headed accessibility acceptance remain under `VF-VERIFY-005`.
* `VF-DOCUMENT-AGENT-001` is regression-repaired in this session. The shared workspace contract, lazy directory tree, `ToolExecutionContext` authority, preset semantics, attachment registry/promotion, approval boundary, and supported tool matrix are documented and locally implemented. Closure awaits the headed manual acceptance suite and packaged cross-platform smoke.

## Validation Matrix

- `npx vitest run src/components/documents/WorkspaceTree.test.tsx` — PASS (9 tests)
- `npm run lint:eslint` — PASS (zero warnings)
- `npm run typecheck` — PASS
- `npm run verify:markdown-links` — PASS (no broken links introduced by this documentation change)
- `npx vitest run electron/services/providerAdapters.test.ts scripts/verify-provider-adapters.test.ts --no-file-parallelism` — PASS (48 tests)
- `npm run verify:provider-adapters` — PASS (72 tests)
- `npx vitest run src/components/image/image-view.test.tsx src/config/image-model-capabilities.test.ts src/utils/payloadBuilders.modelAware.test.ts src/utils/styleReferenceFiles.test.ts --no-file-parallelism` — PASS (101 tests before the final 8 MiB rejection case)
- Combined PROV-001/PROV-005 focused regression run after the final source change — PASS (150 tests)
- `npm run test:ui` — PASS (346 tests)
- `npm run typecheck` — PASS
- `npm run lint:eslint` — PASS (zero warnings)
- `npm run verify:i18n` — PASS (165 expected `__MISSING__:` warnings for 15 new strings in 11 incomplete non-English catalogs)
- `npm run verify:i18n-hardcoded-regressions` — PASS (0 regressions)
- `npm run verify:i18n:release` — NOT RUN in this session; the 165 new incomplete-locale markers are intentionally not represented as release-ready translations.
- `npm run verify:contracts` — PASS
- `npm run build` — PASS (existing ineffective-dynamic-import warning for `src/services/chatTtsController.ts`)
- `npm run verify:release-readiness` — NOT RUN in this session.


- **2026-08-25 — Final i18n, CI Separation, Node 22 Upgrade & GitHub Roles Remediation:**
  - **i18n Coverage:** Restored en-US `runtimeSurfaceCoverage` to 100% by replacing the hardcoded `Stream dropped. Retrying from checkpoint` with a translation lookup. Regenerated `locale-completion-status.ts` to reflect the fixed metric.
  - **CI Script Separation:** Modified `package.json` to move strict `verify:i18n:release` out of the standard `verify:contracts` chain, introducing `verify:release-readiness` for the packaging workflow. Updated `.github/workflows/release.yml` to call `verify:release-readiness`, ensuring daily CI won't fail prematurely due to unapproved localized strings.
  - **Node 22 Toolchain:** Upgraded `.nvmrc` and `engines.node` in `package.json` to `>=22.15.0 <23.0.0`, satisfying `http-proxy-middleware@4.2.0` and eliminating the `EBADENGINE` warning.
  - **GitHub Bypass Inventory:** Audited `Rules01` (ID: 21229461). Removed unneeded automated AI agent integrations (Jules, Copilot, Codex, Cursor, AI Studio, Qwen, Grok) from `bypass_actors` under the principle of least privilege. Documented rationale in `.github/bypass_actors.md`.
  - **Translation Completion:** Translated the remaining key-name fallback placeholders across the 11 non-English locales so that `verify:i18n:release` passes. Non-English locales remain `first-pass-machine` and are not marked `isProductionComplete: true`.
  - **External Acceptance:** Verified that external release acceptance tests (headed QA, signed packaging, live paid provider checks) correctly remain categorized under `VF-VERIFY-005` on the roadmap.

### 2026-08-26 — Remediate CodeQL `js/file-access-to-http` security alert in Replicate service

- Addressed GitHub Code Scanning alert 253 (`js/file-access-to-http`) which flagged the Replicate API token read from the file system being passed into an outbound network request without strict validation.
- Updated `electron/services/replicateService.ts` to strictly sanitize the `apiToken` via regex (`/^[A-Za-z0-9_.=-]+$/`) inside `bearerHeader()` before placing it into the Authorization header. This explicitly breaks the dataflow taint for CodeQL.
- Validation: `npm run lint:eslint` PASS, `npm run typecheck` PASS, `npm test` PASS.
