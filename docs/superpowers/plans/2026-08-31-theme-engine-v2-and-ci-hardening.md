# Theme Engine V2 & CI/Packaging Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Modernize the theme subsystem to a family/variant architecture with YAML hardening, and safely harden CI script-coverage, packaged-build verification, and release-staging cleanup without regressing the green pipeline.

**Architecture:** The theme work introduces a versioned `ThemeFamily` schema (family identity + light/dark variants), a centralized resolver, a single registry for built-ins/custom/YAML, migration aliases for legacy IDs, and strict YAML validation. The CI work retains the existing green pipeline, makes `script-coverage` a required build gate, documents release-artifact dependencies, and either implements a safe `clean-release-staging.cjs` or omits it with documented rationale.

**Tech Stack:** TypeScript, React, Vite, Vitest, Zustand, electron-builder, GitHub Actions, Node.js 22.15.0.

**Spec:** `docs/superpowers/specs/2026-08-31-theme-engine-v2-and-ci-hardening-design.md`

## Global Constraints

- Node.js pinned to `>=22.15.0 <23.0.0` via `package.json` engines and `.nvmrc`; workflows must use `node-version-file: '.nvmrc'`.
- Work on `main`; do not create branches, commits, or PRs unless explicitly requested.
- All workflow external actions must remain pinned to a full 40-hex SHA.
- Do not weaken existing coverage thresholds or remove existing gates.
- Preserve the existing Electron security posture (contextIsolation, nodeIntegration, sandbox, webSecurity, CSP, navigation restrictions).
- Update `docs/summary_of_work.md` before completing.
- Treat theme YAML as untrusted structured data; reject invalid YAML atomically.
- Existing valid user custom/YAML themes must migrate safely; shipping built-ins must be complete.
- Release cleanup must never remove artifacts required by `verify-dist` or packaged smoke tests.
- Do not reference `clean-release-staging.cjs` in workflows before the file exists and its contract is proven.

## Baseline Observations

- Current HEAD is `5ee33ab4950f1ec059f9f7ebf5492848833e8ac1`, matching the audit baseline.
- The worktree contains uncommitted changes from the prior audit-remediation session that overlap with the CI hardening track (`script-coverage` job, `clean-release-staging.cjs`, `verify-dist` allowlist, branch-protection helper updates). These changes should be incorporated and completed rather than discarded.
- `src/theme/` currently uses a flat catalog of single-mode themes in `src/theme/builtins/`.
- `verify:theme-tokens` already exists and must be strengthened, not bypassed.

---

### Task 1: Write the consolidated design spec

**Files:**
- Create: `docs/superpowers/specs/2026-08-31-theme-engine-v2-and-ci-hardening-design.md`

**Interfaces:**
- Consumes: The agent handoff, current theme files, current CI workflows.
- Produces: A single authoritative design document covering Theme Engine V2 and CI hardening.

- [ ] **Step 1: Summarize the theme architecture migration**

Document the old flat theme model versus the new `ThemeFamily` model, the resolver boundary, persistence source of truth, YAML V2 schema, migration aliases, and ThemeMaker V2 UX.

- [ ] **Step 2: Summarize the CI hardening changes**

Document the baseline green state, the `script-coverage` job integration, the release artifact dependency map, and the decision criteria for `clean-release-staging.cjs`.

- [ ] **Step 3: Self-review the spec**

Check for gaps, contradictions, and ambiguous scope. Ensure both workstreams are covered.

---

### Task 2: Theme baseline audit and inventory

**Files:**
- Read: `src/theme/themeTypes.ts`, `src/theme/builtins/index.ts`, all `src/theme/builtins/*.ts`, `src/theme/applyTheme.ts`, `src/theme/yamlTheme.ts`, `src/stores/settings-store.ts`, `src/stores/config-store.ts`, `src/components/ThemeMaker.tsx`, `scripts/verify-theme-tokens.cjs`.

**Interfaces:**
- Consumes: Existing theme definitions and persistence code.
- Produces: A concrete inventory table mapping current IDs to proposed `ThemeFamily` IDs, variants, and legacy aliases.

- [ ] **Step 1: Inventory every built-in theme**

Record current ID, display name, source file, current mode, token completeness, existing counterpart, proposed family ID, and legacy alias.

- [ ] **Step 2: Map theme call graph and persistence**

Trace all uses of `selectedThemeId`, `appearanceMode`, `customThemes`, `yamlThemes`, `applyTheme`, `loadMergedThemes`, `saveTheme`, `deleteTheme`, and desktop-bridge theme APIs.

- [ ] **Step 3: Document YAML import/export path**

Map how `yamlTheme.ts` parses, validates, normalizes, and persists YAML themes; identify silent-default behaviors and injection risks.

