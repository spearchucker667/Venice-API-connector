# Summary of Work

This is the active handoff and validation ledger. The canonical current-work ledger is `docs/ROADMAP.md`; historical reports belong under `docs/reports/historical/`.

## Latest Session Summary

- **Fixed Task 4 review findings for Replicate paid-submission durability against `main`.** Guarded `persistAcceptanceUnknown` failures so they still return `acceptance_unknown` instead of escaping as `pre_dispatch_failure`; added a per-fingerprint FIFO lock around persisted lookup and intent persistence to prevent same-fingerprint/different-payload concurrent calls from both dispatching; replaced the unbounded `response.text()` fallback in `boundedResponseReader.ts` with a deadline- and size-raced fallback; committed the `StreamReadResult<T>` alias; and added tests for the persistence-failure and race scenarios. Staged only task-owned files and committed as `b45b064e`.

- **Completed CSP-001 Meteocon remediation against `main`.** Replaced inline `<style>` injection in `src/components/ui/Meteocon.tsx` with an allowlisted presentation-attribute transformer, added a Vite build-time sanitization plugin so bundled renderer assets contain no inline SVG style markup, extended canonical CSP verification with `scripts/verify-meteocon-csp.cjs`, and strengthened packaged Electron smoke tests to fail on renderer `style-src` violations. Work followed `docs/superpowers/plans/2026-08-31-csp-meteocon-remediation.md` Tasks 2, 3, and 4.

- **Completed the Electron test typecheck subsystem against `main`.** Eliminated the dedicated Electron test project's compiler debt and made it a permanent part of the canonical typecheck contract. Work followed `docs/superpowers/plans/2026-08-31-electron-test-typecheck.md` Tasks 3, 4, and 5.

- **Task 3 — Agent runtime fixture repairs.** Updated `electron/agent/runtime/agent-tool-executor.test.ts`, `electron/agent/runtime/chat-agent-runner.telemetry.test.ts`, `electron/agent/runtime/chat-agent-runner.test.ts`, and `electron/agent/runtime/trusted-agent-request.test.ts` to narrow discriminated `ToolResult` unions before field access, type hoisted forwarding mocks from their source function signatures, and supply complete `CustomAgentLayer` fixtures. Committed as `284baa81`.

- **Task 4 — Electron service fixture repairs.** Repaired typed fixtures across 17 files including `electron/services/providerAdapters.test.ts`, `electron/services/chatFolderBackupService.test.ts`, `electron/services/chatStorage.test.ts`, `electron/services/bridgeServer.test.ts`, `electron/services/windowsCredentialStore.test.ts`, `electron/services/themeService.test.ts`, `electron/services/configService.test.ts`, `electron/services/syncFolderWatcher.test.ts`, `electron/services/syncBridge.test.ts`, `electron/services/backgroundTaskManager.test.ts`, `electron/services/backgroundTaskManager.paidQueue.test.ts`, `electron/services/backgroundTaskManager.restart-idempotency.test.ts`, `electron/services/videoRetrieveService.telemetry.test.ts`, `electron/services/secureStore.test.ts`, `electron/ipc/updates.test.ts`, and `electron/ipc/configHandlers.test.ts`. Added a typed `makeBackgroundTask` factory, restored globals with `vi.unstubAllGlobals()`, matched Electron/Node mock signatures to real types, and fixed one source-owned contract defect: `src/shared/chatFolderContracts.ts` now declares the `backupPath` field that `chatFolderBackupService.ts` already returned at runtime. Committed as `21541890`.

- **Task 5 — Canonical typecheck integration.** Updated `package.json` `typecheck` script to `tsc --noEmit && tsc --noEmit --project tsconfig.electron.json && tsc --noEmit --project tsconfig.electron.test.json`. Updated `scripts/verify-release-packaging-hardening.cjs` and its test to enforce the new script contract, and confirmed `tsconfig.electron.test.json` carries `vitest/globals` types. Committed as `a6fc978c`.

- **Validation matrix:** `npm run lint:eslint` PASS (0 warnings); `npx tsc --noEmit --project tsconfig.electron.test.json` PASS (0 errors); `npm run typecheck` PASS (all three projects); `npm run test:electron` PASS (101 files / 1090 tests); `npx vitest run scripts/verify-release-packaging-hardening.test.ts --no-file-parallelism` PASS (11 tests); `npm test` PASS (494 files / 5521 tests / 1 skipped); `npm run verify:safety-guard` PASS; `npm run verify:markdown-links` PASS (274 Markdown files); `npm run verify:contracts` PASS (104 checks); `npm run build` PASS; `npm run ci` PASS (104 contract checks plus `verify:dist` PASS).

