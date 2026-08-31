# Theme Engine V2 and CI Package Reconciliation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reconcile, correct, validate, commit, and publish the inherited Theme Engine V2 and CI/package implementation without rewriting or losing existing work.

**Architecture:** Treat the dirty Theme/CI diff as an implementation candidate whose claims must be proved against the approved unified specification. Review schema/resolver/persistence/YAML/ThemeMaker boundaries first, then CI topology, artifact allowlists, cleanup safety, and packaged smoke ordering; correct only verified gaps and commit coherent theme and CI tranches separately.

**Tech Stack:** React 19, Zustand 5, TypeScript, YAML, semantic CSS variables, Vitest, Node verification scripts, GitHub Actions, electron-builder.

**Spec:** `docs/superpowers/specs/2026-08-31-unified-theme-ci-csp-electron-replicate-design.md`

## Global Constraints

- Preserve the inherited dirty diff and inspect every dirty file before editing it.
- Theme family ID and appearance mode remain independent durable values.
- Every shipping family has complete intentional light and dark variants.
- Built-in, custom, and YAML themes pass through one validator/normalizer contract.
- Invalid YAML is rejected atomically and cannot inject arbitrary CSS properties or dangerous object keys.
- Production UI uses semantic theme tokens; do not expand hardcoded-string/color allowlists to accept new debt.
- CI uses `.nvmrc`, pinned action SHAs, required script coverage, and existing audit policy.
- Release cleanup removes only verified staging directories after packaged smoke has consumed them.

---

### Task 1: Reconcile Theme Engine V2 module boundaries

**Files:**
- Review: `src/theme/themeTypes.ts`
- Review: `src/theme/schema.ts`
- Review: `src/theme/validation.ts`
- Review: `src/theme/registry.ts`
- Review: `src/theme/resolver.ts`
- Review: `src/theme/migration.ts`
- Review: `src/theme/applyTheme.ts`
- Review: `src/theme/index.ts`
- Review: `src/theme/builtins/index.ts`
- Review: `src/theme/builtins/*.ts`

**Interfaces:**
- Consumes: inherited Theme V2 implementation.
- Produces: one canonical `ThemeFamily -> ResolvedTheme -> DOM` lifecycle.

- [ ] **Step 1: Verify public type ownership**

Confirm the live types provide this semantic contract:

```ts
interface ThemeFamily {
  schemaVersion: 2;
  id: string;
  name: string;
  variants: { light: ThemeVariant; dark: ThemeVariant };
  aliases?: string[];
}

type AppearanceMode = "light" | "dark" | "system";

interface ResolvedTheme {
  id: string;
  name: string;
  mode: "light" | "dark";
  tokens: ThemeTokens;
}
```

If names differ, keep established repository names but ensure there is only one semantically equivalent public owner.

- [ ] **Step 2: Verify catalog completeness and uniqueness**

Run:

```bash
npx vitest run src/theme/themes.test.ts src/theme/contrast.test.ts --no-file-parallelism
```

Tests must assert every registered family has light and dark variants, IDs and aliases are unique, token keys are complete, and the registry protects built-in IDs from custom collisions.

- [ ] **Step 3: Verify resolver identity preservation**

Ensure tests cover:

```ts
expect(resolveTheme(midnightVelvet, "light").id).toBe(midnightVelvet.id);
expect(resolveTheme(midnightVelvet, "dark").id).toBe(midnightVelvet.id);
expect(resolveTheme(midnightVelvet, "system", "light").id).toBe(midnightVelvet.id);
```

The effective mode changes; the family ID does not.

- [ ] **Step 4: Verify `applyTheme` remains a DOM applicator**

`applyTheme` may set allowlisted CSS variables, `data-theme`, `data-theme-mode`, and completion events. It must not parse YAML, persist settings, repair families, or select fallback families.

- [ ] **Step 5: Run focused theme core tests**

```bash
npx vitest run src/theme/applyTheme.test.ts src/theme/themes.test.ts src/theme/contrast.test.ts --no-file-parallelism
npm run verify:theme-tokens
```

### Task 2: Reconcile YAML V2, migration, and persistence

**Files:**
- Review: `src/theme/yaml/parse.ts`
- Review: `src/theme/yaml/validate.ts`
- Review: `src/theme/yaml/normalize.ts`
- Review: `src/theme/yaml/serialize.ts`
- Review: `src/theme/yaml/*.test.ts`
- Review: `src/theme/yamlTheme.ts`
- Review: `src/stores/config-store.ts`
- Review: `src/stores/settings-store.ts`
- Review: `src/stores/profile-store.ts`
- Review: `src/stores/profile-store-helpers/sanitizePersistedProfileState.ts`
- Review: `electron/services/themeService.ts`
- Review: `electron/ipc/configHandlers.ts`