---

### Task 3: Theme core schema, validation, registry, and resolver

**Files:**
- Create: `src/theme/schema.ts`, `src/theme/validation.ts`, `src/theme/registry.ts`, `src/theme/resolver.ts`, `src/theme/migration.ts`.
- Modify: `src/theme/themeTypes.ts`.

**Interfaces:**
- Consumes: Existing `ThemeTokens` type and theme metadata conventions.
- Produces: `ThemeFamily`, `ThemeVariant`, `ResolvedTheme`, `resolveTheme(family, appearanceMode, systemAppearance)`, `themeRegistry`, `migrateLegacyThemeId(id)`.

- [ ] **Step 1: Define versioned ThemeFamily types**

```ts
type ThemeMode = "light" | "dark";
type AppearanceMode = "light" | "dark" | "system";

interface ThemeFamily {
  schemaVersion: 2;
  id: string;
  name: string;
  variants: Record<ThemeMode, ThemeVariant>;
  description?: string;
  author?: string;
  builtIn?: boolean;
  aliases?: string[];
}

interface ThemeVariant {
  tokens: ThemeTokens;
}

interface ResolvedTheme {
  id: string;
  name: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
}
```

- [ ] **Step 2: Implement theme resolver**

`resolveTheme(family, appearanceMode, systemAppearance): ResolvedTheme` must return the correct variant without changing family ID.

- [ ] **Step 3: Implement registry and migration aliases**

`themeRegistry` lists built-ins, custom themes, YAML themes, and resolves legacy aliases. `migrateLegacyThemeId` maps old IDs like `builtin-solarized-dark` to `{ themeId: "solarized", preferredMode: "dark" }`.

- [ ] **Step 4: Add core unit tests**

Test resolver behavior for `light`, `dark`, `system`, unknown families, and alias resolution.

---

### Task 4: Convert built-in themes to families

**Files:**
- Modify: All `src/theme/builtins/*.ts` and `src/theme/builtins/index.ts`.

**Interfaces:**
- Consumes: `ThemeFamily` schema from Task 3.
- Produces: Every shipping built-in as a `ThemeFamily` with intentional light and dark variants.

- [ ] **Step 1: Consolidate obvious pairs**

`solarizedDark.ts` + `solarizedLight.ts` → `solarized.ts` with `variants.light` and `variants.dark`.

- [ ] **Step 2: Create missing companions for single-mode themes**

For each dark-only theme, design a recognizable light variant preserving accent, saturation, surface hierarchy, and personality. For each light-only theme, design a dark variant. Do not invert RGB or fall back to generic `builtin-light`/`builtin-dark`.

- [ ] **Step 3: Update builtins index**

Export a flat registry of `ThemeFamily` objects keyed by family ID.

- [ ] **Step 4: Add catalog completeness tests**

```ts
for (const family of builtInFamilies) {
  expect(family.variants.light).toBeDefined();
  expect(family.variants.dark).toBeDefined();
}
```

---

### Task 5: Theme persistence migration

**Files:**
- Modify: `src/stores/settings-store.ts`, `src/stores/config-store.ts`, `src/services/desktopBridge*`, relevant main/preload files.

**Interfaces:**
- Consumes: `ThemeFamily`, `resolveTheme`, `migrateLegacyThemeId`.
- Produces: One durable theme representation: `{ selectedThemeId: string; appearanceMode: AppearanceMode }`.

- [ ] **Step 1: Migrate persisted theme state**

On hydration, convert legacy `selectedThemeId` and `appearanceMode` values using migration aliases. Persist only family ID and appearance preference.

- [ ] **Step 2: Preserve custom/YAML themes**

Migrate existing valid single-mode custom themes into `ThemeFamily` by preserving their original variant and generating an explicit companion-generation/review path; do not delete them.

- [ ] **Step 3: Add migration tests**

Test legacy IDs (`builtin-light`, `builtin-dark`, `builtin-solarized-dark`, `builtin-solarized-light`, custom themes) convert deterministically.

---

### Task 6: YAML V2 ingestion

**Files:**
- Create: `src/theme/yaml/parse.ts`, `src/theme/yaml/validate.ts`, `src/theme/yaml/normalize.ts`, `src/theme/yaml/serialize.ts`.
- Modify: `src/theme/yamlTheme.ts`.

**Interfaces:**
- Consumes: `ThemeFamily` schema and validation rules.
- Produces: `parseThemeYaml(yaml): ThemeFamily`, `validateThemeFamily(obj): string[]`, `serializeThemeYaml(family): string`.

- [ ] **Step 1: Define V2 YAML schema**

```yaml
schemaVersion: 2
id: midnight-velvet
name: Midnight Velvet
variants:
  light:
    tokens: { background: "#...", ... }
  dark:
    tokens: { background: "#...", ... }
```