## Session History

### 2026-08-31 — Task 4 Replicate paid-submission durability review fixes.

- Scope: address the four open review findings in `.superpowers/sdd/2026-08-31-unified-hardening-coordinator/task-4-replicate-durability-brief.md` for the Replicate paid-submission durability implementation.
- Files changed:
  - `electron/services/paidSubmissionManager.ts`: guarded `persistAcceptanceUnknown` failures; added per-fingerprint FIFO lock; refactored `executeDurableSubmission` to start from a persisted task.
  - `electron/services/backgroundTaskManager.ts`: added optional `payloadHash` to `findActivePaidSubmission`.
  - `electron/services/boundedResponseReader.ts`: deadline-/size-raced fallback body reader; committed `StreamReadResult<T>` alias.
  - `electron/services/paidSubmissionManager.test.ts`: added persistence-failure and same-fingerprint/different-payload race tests.
  - `electron/services/boundedResponseReader.test.ts`: added fallback timeout and oversize tests.
  - `docs/superpowers/plans/2026-08-31-replicate-paid-submission-durability.md`: updated `findActivePaidSubmission` signature.
- Commit: `b45b064e fix: address Task 4 review findings for Replicate paid-submission durability`.
- Validation:
  - `npx vitest run electron/services/paidSubmissionManager.test.ts electron/services/boundedResponseReader.test.ts --no-file-parallelism` — PASS (19 tests)
  - `npx vitest run electron/services/paidSubmissionManager.test.ts electron/services/boundedResponseReader.test.ts electron/services/replicateService.test.ts electron/ipc/handlers/replicateHandlers.test.ts electron/services/backgroundTaskManager.replicate.test.ts electron/services/backgroundTaskManager.paidQueue.test.ts electron/services/backgroundTaskManager.restart-idempotency.test.ts --no-file-parallelism` — PASS (69 tests)
  - `npm run test:electron` — PASS (103 files / 1116 tests)
  - `npm run typecheck` — PASS (renderer, Electron, and Electron test projects)
  - `npm run lint:eslint` — PASS (0 warnings)
  - `npm run verify:venice-contract-drift` — PASS
  - `npm run build` — PASS
  - `npm test` — PASS (499 files / 5570 passed / 1 skipped)
- Notes: Unrelated dirty worktree changes were preserved; only the six task-owned files were staged and committed. Full fix report appended to `.superpowers/sdd/2026-08-31-unified-hardening-coordinator/task-4-report.md`.

### 2026-08-31 — CSP-001 Meteocon remediation completion.

- Scope: implement `docs/superpowers/plans/2026-08-31-csp-meteocon-remediation.md` Tasks 2, 3, and 4 to remove inline SVG style markup from source, build output, and packaged renderer while preserving production `style-src 'self'`.
- Task 2 commits (`00beabb6`):
  - `src/components/ui/Meteocon.tsx`: replaced runtime `<style>` injection with `adaptSvgForTheme()` and `applySvgPresentationOverrides()`; exported both for tests.
  - `src/components/ui/Meteocon.test.tsx`: added transformation, sanitization, and component render tests.
- Task 3 commits (`51ef09d0`):
  - `src/components/ui/meteoconSvgTransformer.ts`: shared allowlisted presentation-attribute transformer used at runtime and build time.
  - `scripts/vite-plugin-meteocon-csp.ts`: Vite plugin that sanitizes `@meteocons/svg/fill/*.svg?raw` imports during `build:web`.
  - `vite.config.ts`: registered the Meteocon CSP plugin.
  - `scripts/verify-meteocon-csp.cjs`: canonical CSP regression verifier scanning component source and built `dist` assets for inline `<style>` / `style=`.
  - `scripts/verify-meteocon-csp.test.ts`: unit tests for the scanner and import enumeration.
  - `scripts/verify-meteocon-csp.d.cts`, `scripts/jsdom.d.ts`: type declarations for the CJS verifier and jsdom plugin import.
  - `electron/utils/rendererCsp.ts`, `tests/csp/inlineStyleInvariant.test.ts`: updated comments to clarify that bundled SVG output must avoid inline styles and that `verify-meteocon-csp` owns that invariant.
  - `package.json`: added `verify:meteocon-csp` script and appended it to `verify:contracts:static`.
