# Summary of Work

This is the active handoff and validation ledger. The canonical current-work ledger is `docs/ROADMAP.md`; historical reports belong under `docs/reports/historical/`.


## Latest Session Summary

**Date:** 2026-08-26
**Scope:** Remediate P2/P3 findings from the repository-wide audit against current `main` (commit `029467440f7a4ac7f3611a1a26f8e655bf659070`).

Acted on the highest-value remediation tranche identified in the audit. Several reported findings were already resolved in `main`: the August 24 audit report is marked immutable historical, the duplicate `electron/utils/externalLinks.ts` helper no longer exists, and no `@ts-nocheck` directives remain in production test files.

- **GitHub governance (P2):** Updated active `Rules01` ruleset to require status checks for `lint-and-typecheck`, `unit-and-integration-tests`, `coverage`, `contracts`, `build`, `windows-sensitive-tests`, `macos-sensitive-tests`, `Analyze javascript-typescript`, and `Analyze actions`. Raised `required_approving_review_count` to `1` and enabled `require_last_push_approval`. Bypass actors remain unchanged pending explicit automation inventory.
- **i18n truthfulness (P2):** Extended `scripts/verify-i18n.cjs` and `src/i18n/resourceNormalizer.ts` to detect and scrub key-name fallback placeholders (e.g. `"contextMenu.saveAs": "contextMenu.saveAs"`) that evaded the legacy `__MISSING__:`/`[XX]` checks. Repaired the Spanish `media.json` catalog: translated context-menu items, fixed semantically incorrect `upscaleAdherence`, corrected `close`, and added layer-aware safety messages. Changed `docs/i18n/native-review-status.json` to record all non-English locales as `first-pass-machine` and removed the inaccurate "Antigravity AI (Qualified Native Reviewer)" claim.
- **Release gate (P2):** Updated `package.json` so `verify:i18n` tolerates missing markers and key-name fallbacks as warnings during development, while `verify:i18n:release` now runs `--strict` and fails on any untranslated placeholder. Regenerated `docs/i18n/translation-status.json` and `src/i18n/locale-completion-status.ts`; en-US is now correctly `isProductionComplete`, all non-English locales are explicitly incomplete.
- **Documentation:** Updated `docs/ROADMAP.md` to close `VF-GOVERNANCE-2026-08-25-001` and record the remaining i18n key-name-fallback debt.
- **Test cleanup (P3):** Removed stale `/* eslint-disable @typescript-eslint/ban-ts-comment */` directives from the eight test files previously flagged in the audit; the underlying `@ts-nocheck`/`@ts-ignore` suppressions were already gone.
- **Verification:** `npm run lint:eslint`, `npm run typecheck`, `npm run verify:i18n`, and the affected unit-test suites all PASS. `npm run verify:i18n:release` correctly FAILS with 704 key-name-fallback errors, reflecting the truthful state of the non-English catalogs.

### Prior Session Summary (Post-August-24 Remediation Closeout) [demoted from "Latest Session Summary"]

**Date:** 2026-08-25
**Scope:** Post-August-24 provider-update audit and remediation closeout.

Completed all locally actionable Phase 1–Phase 3 P1/P2 fixes and ran the full repository validation matrix.

