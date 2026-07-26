# Work Summary — VF-I18N-REMEDIATION-20260725-01 Foundation Phase

**Date:** 2026-07-26
**Work order:** `VF-I18N-REMEDIATION-20260725-01`
**Phases closed:** 0, 1, 3, 6
**Phases deferred:** 5 (TSX hardcoded-string sweep), 9 (prompt-language audit), 10 (docs localization integrity)
**Phases verified-existing:** 7 (aliases), 8 (formatters)

## Repository State

Working tree at session start was on commit `6723990 feat: implement multi-language support (v3.0.0-beta.2)` with 142 dirty files (the entire `src/i18n/resources/` locale tree, `scripts/verify-i18n.cjs`, `scripts/generate-locales.cjs`, `src/i18n/locales.ts`, `docs/i18n/translation-status.json`). The repo was in a known false-green state: the previous "Latest Session Summary" in `docs/summary_of_work.md` falsely claimed "Full UI, CI, and layout tests have passed successfully" while the locale catalogs were filled with `[XX]` sentinels and the verifier accepted them as translated. The session did not rewrite `src/i18n/{index.ts,formatters.ts,direction.ts}` — those pre-existing implementations were left intact.

## Scope

Foundation-only. The 65-section multilingual UI audit from the work order cannot be completed in a single agent session. Native translations, packaged-Electron manual QA across 11 non-English locales, and full TSX migration of remaining hardcoded strings were explicitly deferred. What I committed to: discrepancy freeze, AST-based extractor, safe additive sync tool, sentinel-aware verifier, obsolete-script lockdown, truthful status JSON, package.json scripts, ledger updates, and end-to-end gate records.

## Verified Findings

1. **False-green in `scripts/verify-i18n.cjs:190-195`.** The condition `if (locVal !== enVal || ALLOWLISTED_IDENTICAL.has(enVal)) { localeTranslated++; }` treats any sentence that differs from English as "translated," so `[RU] On`, `[DE] Chat`, `[FR] Auto` count as successful translations.
2. **Sentinel producer in `scripts/generate-locales.cjs:837-849`.** A regex `translateStringPattern` prefixes `[RU]/[DE]/[FR]/[JA]/[ZH]/[ES]/[PT]/[HI]/[AR]/[KO]/[SV]` to every leaf missing from the hand-curated dictionary at lines 116-694.
3. **`docs/i18n/translation-status.json` was a greenwriting artefact.** The verifier wrote `uiCoveragePercent: 100`, `docsCoveragePercent: 100`, `reviewStatus: complete` for all 12 locales on each run; that was a self-confirming artefact, not measurement.
4. **`docs/summary_of_work.md` carried the false-green claim.** The previous "Latest Session Summary" pre-session entry had to be demoted before the new truthful entry could be authored on top of it.
5. **Locale registry already covers 12 languages (`src/i18n/locales.ts`).** Aliases (`en→en-US`, `zh/zh-Hans→zh-CN`, `sv/SE/sv-SE→sv-SE`, `pt→pt-BR`) and RTL handling for `ar` are already wired — no changes required for Phase 7.
6. **Locale-aware formatters already wired (`src/i18n/formatters.ts` + `index.ts`).** `formatNumber`, `formatDate`, `formatTime`, `formatBytes`, `formatDimensions` plus `setFormatterLocale` are already invoked on init and `changeLanguage` — Phase 8 verified-existing.
7. **Pre-existing latent lint/test gates.** Reproduced by stashing my catalog and tooling changes and re-running the failing test files; the 7 problems (lint) and 11 unit-test failures are independent of my work.

## Changes Made

### Phase 0: discrepancy freeze

- `docs/summary_of_work.md` Latest Session Summary re-authored with truthful evidence; previous false-green entry demoted to "Prior Session Summary (UI Localization Regression Test Selector Fixes) [demoted — superseded by VF-I18N-REMEDIATION-20260725-01]".
- `docs/ROADMAP.md` amended with `VF-I18N-REMEDIATION-20260725-01` and per-phase close/defer status.

### Phase 1: AST source-key inventory (replaces regex extractor)

- `scripts/extract-i18n-keys.cjs` rewritten using `ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true)`.
- Handles: multi-line `t(...)`, template-literal args (static-position only), `useTranslation("ns")`, `useTranslation({ keyPrefix })`, `<Trans i18nKey="...">`, `i18next.t(...)`, `i18n.t(...)`.
- Refuses: dynamic identifiers, template expressions with substitution, and `keyPrefix` that collides with an explicit-namespace key.
- Output: `artifacts/i18n/source-key-inventory.{json,md}`.
- Current run: 445 usages, 410 unique keys, 0 missing in en-US, 385 unused leaf entries.

### Phase 3: safe catalog sync tool

- `scripts/sync-catalogs.cjs` new. `mergeTreeAdditive(seed, localeTree)` only adds missing keys, replaces `[XX]` sentinel leaves with `__MISSING__:<keyPath>`, never overwrites an existing real translation. Refuses to operate on locales without a real human-verified seed (en-US only by default). Writes `artifacts/i18n/catalog-sync-report.json`.
- CLI: `--allow-seed-override` for emergency migration.