- Typecheck fix commit (`618bc059`): added missing type declarations and `@ts-expect-error` annotations so `npm run typecheck` passes.
- Task 4 commits (`f5f261d8`):
  - `tests/smoke/electron-smoke.test.ts`: collect `securitypolicyviolation` events and CSP-looking console messages; assert no `style-src` / inline-style violations in first-run and restored-profile packaged smoke paths.
- Validation:
  - `npx vitest run src/components/ui/Meteocon.test.tsx --no-file-parallelism` — PASS (12 tests)
  - `npx vitest run scripts/verify-meteocon-csp.test.ts tests/csp/inlineStyleInvariant.test.ts electron/utils/rendererCsp.test.ts --no-file-parallelism` — PASS (19 tests)
  - `npm run verify:meteocon-csp` — PASS (no violations in source or built assets)
  - `npm run build` — PASS
  - `npm run dist:mac:arm64` — PASS (produced signed/unsigned macOS arm64 artifact)
  - `RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts --no-file-parallelism` — PASS (4 tests)
  - `npm run typecheck` — PASS (renderer, Electron, and Electron test projects)
  - `npx eslint src/components/ui/Meteocon.tsx src/components/ui/Meteocon.test.tsx src/components/ui/meteoconSvgTransformer.ts scripts/vite-plugin-meteocon-csp.ts scripts/verify-meteocon-csp.test.ts electron/utils/rendererCsp.ts --max-warnings=0` — PASS
- Notes: No production CSP weakening; `rendererCsp(false)` still returns `style-src 'self'`. No general-purpose SVG sanitizer dependency was added. Unrelated dirty worktree changes were preserved and not staged.

### 2026-08-31 — Electron test typecheck subsystem completion.

- Scope: implement `docs/superpowers/plans/2026-08-31-electron-test-typecheck.md` Tasks 3, 4, and 5 to make the Electron test project a permanent, zero-error part of the canonical typecheck contract.
- Task 3 commits (`284baa81`):
  - `electron/agent/runtime/agent-tool-executor.test.ts`
  - `electron/agent/runtime/chat-agent-runner.telemetry.test.ts`
  - `electron/agent/runtime/chat-agent-runner.test.ts`
  - `electron/agent/runtime/trusted-agent-request.test.ts`
- Task 4 commits (`21541890`):
  - `electron/services/providerAdapters.test.ts`
  - `electron/services/chatFolderBackupService.test.ts`
  - `electron/services/chatStorage.test.ts`
  - `electron/services/bridgeServer.test.ts`
  - `electron/services/windowsCredentialStore.test.ts`
  - `electron/services/themeService.test.ts`
  - `electron/services/configService.test.ts`
  - `electron/services/syncFolderWatcher.test.ts`
  - `electron/services/syncBridge.test.ts`
  - `electron/services/backgroundTaskManager.test.ts`
  - `electron/services/backgroundTaskManager.paidQueue.test.ts`
  - `electron/services/backgroundTaskManager.restart-idempotency.test.ts`
  - `electron/services/videoRetrieveService.telemetry.test.ts`
  - `electron/services/secureStore.test.ts`
  - `electron/ipc/updates.test.ts`
  - `electron/ipc/configHandlers.test.ts`
  - `src/shared/chatFolderContracts.ts` (source contract fix: added `backupPath`)
- Task 5 commits (`a6fc978c`):
  - `package.json` (`typecheck` script)
  - `scripts/verify-release-packaging-hardening.cjs`
  - `scripts/verify-release-packaging-hardening.test.ts`
  - `tsconfig.electron.test.json`
- Validation:
  - `npx tsc --noEmit --project tsconfig.electron.test.json` — PASS (0 errors)
  - `npm run typecheck` — PASS (renderer, Electron, and Electron test projects)
  - `npm run test:electron` — PASS (101 files / 1090 tests)
  - `npx vitest run scripts/verify-release-packaging-hardening.test.ts --no-file-parallelism` — PASS (11 tests)
  - `npm test` — PASS (494 files / 5521 tests / 1 skipped)
  - `npm run lint:eslint` — PASS (0 warnings)
  - `npm run verify:safety-guard` — PASS
  - `npm run verify:markdown-links` — PASS (274 Markdown files)
  - `npm run verify:contracts` — PASS (104 checks)
  - `npm run build` — PASS
  - `npm run ci` — PASS (104 contract checks plus `verify:dist` PASS)
- No `@ts-ignore`, `@ts-expect-error`, blanket `any`, weaker strictness, or source/test exclusions were introduced.