**Interfaces:**
- Consumes: V2 and legacy theme representations.
- Produces: deterministic V2 family persistence with atomic invalid-input failure.

- [ ] **Step 1: Verify raw YAML rejection tests**

Tests must reject:

```text
unknown top-level and variant keys
__proto__, prototype, and constructor
unsupported token names
invalid or unsafe color values
built-in ID collisions
missing light or dark variants after normalization
arbitrary CSS property names and CSS declaration strings
```

- [ ] **Step 2: Verify deterministic round-trip**

```ts
const first = parseThemeYaml(serializeThemeFamily(family));
const second = parseThemeYaml(serializeThemeFamily(first));
expect(second).toEqual(first);
```

- [ ] **Step 3: Verify atomic UI/service failure**

An invalid import or save returns a structured error and leaves the active family, selected family ID, appearance mode, and stored file unchanged.

- [ ] **Step 4: Verify legacy migration table**

Cover at least `builtin-light`, `builtin-dark`, `builtin-solarized-light`, `builtin-solarized-dark`, paired historical built-ins, and a custom single-mode theme. Migration must retain the family identity and derive the appearance preference deterministically.

- [ ] **Step 5: Verify one durable representation**

Persist `selectedThemeId` and `appearanceMode` separately. Confirm profile sanitization retains only valid values and does not reintroduce a competing legacy `theme` record as authoritative state.

- [ ] **Step 6: Run YAML, migration, store, and Electron service tests**

```bash
npx vitest run src/theme/yaml src/theme/migration.test.ts src/stores/profile-store.test.ts src/stores/profile-store-helpers/sanitizePersistedProfileState.test.ts electron/services/themeService.test.ts electron/ipc/configHandlers.test.ts --no-file-parallelism
```

### Task 3: Reconcile ThemeMaker and semantic UI behavior

**Files:**
- Review: `src/components/ThemeMaker.tsx`
- Review: `src/components/ThemeMaker.ui.test.tsx`
- Review: `src/components/ThemeMaker.custom.test.tsx`
- Review: `src/components/ThemeMaker.test.ts`
- Review: `src/components/Chip.tsx`
- Review: `src/components/rp-studio/CharacterLibrary.tsx`
- Review: `src/i18n/resources/*/common.json`
- Review: `docs/i18n/identical-value-allowlist.json`

**Interfaces:**
- Consumes: `ThemeFamily`, `AppearanceMode`, canonical resolver, and YAML serializer/parser.
- Produces: family-centric editing and preview with localized semantic UI.

- [ ] **Step 1: Verify preview tabs do not mutate durable selection**

Tests must assert that clicking Light or Dark changes local preview mode, edits the corresponding variant, and leaves `selectedThemeId` unchanged until explicit Apply/Save.

- [ ] **Step 2: Verify cancel and failed import restoration**

Capture the prior family, appearance setting, and preview state. Cancel and invalid import must restore them exactly with no partial token mutation.

- [ ] **Step 3: Verify save/export contains both variants**

Save and YAML export must contain `schemaVersion: 2`, the family ID, and complete `variants.light.tokens` plus `variants.dark.tokens`.

- [ ] **Step 4: Verify semantic styling and localization**

Run:

```bash
npm run verify:theme-tokens
npm run verify:i18n
npm run verify:i18n-hardcoded-regressions
```

Do not mark non-English catalogs native-reviewed. Technical identifier text may remain identical only when registered through the existing reviewed allowlist mechanism.

- [ ] **Step 5: Run ThemeMaker tests**

```bash
npx vitest run src/components/ThemeMaker.ui.test.tsx src/components/ThemeMaker.custom.test.tsx src/components/ThemeMaker.test.ts --no-file-parallelism
```

- [ ] **Step 6: Commit the validated theme tranche**

Explicitly stage the reviewed `src/theme`, ThemeMaker, theme service/config, relevant stores, focused semantic component, i18n, and theme verifier files. Inspect the cached diff, then:

```bash
git diff --cached --check
git commit -m "feat: preserve theme families across appearance modes"
```

Do not stage a reviewed file whose diff was classified as unrelated to the unified theme workstream.

### Task 4: Reconcile script coverage and CI dependency topology