### Phase 6: sentinel-aware i18n verifier

- `scripts/verify-i18n.cjs` rewritten. Detects:
  - Sentinel leaf regex: `^\s*\[[A-Za-z][A-Za-z-]{1,10}\]\s`.
  - Missing-marker leaf regex: `^\s*__MISSING__:`.
  - Interpolation-variable mismatch (`{{name}}` set diff vs en-US).
  - Source-code-key existence vs en-US canonical.
- CLI: `--strict`, `--allow-sentinels`, `--allow-missing-markers`, `--locales`, `--namespaces`.
- Status JSON schema v2 with truthful per-locale stats and `reviewStatus` that requires *all four* axes clean before declaring `complete`.
- Programmatic API `runVerification({...})` with `skipSourceInventory / writeStatus / statusPath` overrides for tests.

### Obsolete-script lockdown

- `scripts/generate-locales.cjs` head-of-file guard: refuses direct invocation, exit 2. Removed from `package.json` aliases.
- `scripts/populate-en-us-catalogs.cjs` head-of-file guard: refuses unless `--legacy-seed` flag. Not exposed via `package.json`.

### Tooling tests

- `scripts/i18n-tooling.test.ts` (vitest, 12 cases / 3 describe blocks). Covers extractor AST scoping, sync tool additive semantics, verifier sentinel/missing-marker/interpolation rejection. Run via existing `test:unit:scripts` (no new package.json entry required).

### `package.json` new scripts

- `i18n:extract` — `node scripts/extract-i18n-keys.cjs`.
- `i18n:sync-catalogs` — `node scripts/sync-catalogs.cjs`.
- `i18n:coverage` — `npm run verify:i18n` (alias).

### Documentation

- `docs/summary_of_work.md` Latest Session Summary re-authored.
- `docs/ROADMAP.md` `VF-I18N-REMEDIATION-20260725-01` entry updated.
- `docs/DOCS_INDEX.md` new entry for `docs/DEVELOPMENT/i18n-tooling.md`.
- `docs/DEVELOPMENT/i18n-tooling.md` new — translator/developer workflow and verbatim status-JSON schema.

## Files Changed

```
scripts/extract-i18n-keys.cjs   (TS Compiler API rewrite; was regex)
scripts/sync-catalogs.cjs       (NEW)
scripts/i18n-tooling.test.ts    (NEW — 12 cases)
scripts/populate-en-us-catalogs.cjs  (NEW — retirement guard only)
scripts/generate-locales.cjs    (head-of-file retirement guard; body unchanged)
scripts/verify-i18n.cjs         (sentinel + missing-marker + interpolation detection; schema v2 status JSON)
docs/summary_of_work.md         (Latest Session Summary re-authored)
docs/ROADMAP.md                 (VF-I18N-REMEDIATION-20260725-01 entry refreshed)
docs/DOCS_INDEX.md              (DEVELOPMENT/i18n-tooling.md registered)
docs/DEVELOPMENT/i18n-tooling.md  (NEW)
docs/i18n/translation-status.json  (regenerated by verifier — schema v2)
package.json                    (i18n:extract / i18n:sync-catalogs / i18n:coverage scripts)
src/i18n/resources/<locale>/<namespace>.json  (11 locales × 12 namespaces — sentinels replaced with __MISSING__:)
src/i18n/locales.ts             (diff in dirty worktree pre-session; no semantic change this session)
```

`git diff --stat src/i18n docs/i18n package.json`: 138 files changed, 11254 insertions, 4328 deletions.

## Tests Added or Updated

- New: `scripts/i18n-tooling.test.ts` — extractor (5 cases), sync catalog (3 cases), verifier (4 cases). All 12 PASS.
- Unchanged: `src/i18n/i18n.test.ts` — pre-existing 2 failures (locale count and Arabic `Save` → `حفظ`) recorded as pre-existing; root cause independent of this session.
- Unchanged: 9 other pre-existing test failures across `scripts/verify-release-metadata.test.ts`, `src/components/character-creator/CharacterCreatorView.test.tsx`, `src/components/settings/ProfilePanel.test.tsx` — recorded honestly, not my regressions.

## Commands Executed

```
set -euo pipefail; EXPECTED_ROOT=/Users/super_user/Projects/Venice_Forge; EXPECTED_BRANCH=main; ...   # AGENTS.md §2 bootstrap
node scripts/extract-i18n-keys.cjs
node scripts/sync-catalogs.cjs
node scripts/verify-i18n.cjs
node scripts/generate-locales.cjs           # exit 2 (retired)
node scripts/populate-en-us-catalogs.cjs    # exit 2 (retired)
npx vitest run scripts/i18n-tooling.test.ts  # 12/12 PASS
npm run typecheck                           # PASS
npm run build                               # PASS
npm test                                    # 4669/4681 PASS (11 pre-existing failures)
npm run lint:eslint                         # 7 pre-existing problems
npm run verify:contracts                    # exits 1 on bundle budget (pre-existing)
npm run verify:safety-guard                 # exits 1 on settings:safety false positive (pre-existing)
npm run verify:markdown-links               # PASS (237 files)
npm run verify:agent-docs                   # PASS
npm run ci                                  # fails at lint, downstream not reached
```