- **Safety-layer architecture (P1):** Split mandatory child-safety (`childExploitationGuard.ts`) from optional Family Safe Mode adult-content policy (`localFamilyGuardRules.ts`). `localFamilySafeGuard.ts` now emits typed `SafetyLayer`/`SafetyCategory`; `unsafe_image_generation` maps to `adult-content-blocked`. `screenResponseBody()` uses bounded head+middle+tail windows instead of an 8 KB head sample.
- **Safety provenance (P1):** Added serializable `SafetyBlockResult` (`src/shared/safety/formatSafetyDecision.ts`) and surfaced layer/category/reasonCode through `prompt-enhancer-service.ts`, `image-view.tsx`, and `CharacterCreatorView.tsx` with localized, layer-aware messages.
- **Replicate hardening (P1/P2):** Fixed prediction routing to `/v1/models/{owner}/{name}/predictions`; implemented strict output-URL SSRF guard with manual redirect validation; bounded downloads with streaming, MIME/signature checks, and timeouts; generated `User-Agent` from app version; removed the duplicate generic adapter.
- **Google Vertex Express Mode (P1/P2):** Switched to true Express Mode using `aiplatform.googleapis.com/v1/publishers/google/models/{model}:generateContent?key={API_KEY}` with API-key-only credentials; full OAuth/service-account mode is rejected until implemented.
- **Hugging Face discovery (P2):** Replaced name-blacklist detection with metadata-based capability evidence; added unique random `.tmp` + atomic rename cache writes; validated `profileId` for cache paths.
- **IPC sender validation (P1):** Confirmed `validateIpcSender.ts` meets the contract; all privileged handlers use `registerPrivilegedIpcChannel`; added 12 adversarial end-to-end tests in `electron/ipc/handlers/common.security.test.ts`.
- **Test/verifier fixes:** Updated stale `server.test.ts` assertions to match new mandatory child-safety wording; updated `scripts/verify-backup-sync.cjs` to accept `registerPrivilegedIpcChannel` registration of sync handlers.
- **Docs:** Reconciled `docs/ROADMAP.md`, `SECURITY.md`, and `docs/security/security-model.md` to describe the actual safety-layer and IPC sender-validation behavior; external acceptance remains explicitly blocked.
- **Validation matrix:** `npm ci`, `npm run lint:eslint`, `npm run typecheck`, `npm run test:ci`, `npm run test:coverage`, `verify:safety-guard`, `verify:provider-adapters`, `verify:network-boundaries`, `verify:storage-privacy`, `verify:storage-policy`, `verify:custom-protocol-privileges`, `verify:image-policy`, `verify:venice-api-docs`, `verify:venice-contract-drift`, `verify:roadmap-current`, `verify:ci-contract`, `npm run verify:contracts`, `npm run build`, and `npm run verify:dist` all PASS. Replicate background-task stress test: 30/30 iterations PASS. Coverage thresholds met (statements 71.37%, branches 62.19%, functions 68.11%, lines 74.21%).
- **Commit / push / CI:** Work committed as `9e0307c6 Harden safety and provider IPC boundaries` and follow-up fix `d13150ef fix(security): replace non-portable /Users path in IPC sender test`; both pushed to `origin/main`. Hosted GitHub CI run `32840049748` and CodeQL run `32840049687` on `d13150ef` are green. The `electron-smoke-linux` job initially failed on a transient AppImage `ECONNRESET` network flake and passed on re-run.
- **Remaining:** External live-provider acceptance, signed builds, clean install/upgrade, multi-device sync, and accessibility QA remain EXTERNALLY BLOCKED per `docs/reports/historical/DEFERRED_WORK_DECISION_RECORD.md` and `docs/ROADMAP.md`.

## Session History

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

## Validation Matrix

- `npm run typecheck` — PASS
- `npm run lint:eslint` — PASS (zero warnings after removing stale `eslint-disable @typescript-eslint/ban-ts-comment` directives from 8 test files)
- `npm run verify:i18n` — PASS (704 key-name-fallback warnings; daily dev gate allows them)
- `npx vitest run scripts/i18n-tooling.test.ts src/i18n/resourceNormalizer.test.ts src/services/rp/rpChatService.test.ts src/services/rp/assetService.test.ts src/stores/chat-store.test.ts src/stores/character-card-store.test.ts src/stores/asset-store.test.ts src/stores/chat-media-reference.test.ts src/stores/rp-chat-store.test.ts src/utils/imageProcessor.test.ts` — PASS (197 tests)
- `npm run verify:i18n:release` — FAILS (expected; 704 key-name fallback placeholders remain in non-English catalogs)
- `npm run verify:contracts` — not re-run in this session (would fail at `verify:i18n:release` by design)