- [ ] **Step 2: Implement strict validation**

Validate required fields, unknown keys, token names against allowlist, color formats, and reject dangerous keys (`__proto__`, `prototype`, `constructor`). Invalid YAML must fail atomically with actionable diagnostics.

- [ ] **Step 3: Implement round-trip serialization**

`ThemeFamily → YAML → ThemeFamily` must be semantically stable.

- [ ] **Step 4: Add YAML security tests**

Cover valid V2, invalid syntax, missing variants, unknown tokens, malformed colors, arbitrary CSS injection, dangerous keys, duplicate IDs, built-in ID collision.

---

### Task 7: ThemeMaker V2

**Files:**
- Modify: `src/components/ThemeMaker.tsx`, `src/components/ThemeMaker.ui.test.tsx`, `src/components/ThemeMaker.custom.test.tsx`.

**Interfaces:**
- Consumes: `ThemeFamily`, `resolveTheme`, registry APIs.
- Produces: Family-level editor with Light/Dark tabs; preview resolves family + preview mode without mutating global settings until Save/Apply.

- [ ] **Step 1: Refactor editor around ThemeFamily**

UX: select family → [Light] [Dark] tabs → edit variant tokens → preview.

- [ ] **Step 2: Remove generic mode-switch substitution**

Changing the Light/Dark tab must not change `selectedThemeId` to `builtin-light`/`builtin-dark`.

- [ ] **Step 3: Update tests**

Rewrite obsolete expectations in `ThemeMaker.ui.test.tsx` to assert family identity preservation, variant retention, and YAML import/export of both variants.

---

### Task 8: Semantic CSS / application-wide token audit

**Files:**
- Search: `src/**/*.ts`, `src/**/*.tsx`, `src/**/*.css`, `src/**/*.scss`.
- Modify: Files with hard-coded theme colors or non-semantic `var(--*)` usage.

**Interfaces:**
- Consumes: Semantic token catalog.
- Produces: CSS that flows from resolved tokens only.

- [ ] **Step 1: Search for theme-related CSS**

Find `data-theme`, `data-theme-mode`, hard-coded colors, inline styles, and theme-specific selectors.

- [ ] **Step 2: Replace with semantic tokens**

Map legitimate application-theme hardcoding to semantic tokens. Do not alter colors intrinsic to media/content.

- [ ] **Step 3: Ensure applyTheme is the only DOM applicator**

`applyTheme.ts` receives a `ResolvedTheme` and sets CSS variables, `data-theme`, and `data-theme-mode` only.

---

### Task 9: Strengthen verify:theme-tokens

**Files:**
- Modify: `scripts/verify-theme-tokens.cjs`.

**Interfaces:**
- Consumes: Built-in registry and `ThemeFamily` schema.
- Produces: Enforced catalog completeness checks.

- [ ] **Step 1: Validate every family has light and dark**

- [ ] **Step 2: Validate required tokens and unique IDs**

- [ ] **Step 3: Validate aliases are non-cyclic and resolve**

---

### Task 10: Establish fresh CI baseline

**Files:**
- Read: `.github/workflows/ci.yml`, `.github/workflows/release.yml`, `package.json`, `.nvmrc`.

**Interfaces:**
- Consumes: Existing workflow definitions and package scripts.
- Produces: Documented baseline state and dependency graph.

- [ ] **Step 1: Confirm current HEAD and hosted CI status**

Verify `5ee33ab...` CI run 857 and CodeQL were successful; check if newer commits exist.

- [ ] **Step 2: Document build needs graph**

Map which jobs `build` depends on and which jobs depend on `build`.

---

### Task 11: Implement script-coverage gating

**Files:**
- Modify: `.github/workflows/ci.yml`, `scripts/verify-ci-contract.cjs`, `scripts/verify-ci-contract.test.ts`.

**Interfaces:**
- Consumes: `npm run test:coverage:scripts`.
- Produces: Required `script-coverage` job that `build` depends on.

- [ ] **Step 1: Add script-coverage job**

Use pinned action SHAs and `node-version-file: '.nvmrc'`.

- [ ] **Step 2: Update build.needs**

Include `script-coverage` before `contracts` or in the documented order.

- [ ] **Step 3: Update CI contract verifier**

`verify-ci-contract.cjs` must assert `build` depends on `script-coverage`.

---

### Task 12: Analyze release artifact dependencies

**Files:**
- Read: `scripts/verify-dist.cjs`, `tests/smoke/electron-smoke.test.ts`, `electron-builder.config.cjs`, `package.json` dist scripts.
- Run: `npm run dist:mac:arm64` or inspect existing `release/` if available.