### 2026-08-31 — Packaged macOS artifact verification and release-staging cleanup validation.

- Scope: prove the CI/packaging hardening changes do not break the actual packaged application build, smoke test, cleanup, and artifact verification sequence on macOS arm64.
- Ran `npm run dist:mac:arm64` locally; produced `release/Venice-Forge-3.0.0-beta.2-arm64.dmg`, `release/Venice-Forge-3.0.0-beta.2-arm64.zip`, blockmaps, `latest-mac.yml`, and the unpacked `release/mac-arm64/Venice Forge.app` bundle.
- Ran `RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts`; all 4 smoke tests passed (packaged Electron first-run onboarding and restored-profile bootstrap).
- Ran `node scripts/clean-release-staging.cjs`; it removed only the unpacked `release/mac-arm64/` staging directory and left all final installers/checksums/update metadata intact.
- Ran `node scripts/verify-dist.cjs --mac --arch arm64`; verified the DMG, ZIP, blockmaps, and `latest-mac.yml` with expected filenames and checksums.
- Result: the cleanup/verify ordering in `.github/workflows/ci.yml` is locally validated; smoke tests can consume unpacked staging before cleanup, and `verify-dist` can enforce the rejection of staging directories after cleanup.
- No files changed in this verification step beyond updating this ledger.

### 2026-08-31 — Theme Engine V2 YAML pipeline, family-centric ThemeMaker, and main-process V2 persistence.

- Scope: implement the deferred YAML V2 pipeline, refactor ThemeMaker to edit `ThemeFamily` objects with Light/Dark preview tabs, update Electron theme service/config handlers for V2 persistence, and update tests/verifiers.
- Created `src/theme/yaml/validate.ts` with strict raw-YAML checks (schemaVersion, id/name, variants, token allowlist, color safety, dangerous keys, built-in ID protection, optional base.tokens).
- Created `src/theme/yaml/normalize.ts` to convert validated V2 YAML into a canonical `ThemeFamily`, applying `completeThemeTokens` per variant and deterministic `base.tokens` inheritance.
- Created `src/theme/yaml/serialize.ts` for deterministic V2 YAML output with snake_case tokens.
- Created `src/theme/yaml/legacy.ts` for V1 `themes:` blocks and legacy flat terminal-color import paths, both returning `ThemeFamily`.
- Created `src/theme/yaml/parse.ts` to dispatch V2 → validate → normalize, or legacy V1/flat paths.
- Created `src/theme/yaml/index.ts` barrel and tests: `parse.test.ts`, `validate.test.ts`, `normalize.test.ts`, `serialize.test.ts`.
- Rewrote `src/components/ThemeMaker.tsx` to family-centric editing; draft is `ThemeFamily`; Light/Dark tabs are local `previewMode`; export uses `serializeThemeFamilyYaml`; import uses `parseThemeYaml`.
- Updated `electron/services/themeService.ts` with `ThemeFamilyV2` interface, `isThemeFamilyV2`, V2 file detection in `readThemeFile`, V2 merging in `loadAllThemes`, and V2 YAML writing in `saveTheme`.
- Updated `electron/ipc/configHandlers.ts` `config:saveTheme` handler to validate V2 shape before saving.
- Updated `src/stores/config-store.ts` `loadYamlThemes` to recognize V2 records and fall back to V1 conversion.
- Rewrote `src/components/ThemeMaker.ui.test.tsx` and `src/components/ThemeMaker.custom.test.tsx` for family identity, variant retention, and local preview tabs.
- Bounded semantic CSS audit: replaced hardcoded colors in `src/components/Chip.tsx` and `src/components/rp-studio/CharacterLibrary.tsx` with theme tokens.
- Added missing i18n key `common:surface.componentsThememaker.text.id` across all catalogs and allowlisted "ID:" as a technical token.
- Validation: `npm run lint:eslint` PASS; `npm run typecheck` PASS; `npm run verify:theme-tokens` PASS; `npm run verify:i18n` PASS; `npm run verify:i18n-hardcoded-regressions` PASS; `npx vitest run src/theme --no-file-parallelism` PASS (164 tests); ThemeMaker tests PASS (52 tests); theme service + config handler tests PASS (27 tests); `npm test` PASS (494 files / 5521 tests / 1 skipped).
- Deferred: companion variant generation refinement in `scripts/generate-theme-families.cjs`; further semantic CSS cleanup of debug-categorical colors in `PromptDebugDrawer.tsx` and static dark surface scale in `src/styles/theme.css`.