**Files:**
- Review: `.github/workflows/ci.yml`
- Review: `.github/workflows/release.yml`
- Review: `vitest.config.ts`
- Review: `scripts/verify-ci-contract.cjs`
- Review: `scripts/verify-ci-contract.test.ts`
- Review: `scripts/verify-theme-tokens.cjs`
- Review: `scripts/verify-theme-tokens.test.ts`

**Interfaces:**
- Consumes: `npm run test:coverage:scripts` and theme verifier scripts.
- Produces: hosted workflow graph in which build requires script coverage and theme contracts.

- [ ] **Step 1: Verify script coverage configuration**

```bash
npm run test:coverage:scripts
```

Expected: script-only coverage executes with the configured thresholds and does not silently measure `src` or `electron` instead.

- [ ] **Step 2: Verify workflow topology**

The `script-coverage` job uses `.nvmrc`, runs `npm ci`, executes `npm run test:coverage:scripts`, and uploads its report on failure. The `build` job includes `script-coverage` in `needs`.

- [ ] **Step 3: Verify action and audit policy**

All external `uses:` entries remain pinned to 40-hex SHAs. Existing moderate production audit and critical full audit behavior remains unchanged unless an explicit policy document says otherwise.

- [ ] **Step 4: Run CI contracts**

```bash
npx vitest run scripts/verify-ci-contract.test.ts scripts/verify-theme-tokens.test.ts --no-file-parallelism
npm run verify:ci-contract
npm run verify:theme-tokens
```

### Task 5: Reconcile release artifact allowlist and cleanup ordering

**Files:**
- Review: `scripts/verify-dist.cjs`
- Review: `scripts/verify-dist.test.ts`
- Review: `scripts/clean-release-staging.cjs`
- Review: `scripts/clean-release-staging.test.ts`
- Review: `scripts/verify-release-metadata.cjs`
- Review: `scripts/verify-release-metadata.test.ts`
- Review: `tests/smoke/electron-smoke.test.ts`
- Review: `.github/workflows/ci.yml`
- Review: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: electron-builder release output.
- Produces: smoke-before-cleanup ordering and strict final-artifact verification.

- [ ] **Step 1: Run cleanup safety tests**

```bash
npx vitest run scripts/clean-release-staging.test.ts scripts/verify-dist.test.ts scripts/verify-release-metadata.test.ts --no-file-parallelism
```

Tests must reject repository root, release root, filesystem root, traversal, symlink escape, unknown directories, and required final artifacts. They must accept repeated cleanup of only allowlisted unpacked staging directories.

- [ ] **Step 2: Verify workflow lifecycle order**

For every platform:

```text
package
→ checksum/final metadata
→ packaged smoke using unpacked application
→ clean allowlisted staging
→ verify-dist rejecting unknown remaining entries
→ upload final allowlisted artifacts
```

- [ ] **Step 3: Verify tag/version parity**

`GITHUB_REF_NAME=v<package version>` passes; a different release tag fails before packaging.

- [ ] **Step 4: Run locally applicable verifier commands**

```bash
npm run verify:release-metadata
npm run verify:ci-contract
npm run verify:dist
```

`verify:dist` may require existing release artifacts. If absent, build the macOS arm64 artifacts in the next step rather than changing the verifier.

- [ ] **Step 5: Run packaged macOS lifecycle**

```bash
npm run dist:mac:arm64
RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts --no-file-parallelism
node scripts/clean-release-staging.cjs
node scripts/verify-dist.cjs --mac --arch arm64
```

- [ ] **Step 6: Commit the validated CI/package tranche**

Explicitly stage only reviewed workflow, verifier, cleanup, smoke, ruleset-helper, and bypass-rationale files, then:

```bash
git diff --cached --check
git commit -m "ci: harden script coverage and release staging"
```

### Task 6: Record reconciliation evidence without overclaiming

**Files:**
- Modify: `docs/summary_of_work.md`
- Modify: `docs/ROADMAP.md`

**Interfaces:**
- Consumes: actual Theme/CI commands and packaged evidence.
- Produces: current authoritative status.

- [ ] **Step 1: Replace inherited claims with final-tree evidence**

Record exact commands, exit status, test totals, skipped tests, coverage results, and packaged artifacts. Distinguish static validation, macOS packaged validation, hosted validation, and manual theme visual acceptance.

- [ ] **Step 2: Keep external evidence open when not observed**

Do not close Windows/Linux packaging, hosted CI/CodeQL, paid provider operations, signing/notarization, screen-reader QA, native-speaker translation review, or full manual dual-mode theme inspection without direct evidence.