## Validation Results

| Gate | Result | Notes |
| --- | --- | --- |
| `npm run typecheck` | PASS | tsc default + tsc tsconfig.electron |
| `npm run build` | PASS | main bundle 337 KB, vendor math 252 KB, vendor pdfjs 415 KB, etc. |
| `npm test` | 4669/4681 PASS, 11 fail | 4 files, all pre-existing |
| `npx vitest run scripts/i18n-tooling.test.ts` | 12/12 PASS | new test file |
| `npm run lint:eslint` | 7 pre-existing problems | not introduced by this session |
| `npm run verify:contracts` | 1 fail (pre-existing) | `verify:bundle-budget` `sync-packet-importer-*.js` 362.99 KB > 300 KB |
| `npm run ci` | fails at lint | identical to above lint gap |
| `npm run verify:markdown-links` | PASS | 237 files |
| `npm run verify:agent-docs` | PASS | |
| `verify:safety-guard` | false positive (pre-existing) | `t('settings:safety.*')` matches `/disable.*safety/` regex |
| `npm run verify:i18n` | fails with 8,321 errors | expected: every sentinel/missing-marker in real catalogs |

The 11 pre-existing test failures were verified independent of my changes by stashing my catalog diff and re-running the failing test files; the same failures occurred at HEAD catalog state.

## Manual QA

Not run. Manual packaged-Electron QA across 11 non-English locales and three viewport classes is the external acceptance row under `VF-VERIFY-005`; it is the gate that cannot be automated and was explicitly deferred to multi-human/multi-session execution per the work-order scope.

## Documentation Updated

- `docs/summary_of_work.md` (Latest Session Summary re-authored; previous false-green demoted).
- `docs/ROADMAP.md` (`VF-I18N-REMEDIATION-20260725-01` per-phase close/defer status).
- `docs/DOCS_INDEX.md` (new `DEVELOPMENT/i18n-tooling.md` entry).
- `docs/DEVELOPMENT/i18n-tooling.md` (new developer/translator workflow doc).
- `docs/i18n/translation-status.json` (regenerated by verifier — schema v2 with sentinelLeaves / missingMarkerLeaves / identicalUnapprovedLeaves / docsCoveragePercent / reviewStatus).
- `artifacts/i18n/source-key-inventory.{json,md}` (regenerated by extractor — 445 source usages, 410 unique keys).
- `artifacts/i18n/catalog-sync-report.json` (regenerated by sync tool — per-namespace per-locale stats).

## Remaining Risks

- **Translations are mostly missing.** Current per-locale coverage from `translation-status.json`: en-US 100%, ru 28.7%, es 27%, fr 25.5%, de 24.7%, zh-CN 24.7%, ja 23.5%, pt-BR/hi/ar/ko/sv-SE 1.8% each. ru/es/fr/de/zh/ja have a small subset of hand-curated translations; pt-BR/hi/ar/ko/sv-SE have only the 14 identical-allowlisted product/protocol names. Releasing without completing the translation catalogue would put nonsense strings (`__MISSING__:...`) in front of users — that is exactly the failure mode the work order rejects.
- **TSX hardcoded strings remain unflagged.** `verify-i18n.cjs` does not yet perform the AST-based hardcoded JSX string detection that the work order asks for. Phase 5 deferred.
- **Docs localization is partial.** `docs/i18n/<locale>/<page>.md` files exist as partial placeholders, not full translations. Phase 10 deferred.
- **`config/prompt-language-audit.json` not audited.** Phase 9 deferred — requires domain expertise on Venice providers.
- **Pre-existing gates.** `npm run ci` continues to fail at `lint:eslint` (7 pre-existing problems) and `verify:contracts` (bundle budget). Recorded honestly in `docs/summary_of_work.md` Latest Session Summary so a follow-up maintainer can address them.

## Deferred Work

- **Native-language translations.** All non-English locales need real human translations and `__MISSING__:` markers replaced. This is multi-session/multi-human; an automated agent cannot author native-quality copies.
- **Packaged Electron manual QA** across 11 non-English locales and three viewport classes. Multi-human.
- **Phase 5 — AST-based hardcoded JSX string sweep.** `scripts/verify-i18n.cjs` does not flag `<div>Save</div>` literal strings.
- **Phase 9 — `config/prompt-language-audit.json` review.** Provider-domain expertise required.
- **Phase 10 — docs localization integrity check.** `docs/i18n/<locale>/` needs language-consultant review.
- **One-time latent cleanup of pre-existing lint failures in `scripts/generate-locales.cjs` (locked-down, but contains 1 warning + 2 errors)** and three `react-hooks/exhaustive-deps` warnings in `SettingsView.tsx` / `BackupSyncPanel.tsx` / `ProvidersPanel.tsx`.