### 2026-08-31 — Theme Engine V2 theme track completion.

- Scope: convert built-in themes to `ThemeFamily` V2, migrate theme persistence/resolution, refactor ThemeMaker, and update theme tests/verifiers.
- Ran `node scripts/generate-theme-families.cjs` to rewrite 44 single-mode built-in theme files into 43 `ThemeFamily` objects. Fixed the script to dedupe aliases and format output consistently. Preserved the original variant exactly and generated the companion variant via HSL lightness mapping; the generated companions are structurally valid but need visual review.
- Merged `solarizedDark.ts` and `solarizedLight.ts` into `solarized.ts` with both authored variants and aliases for legacy ids.
- Rewrote `src/theme/builtins/index.ts` to export `BUILTIN_THEME_FAMILIES` and `DEFAULT_THEME_FAMILY`; removed `BUILTIN_THEMES` and `DEFAULT_THEME`.
- Updated `src/theme/applyTheme.ts` to accept `ResolvedTheme`, added `legacyThemeToFamily`, registered built-ins with the canonical registry, and made `resolveInitialTheme` use `migrateLegacyThemeId`, `migrateAppearanceMode`, and the registry. Restored light-mode fallback for `system`/`light` effective modes.
- Updated `src/stores/settings-store.ts` to type `appearanceMode` as `AppearanceMode`, coerced persisted values via `migrateAppearanceMode`, and bumped the persist version to v16.
- Updated `src/stores/config-store.ts` and `src/theme/yamlTheme.ts` to load YAML themes as `ThemeFamily` objects.
- Refactored `src/components/ThemeMaker.tsx` with `themeFromFamily`, `defaultEditableTheme`, `toResolvedTheme`, and `themeToFamily` helpers so the existing single-mode editor continues to work while built-ins are now families.
- Updated tests: `src/theme/themes.test.ts`, `src/theme/contrast.test.ts`, `src/theme/applyTheme.test.ts`, `src/components/ThemeMaker.test.ts`, `src/components/ThemeMaker.custom.test.tsx`, `src/components/ThemeMaker.ui.test.tsx`, `scripts/verify-theme-tokens.test.ts`.
- Strengthened `scripts/verify-theme-tokens.cjs` with `verifyBuiltinFamilies()` checking `schemaVersion: 2` and `variants.light/dark` in every built-in file.
- Validation: `npm run lint:eslint` PASS; `npm run typecheck` PASS (renderer + Electron); `npm run test:unit:theme` PASS (132 tests); `npm run verify:theme-tokens` PASS; ThemeMaker tests PASS (52 tests); `npm run test:unit` PASS across all suites.
- Blockers/deferred: full YAML V2 parse/validate/normalize/serialize pipeline (`src/theme/yaml/{parse,validate,normalize,serialize}.ts`) not implemented; ThemeMaker is family-aware but still edits single-mode themes rather than both variants side-by-side; Electron main-process theme service was not changed because the renderer-side IPC contract remains single-mode and conversion happens in `config-store.ts`; generated companion variants require visual review before final acceptance.

### 2026-08-31 — CI / Packaging Hardening track completion.

- Scope: implement the CI/packaging portion of the Theme Engine V2 & CI/Packaging Hardening mission without touching `src/theme/*` source files.
- Fixed `scripts/verify-ci-contract.cjs` so the aggregate coverage floor no longer collides with the lower `COVERAGE_SCRIPTS=true` thresholds in `vitest.config.ts`. The verifier now matches every threshold declaration and validates the final (aggregate) set. Added a spawn-based regression test in `scripts/verify-ci-contract.test.ts`.
- Replaced the placeholder `scripts/clean-release-staging.cjs` with a path-safe, idempotent implementation using an explicit allowlist (`mac`, `mac-x64`, `mac-arm64`, `win-unpacked`, `linux-unpacked`, `linux-arm64-unpacked`). Safety guards: refuses filesystem root, repository root, traversal paths, and the release directory itself; only acts on directories; logs removals.
- Added `scripts/clean-release-staging.test.ts` with 13 tests covering allowed removal, final-artifact preservation, idempotence, non-directory skip, allowlist enforcement, CLI argument parsing, and dangerous `--release-dir` rejection.
- Reordered the `electron-smoke-macos`, `electron-smoke-windows`, and `electron-smoke-linux` jobs in `.github/workflows/ci.yml` so cleanup runs after the smoke test and before artifact verification. Smoke tests require the unpacked staging directories; `verify-dist` rejects them, so this order satisfies both constraints. `release.yml` cleanup order is unchanged because release jobs do not run smoke tests.
- Confirmed both workflow files use `node-version-file: '.nvmrc'`, pinned action SHAs, the existing audit policy, and only existing scripts.
- Updated `docs/summary_of_work.md` and `docs/ROADMAP.md`.
- Validation: `npm run lint:eslint` PASS; `npm run typecheck` PASS; `npm run verify:ci-contract` PASS; `npm run test:unit:scripts` PASS (227 tests); `npm run test:coverage:scripts` PASS (227 tests); `npx vitest run scripts/clean-release-staging.test.ts --no-file-parallelism` PASS (13 tests); `node scripts/clean-release-staging.cjs && node scripts/verify-dist.cjs --mac --arch arm64` PASS.

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
* `P1-004` is closed locally by the real packaged-Electron onboarding/restored-profile harness. Windows and Linux execution remain pending hosted CI evidence for the uncommitted worktree.
* `CSP-001` is open. Raw `@meteocons/svg` markup contains CSP-blocked `style="mask-type:alpha"` attributes that `VERIFY-007` does not inspect; remediation is intentionally separate from P1-004.