**Interfaces:**
- Consumes: Actual electron-builder output paths.
- Produces: Documented list of final artifacts, temporary staging, paths consumed by `verify-dist`, and paths consumed by smoke tests.

- [ ] **Step 1: Identify release output directories**

List `release/mac*`, `release/win-unpacked`, `release/linux-unpacked`, installers, blockmaps, checksums, YAML metadata.

- [ ] **Step 2: Determine smoke-test executable source**

Confirm whether smoke tests launch from unpacked app directories or final installers.

---

### Task 13: Implement or omit clean-release-staging.cjs

**Files:**
- Create or modify: `scripts/clean-release-staging.cjs`, `scripts/clean-release-staging.test.ts`.
- Modify: `.github/workflows/ci.yml`, `.github/workflows/release.yml` only if cleanup is proven safe.

**Interfaces:**
- Consumes: Release artifact dependency map from Task 12.
- Produces: Safe, idempotent cleanup script or documented rationale for omission.

- [ ] **Step 1: Decide based on dependencies**

If no paths can be safely removed before verification/smoke, omit cleanup and document why.

- [ ] **Step 2: If implementing, write narrow cleanup**

Explicit allowlist of removable staging directories; validate paths are beneath `release/`; refuse `release/` root, repo root, or filesystem root; log removals; idempotent.

- [ ] **Step 3: Add safety tests**

Test deletion of known disposable path, preservation of installer/unpacked app if needed, rejection of dangerous paths, idempotence.

---

### Task 14: Validate CI workflow locally

**Files:**
- Modify: `.github/workflows/ci.yml`, `.github/workflows/release.yml`.

**Interfaces:**
- Consumes: Workflow changes.
- Produces: Workflow files with no references to nonexistent scripts.

- [ ] **Step 1: Run YAML syntax checks**

Use `npx yaml-lint` or equivalent on both workflow files.

- [ ] **Step 2: Verify all referenced scripts exist**

Confirm `clean-release-staging.cjs` exists before any workflow step references it.

---

### Task 15: Full local quality gate

**Files:**
- All changed files.

**Interfaces:**
- Consumes: Repository test/lint/typecheck/build scripts.
- Produces: Green local validation matrix.

- [ ] **Step 1: Run lint and typecheck**

```bash
npm run lint:eslint
npm run typecheck
```

- [ ] **Step 2: Run theme tests**

```bash
npm run test:unit:theme
npm run verify:theme-tokens
```

- [ ] **Step 3: Run script coverage**

```bash
npm run test:coverage:scripts
```

- [ ] **Step 4: Run aggregate coverage**

```bash
npm run test:coverage
```

- [ ] **Step 5: Run contracts**

```bash
npm run verify:contracts
```

- [ ] **Step 6: Run production build**

```bash
npm run build
```

---

### Task 16: Packaged artifact verification (where environment allows)

**Files:**
- Use existing dist and smoke scripts.

**Interfaces:**
- Consumes: Packaged app artifacts.
- Produces: Verified smoke test results per platform.

- [ ] **Step 1: macOS path**

```bash
npm run dist:mac:arm64
node scripts/verify-dist.cjs --mac --arch arm64
RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts
```

- [ ] **Step 2: Windows portable path (if supported)**

```bash
npm run dist:portable
npm run verify:dist:portable
RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts
```

---

### Task 17: Update documentation and handoff

**Files:**
- Modify: `docs/summary_of_work.md`, `docs/ROADMAP.md`, `docs/DOCS_INDEX.md` if new docs are authoritative.

**Interfaces:**
- Consumes: Implementation results.
- Produces: Accurate session handoff and roadmap.

- [ ] **Step 1: Update Latest Session Summary**

- [ ] **Step 2: Append Session History entry**

- [ ] **Step 3: Update ROADMAP for any remaining work**

---

## Self-Review

**Spec coverage:** Every major section of the handoff maps to at least one task: theme family schema (Task 3), built-in migration (Task 4), persistence (Task 5), YAML V2 (Task 6), ThemeMaker (Task 7), CSS audit (Task 8), verify:theme-tokens (Task 9), CI baseline (Task 10), script coverage (Task 11), release cleanup analysis (Task 12/13), workflow validation (Task 14), local gates (Task 15/16), docs (Task 17).

**Placeholder scan:** No TBD/TODO placeholders; concrete file paths and command examples are included.

**Type consistency:** `ThemeFamily`, `ThemeVariant`, `ResolvedTheme`, `AppearanceMode`, and resolver signature are consistent across tasks.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-08-31-theme-engine-v2-and-ci-hardening.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task or task cluster, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `superpowers:executing-plans`, batch execution with checkpoints.

Recommended: Subagent-Driven, because the work spans two large independent tracks and many files.