## Validation Matrix

### 2026-08-31 — Electron test typecheck subsystem

- `npx tsc --noEmit --project tsconfig.electron.test.json` — PASS (0 errors)
- `npm run typecheck` — PASS (`tsc --noEmit`, `tsc --noEmit --project tsconfig.electron.json`, and `tsc --noEmit --project tsconfig.electron.test.json`)
- `npm run test:electron` — PASS (101 files / 1090 tests)
- `npx vitest run scripts/verify-release-packaging-hardening.test.ts --no-file-parallelism` — PASS (11 tests)
- `npm test` — PASS (494 files / 5521 tests / 1 skipped)
- `npm run lint:eslint` — PASS (0 warnings)
- `npm run verify:safety-guard` — PASS
- `npm run verify:markdown-links` — PASS (274 Markdown files)
- `npm run verify:contracts` — PASS (104 checks)
- `npm run build` — PASS
- `npm run ci` — PASS (104 contract checks plus `verify:dist` PASS)

### 2026-08-31 — CI / Packaging Hardening track

- `npm run lint:eslint` — PASS (zero warnings)
- `npm run typecheck` — PASS (renderer and Electron projects; Electron tests remain excluded from the explicit tsc contract)
- `npx vitest run scripts/verify-ci-contract.test.ts scripts/verify-dist.test.ts scripts/verify-release-metadata.test.ts scripts/clean-release-staging.test.ts --no-file-parallelism` — PASS (4 files, 62 tests)
- `npm run test:unit:scripts` — PASS (25 files, 227 tests)
- `npm run test:coverage:scripts` — PASS (25 files, 227 tests; scripts/ thresholds applied)
- `npm run verify:ci-contract` — PASS
- `node scripts/clean-release-staging.cjs && node scripts/verify-dist.cjs --mac --arch arm64` — PASS (DMG, ZIP, update metadata, blockmaps, and allowlist verified after staging cleanup)
- `.github/workflows/ci.yml` YAML syntax — valid
- `.github/workflows/release.yml` YAML syntax — valid
- `bash -n scripts/enforce-github-rules.sh` — syntax OK
- Full `npm test`, `npm run build`, fresh packaging, and hosted CI/CodeQL re-runs — NOT EXECUTED in this session; changes are limited to workflow, script, and documentation files.

### Previous sessions

- `npx vitest run src/stores/profile-store-helpers/sanitizePersistedProfileState.test.ts src/stores/profile-store.test.ts tests/smoke/electron-smoke.test.ts --no-file-parallelism` — PASS (38 passed, 1 smoke skipped without `RUN_ELECTRON_SMOKE=true`)
- `npm run lint:eslint` — PASS (zero warnings)
- `npm run typecheck` — PASS (renderer and Electron projects)
- `npm run dist:mac:arm64` — PASS (web/server/Electron build plus unsigned macOS arm64 DMG/ZIP packaging and checksums; existing ineffective dynamic-import warning for `src/services/chatTtsController.ts`)
- `RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts --no-file-parallelism` — PASS (4 tests; real packaged first-run/onboarding/restart/restored-profile IPC path)
- `npm run test:ui:layout` — PASS (14 files, 106 tests)
- `npm run test:electron` — PASS (101 files, 1,087 tests)
- `npm run verify:ci-contract` — PASS
- `npm run verify:markdown-links` — PASS (264 Markdown files)
- `npm run verify:agent-docs` — PASS
- `npm run verify:contracts` — PASS (104 release-packaging checks plus all static/feature contract gates)
- `node scripts/verify-dist.cjs --mac --arch arm64` — PASS (DMG, ZIP, update metadata, and blockmaps verified)
- `npm test` — PASS (489 files, 5,469 passed, 1 skipped)

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

### 2026-08-28 — Remediate CodeQL `js/insecure-temporary-file` security alert 256 in secure store test suite

- Addressed GitHub Code Scanning alert 256 (`js/insecure-temporary-file`) flagging insecure creation of temporary files in `os.tmpdir()` (`/tmp/secure-prefs.json`) in `electron/services/secureStore.test.ts`.
- Refactored `electron/services/secureStore.test.ts`:
  - Dynamically allocate a dedicated temporary directory via `fs.mkdtempSync(path.join(os.tmpdir(), "vf-secure-store-"))` in `beforeEach`.
  - Wire `app.getPath("userData")` via `vi.hoisted` mock to return the isolated temporary directory.
  - Relocate `STORE_PATH` to live inside the secure temporary directory (`0700` user-only permissions), eliminating predictable root `/tmp` path creation.
  - Clean up the directory recursively in `afterEach`.
- Validation: `npx vitest run electron/services/secureStore.test.ts` PASS (40 tests), `npm run test:electron` PASS (101 test files / 1087 tests), `npm run lint:eslint` PASS (zero warnings), `npm run typecheck` PASS, `npm run verify:safety-guard` PASS, `npm run verify:markdown-links` PASS, `npm run verify:contracts` PASS (104 checks), `npm run verify:agent-docs` PASS.

### 2026-08-29 — Close P1-004 real Electron onboarding/restored-profile bootstrap harness

- Reconciled the removed latest-handoff note, `src/App.onboarding.integration.test.tsx`, `src/main.tsx`, `src/stores/profile-store.ts`, preload/profile-session IPC, `tests/smoke/electron-smoke.test.ts`, and the macOS/Windows/Linux packaged smoke jobs before editing.
- Replaced the smoke's five-second process-survival assertion with a Playwright Electron flow over the actual packaged executable. The harness uses a private temporary `userData` directory, real packaged `file://` renderer, sandboxed/context-isolated preload, and registered main-process IPC handlers.
- Exercised the 18+ acknowledgment, Welcome, Profiles, Secure by Default, and Family Safe Mode screens through accessible roles, then completed onboarding and restarted with a persisted `restored-profile` record.
- Proved trusted main-process restoration without exposing a debug/session IPC: after restart, the renderer saved a bounded empty probe conversation through `window.veniceForge.chat.save`; the harness verified the file existed under `chat-history/profiles/restored-profile/` and did not exist in the default-profile directory.
- Fixed the discovered hydration bug by extending `sanitizePersistedProfileState()` and the profile-store safe merge to preserve `globalOnboardingCompleted` only when it is literally `true`; string/numeric/object values fall back to `false`.
- Added focused pure-sanitizer and real persist-rehydration tests for onboarding completion. No API key or other secret is seeded, read, logged, or exposed; secure-storage and renderer/main authority remain unchanged.
- Local limitations: only the macOS arm64 packaged path ran on this host. Windows and Linux use the same test file in their required CI smoke jobs but remain unverified in this uncommitted local session. The packaged renderer emitted existing non-fatal CSP inline-style violations; the harness records console errors and fails on page exceptions/fatal bootstrap patterns, while that separate CSP behavior remains outside this task.
- Nothing was committed or pushed.

### 2026-08-31 — Remediate August 30, 2026 re-audit configuration findings.

- Re-audited `main` at `5ee33ab4950f1ec059f9f7ebf5492848833e8ac1`; no new P0 or security-critical defects surfaced.
- **P1 tag/version parity:** Added `GITHUB_REF_NAME` vs. `package.json.version` check to `scripts/verify-release-metadata.cjs`; added matching tests; invoked the verifier in all three `release.yml` build jobs before packaging.
- **P1 branch protection smoke jobs:** Updated `scripts/enforce-github-rules.sh` required-status-checks list to include `electron-smoke-macos`, `electron-smoke-windows`, `electron-smoke-linux`, and `script-coverage`. Live `Rules01` sync remains a manual admin follow-up.
- **P2 script coverage CI job:** Added `script-coverage` job to `.github/workflows/ci.yml`; added it to the `build` job `needs:`; updated `scripts/verify-ci-contract.cjs` and its test to enforce the dependency.
- **P2 release artifact allowlist:** Added `buildReleaseAllowlist()` to `scripts/verify-dist.cjs`; reject unexpected top-level files/directories in `release/`; added tests. Added `scripts/clean-release-staging.cjs` and wired it before artifact verification in `ci.yml` smoke jobs and `release.yml`.
- **P2 Electron test typecheck:** Updated `tsconfig.electron.test.json` with `vitest/globals` types; adding the project to the `typecheck` script is deferred because it surfaces ~140 pre-existing type errors requiring a dedicated remediation pass.
- **P3 bypass actor:** Refreshed `.github/bypass_actors.md` with an explicit risk-acceptance note for the sole remaining admin bypass actor.
- Validation: `npm run lint:eslint` PASS; `npm run typecheck` PASS; targeted script tests PASS; `npm run verify:ci-contract` PASS; `node scripts/verify-dist.cjs --mac --arch arm64` PASS after staging cleanup.
- Updated `docs/summary_of_work.md` and `docs/ROADMAP.md`.

### 2026-08-29 — Diagnose packaged-renderer CSP inline-style violations

- Reproduced the violation in the unsigned macOS arm64 package with an isolated `userData` directory and captured Chromium security-log source locations and call stacks through Playwright/CDP.
- Confirmed the repeated CSP hash `sha256-QIjW/+aUzfg58HcITJNHkkCTGmLovNUIQbL+Zq2TsIE=` is the SHA-256 of `mask-type:alpha`, embedded as an inline `style` attribute in the imported `@meteocons/svg` `time-morning.svg` and `horizon.svg` files.
- Traced the boundary: `src/components/ui/Meteocon.tsx` imports the third-party SVGs with `?raw` and inserts them through React `dangerouslySetInnerHTML`; Chromium reports the violation at the React DOM assignment while enforcing production `style-src 'self'` from `electron/utils/rendererCsp.ts`.
- Ruled out the nearby imperative style paths as the reported source: theme CSS variables, reduced-motion state, Meteocon dimensions, sidebar width, and first-run body overflow were present in the live DOM despite the violations.
- Confirmed verifier drift: `tests/csp/inlineStyleInvariant.test.ts` scans only JSX `style={...}` and cannot see raw imported SVG attributes, while its header comment still describes production `'unsafe-inline'` despite the current `'self'`-only policy.
- Opened `CSP-001` in `docs/ROADMAP.md`. No CSP directive, SVG, component, verifier, or harness behavior was changed; remediation remains a separate scoped issue.
- Signed/notarized artifacts, installer and upgrade flows, screen-reader QA, paid-provider operations, and all other release-acceptance evidence remain under the existing external acceptance ledger (`VF-VERIFY-005`).

### 2026-08-31 — Replicate paid-submission durability (Task 4)

- Implemented `docs/superpowers/plans/2026-08-31-replicate-paid-submission-durability.md` Tasks 1–5.
- Added paid-submission lifecycle statuses (`intent_persisted`, `dispatching`, `acceptance_unknown`) and fields (`operation`, `dispatchStartedAt`, `acceptedAt`) to `src/types/background-task.ts`, with legacy `pending_finalize` migration and round-trip tests.
- Created `electron/services/paidSubmissionManager.ts` with `submitDurablePaidTask`, in-process deduplication, and conservative dispatch-failure classification.
- Exposed narrow fatal journal operations from `electron/services/backgroundTaskManager.ts` and updated restart classification for paid lifecycle states.
- Routed Replicate image generation in `electron/ipc/handlers/replicateHandlers.ts` through `submitDurablePaidTask` with deterministic SHA-256 fingerprinting (`sha256:<hex>`) and redacted IPC results.
- Added `electron/services/boundedResponseReader.ts` with size/deadline bounded reads and wired it into `electron/services/replicateService.ts` for control-plane and download bodies.
- Preserved existing Replicate security boundaries: model validation, allowed output hosts, redirect validation, MIME allowlist, 50 MiB cap, signature validation, Family Safe Mode screening, and profile isolation.
- Updated `src/components/status/TaskCenterDrawer.tsx` styling for the new statuses.
- Validation: `npx vitest run` focused suites PASS; `npm run test:electron` PASS (103 files / 1112 tests); `npm run typecheck` PASS; `npm run lint:eslint` PASS; `npm run verify:venice-contract-drift` PASS.
