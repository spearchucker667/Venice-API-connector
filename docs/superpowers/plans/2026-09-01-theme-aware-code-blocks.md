# Theme-Aware Syntax-Colorized Code Rendering — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend Venice Forge Theme Engine V2 so fenced/multiline Markdown code blocks receive real syntax highlighting whose colors track the active theme, inline code is theme-aware, the Theme Maker edits code/syntax palettes, and all built-in families have complete light/dark code styling.

**Architecture:** Add a `CodeThemeConfig` contract to `ThemeVariant`/`Theme`/`ResolvedTheme`; centralize preset definitions in `src/theme/codeSyntax*.ts`; render Refractor HAST to React in `src/components/chat/codeHighlighting.tsx`; expose CSS variables via `applyTheme`; extend Theme Maker/Preview; extend YAML/Electron/settings persistence; add tests and docs.

**Tech Stack:** TypeScript, React 19, Tailwind CSS v4, Refractor v5, Vitest, Zustand, Electron 43, YAML.

**Spec:** `docs/superpowers/specs/2026-09-01-theme-aware-code-rendering-design.md`

## Global Constraints

- Work exclusively on branch `main`; preserve direct-main workflow. Do not create feature branches or worktrees for normal execution.
- Node `>=22.15.0 <23.0.0`, npm `>=10`.
- Keep Theme Engine `schemaVersion: 2`; add `code` as an optional backward-compatible variant extension.
- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`, or dynamic imports from Markdown input.
- No hardcoded syntax colors in `src/components/chat`, `src/styles`, or generic rendering logic.
- Preserve existing `rehype-sanitize`, URL sanitization, KaTeX sanitation, GFM, and copy-code behavior.
- Run the smallest relevant check first, then broaden. Do not skip failing tests or weaken gates.
- Update `docs/summary_of_work.md` and `docs/design/THEME_SYSTEM.md` before completion.

---

## Task 1: Add code-theme model + failing tests

**Files:**
- Create: `src/theme/codeSyntaxTypes.ts`
- Create: `src/theme/codeSyntaxPresets.ts`
- Create: `src/theme/codeSyntax.ts`
- Modify: `src/theme/themeTypes.ts`
- Modify: `src/theme/applyTheme.ts`
- Modify: `src/theme/themes.test.ts`
- Modify: `src/theme/applyTheme.test.ts`

**Interfaces:**
- `CodeThemeTokens` object with 33 canonical roles (surface + syntax).
- `CodeThemeConfig = { preset: CodeSyntaxPresetId; tokens: CodeThemeTokens }`.
- `ThemeVariant` gains `code: CodeThemeConfig`.
- `Theme` and `ResolvedTheme` gain `code: CodeThemeConfig`.
- `completeThemeTokens` unchanged; add `completeCodeThemeTokens(mode, input?)` helper.
- `applyTheme` writes `--code-*` and `--syntax-*` variables.

- [ ] **Step 1: Write failing model tests**
  In `src/theme/themes.test.ts`, add tests that every `BUILTIN_THEME_FAMILIES` entry has a complete `code` config for both light and dark, that every canonical code token is present, and that preset IDs are valid. In `src/theme/applyTheme.test.ts`, assert that `--code-bg`, `--code-fg`, `--syntax-keyword`, etc. are set.

- [ ] **Step 2: Define canonical types**
  In `src/theme/codeSyntaxTypes.ts`, export `CODE_THEME_TOKEN_KEYS`, `CodeThemeTokens`, `CodeSyntaxPresetId`, `CodeThemeConfig`.

- [ ] **Step 3: Implement preset registry + fallback**
  In `src/theme/codeSyntaxPresets.ts`, define at least: `venice`, `dracula`, `gruvbox-dark`, `rosepine`, `nord`, `tokyo-night`, `catppuccin`, `solarized`, `one-dark`, `monokai`, `github-light`, `automatic`. In `src/theme/codeSyntax.ts`, export `CODE_SYNTAX_PRESETS`, `resolveCodeThemeTokens(preset, mode, uiTokens)`, and a deterministic fallback that derives readable code colors from UI tokens when no preset/partial data exists.

- [ ] **Step 4: Extend Theme types**
  In `src/theme/themeTypes.ts`, add `code: CodeThemeConfig` to `ThemeVariant`, `Theme`, and `ResolvedTheme`. Add `completeCodeThemeTokens(mode, input?)`.

- [ ] **Step 5: Update applyTheme**
  In `src/theme/applyTheme.ts`, write all code/syntax variables. Ensure `ResolvedTheme.code` is consumed.

- [ ] **Step 6: Run focused tests and confirm failures are expected**
  Run:
  ```bash
  npm run test:unit:theme
  ```
  Expected: failures because built-ins lack `code` data.

- [ ] **Step 7: Commit**
  ```bash
  git add src/theme/codeSyntaxTypes.ts src/theme/codeSyntaxPresets.ts src/theme/codeSyntax.ts src/theme/themeTypes.ts src/theme/applyTheme.ts src/theme/themes.test.ts src/theme/applyTheme.test.ts
  git commit -m "feat(theme): add code-theme token contract and failing tests"
  ```

---

## Task 2: Assign code palettes to all built-in families

**Files:**
- Modify: `src/theme/builtins/*.ts`
- Modify: `src/theme/themes.test.ts`

**Interfaces:**
- Each `ThemeVariant` now includes `code: { preset, tokens: CodeThemeTokens }`.
- `resolveCodeThemeTokens` returns complete tokens for every preset.

- [ ] **Step 1: Add helper re-export if needed**
  In `src/theme/index.ts`, re-export `CODE_SYNTAX_PRESETS`, `resolveCodeThemeTokens`, and types from `codeSyntax*.ts`.

- [ ] **Step 2: Update Venice family**
  In `src/theme/builtins/venice.ts`, add `code` to both variants using the `venice` preset.

- [ ] **Step 3: Update editor-inspired families**
  In `src/theme/builtins/dracula.ts`, `gruvboxDark.ts`, `rosepine.ts`, `nord.ts`, `tokyoNight.ts`, `catppuccin.ts`, `solarized.ts`, `oneDark.ts`, `monokai.ts`, `githubLight.ts`, add `code` configs using their respective presets.

- [ ] **Step 4: Update remaining families**
  For every other family in `src/theme/builtins/`, choose the closest preset or derive a coherent palette so each family has distinct light and dark code styling. Do not silently fall through to a single generic default.

- [ ] **Step 5: Run completeness + contrast tests**
  Run:
  ```bash
  npm run test:unit:theme
  ```
  Fix palette values (not tests) if contrast fails.

- [ ] **Step 6: Commit**
  ```bash
  git add src/theme/builtins/*.ts src/theme/index.ts src/theme/themes.test.ts
  git commit -m "feat(theme): assign light/dark code palettes to all built-in families"
  ```

---

## Task 3: Extend YAML pipeline for code config

**Files:**
- Modify: `src/theme/yaml/validate.ts`
- Modify: `src/theme/yaml/normalize.ts`
- Modify: `src/theme/yaml/serialize.ts`
- Modify: `src/theme/yaml/parse.ts`
- Create/Modify: `src/theme/yaml/*.test.ts`

**Interfaces:**
- `ALLOWED_VARIANT_KEYS` becomes `new Set(['tokens', 'code'])`.
- V2 YAML shape includes optional `variants.<mode>.code: { preset, tokens }`.
- Normalization resolves a full `CodeThemeConfig`.
- Serialization emits complete self-contained `code` data.

- [ ] **Step 1: Extend validator**
  In `src/theme/yaml/validate.ts`, allow `code` in variants. Validate `code.preset` as a string matching a known preset ID. Validate `code.tokens` object shape, allowed keys, and color values.

- [ ] **Step 2: Extend normalizer**
  In `src/theme/yaml/normalize.ts`, when building each variant, call `completeCodeThemeTokens(mode, rawCodeTokens)` and attach `preset`. Derive fallback from UI tokens when `code` is absent.

- [ ] **Step 3: Extend serializer**
  In `src/theme/yaml/serialize.ts`, include `variants.<mode>.code.preset` and `variants.<mode>.code.tokens` (snake_case, sorted).

- [ ] **Step 4: Add YAML tests**
  Cover: full code config, missing code → fallback, partial override, invalid color rejection, unknown token rejection, unknown preset handling, dangerous key rejection, serialize → parse round-trip, light/dark code values remain distinct.

- [ ] **Step 5: Run YAML tests**
  ```bash
  npx vitest run src/theme/yaml --no-file-parallelism
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add src/theme/yaml/
  git commit -m "feat(theme): extend V2 YAML pipeline for code syntax config"
  ```

---

## Task 4: Extend Electron persistence for code config

**Files:**
- Modify: `electron/services/themeService.ts`
- Modify: relevant Electron theme-service tests

**Interfaces:**
- `ThemeFamilyV2` includes `code` in each variant.
- `isThemeFamilyV2` validates the `code` shape.
- `serializeV2Family` emits `code`.

- [ ] **Step 1: Extend ThemeFamilyV2 shape**
  In `electron/services/themeService.ts`, add `code: { preset: string; tokens: Record<string, string> }` to each variant.

- [ ] **Step 2: Update validation and serialization**
  Update `isThemeFamilyV2` and `serializeV2Family` accordingly.

- [ ] **Step 3: Add/update tests**
  Ensure save/load round-trips code configuration.

- [ ] **Step 4: Run Electron theme tests**
  ```bash
  npx vitest run electron/services/themeService.test.ts --no-file-parallelism
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add electron/services/themeService.ts electron/services/themeService.test.ts
  git commit -m "feat(theme): extend Electron theme service to persist code config"
  ```

---

## Task 5: Repair settings-store custom theme persistence

**Files:**
- Modify: `src/stores/settings-store.ts`
- Modify: `src/stores/settings-store.test.ts`
- Modify: `src/theme/applyTheme.ts` (`legacyThemeToFamily`, `isValidPersistedTheme`)
- Modify: `src/App.tsx`

**Interfaces:**
- `Theme` includes `code: CodeThemeConfig`.
- `singleModeThemeFromFamily(family, mode)` copies the variant's `code`.
- `legacyThemeToFamily(theme)` carries `theme.code` into both variants; missing code uses fallback.
- `isValidPersistedTheme` accepts old themes without `code` and derives fallback.
- Bootstrap snapshot preserves enough data for code resolution.

- [ ] **Step 1: Extend Theme type and converters**
  In `src/theme/themeTypes.ts` and `src/theme/applyTheme.ts`, update `Theme`, `singleModeThemeFromFamily` logic in `ThemeMaker`, `legacyThemeToFamily`, and `isValidPersistedTheme`.

- [ ] **Step 2: Update settings-store**
  In `src/stores/settings-store.ts`, ensure `saveCustomTheme`/`customThemes` preserve `code`. Add migration in `migrate`/`merge` to derive fallback code for old persisted themes.

- [ ] **Step 3: Update App.tsx bootstrap**
  In `src/App.tsx`, the `vf.theme.bootstrap` snapshot already stores `customTheme`; no extra fields needed if `customTheme.code` is included.

- [ ] **Step 4: Add persistence tests**
  Verify a custom theme with different light/dark code palettes survives save → persist → hydrate → resolve.

- [ ] **Step 5: Run focused tests**
  ```bash
  npx vitest run src/stores/settings-store.test.ts --no-file-parallelism
  npx vitest run src/theme/applyTheme.test.ts --no-file-parallelism
  ```

- [ ] **Step 6: Commit**
  ```bash
  git add src/stores/settings-store.ts src/stores/settings-store.test.ts src/theme/applyTheme.ts src/theme/themeTypes.ts src/App.tsx
  git commit -m "feat(theme): preserve code config through settings persistence"
  ```

---

## Task 6: Implement Refractor syntax highlighter

**Files:**
- Modify: `package.json`, `package-lock.json`
- Create: `src/components/chat/codeHighlighting.tsx`
- Create: `src/components/chat/codeHighlighting.test.tsx`

**Interfaces:**
- `highlightCode(source, language): React.ReactNode`
- Fixed alias map: `js`→`javascript`, `ts`→`typescript`, `py`→`python`, `sh`/`shell`→`bash`, `yml`→`yaml`, `html`/`xml`→`markup`.
- Returns plain text for unknown/missing languages and oversized input.
- HAST renderer accepts only `root`, `text`, `span` nodes; rejects unexpected types.

- [ ] **Step 1: Install Refractor**
  ```bash
  npm install refractor
  ```

- [ ] **Step 2: Register grammars**
  In `src/components/chat/codeHighlighting.tsx`, import `refractor/core`, register bash, c, cpp, csharp, css, diff, go, html/markup, java, javascript, json, kotlin, lua, markdown, php, python, regex, ruby, rust, scss, sql, swift, typescript, yaml, and jsx/tsx if available.

- [ ] **Step 3: Implement safe HAST renderer**
  Convert Refractor HAST to React elements. Only render `span` with `className` tokens and text nodes. Throw on unexpected node types in tests; in production return plain fallback.

- [ ] **Step 4: Add alias map and guards**
  Map common aliases. Enforce `MAX_HIGHLIGHT_LENGTH = 50000` and `MAX_HIGHLIGHT_LINES = 4000`.

- [ ] **Step 5: Write unit tests**
  Cover JavaScript/TypeScript/Python token spans, alias resolution, unknown/missing languages, raw source unchanged, HTML-like source rendered safely, oversized fallback, unexpected HAST nodes rejected, no inline styles.

- [ ] **Step 6: Run highlighter tests**
  ```bash
  npx vitest run src/components/chat/codeHighlighting.test.tsx --no-file-parallelism
  ```

- [ ] **Step 7: Commit**
  ```bash
  git add package.json package-lock.json src/components/chat/codeHighlighting.tsx src/components/chat/codeHighlighting.test.tsx
  git commit -m "feat(chat): add Refractor-based syntax highlighter"
  ```

---

## Task 7: Integrate highlighting into ChatMarkdown

**Files:**
- Modify: `src/components/chat/ChatMarkdown.tsx`
- Modify: `src/components/chat/message-bubble.test.tsx`

**Interfaces:**
- `CodeRenderer` distinguishes inline code (no language, no newline) from block code.
- Block code with recognized language renders token spans via `highlightCode`.
- Plain rendering preserved for unknown/missing languages and oversized code.
- Raw copy text still extracted from React children.

- [ ] **Step 1: Refactor PreRenderer**
  In `src/components/chat/ChatMarkdown.tsx`, import `highlightCode`. For block code with a recognized language and under size limits, render `highlightCode(rawText, lang)` inside the scroll area. Otherwise render `{children}` as before.

- [ ] **Step 2: Preserve inline code styling**
  Inline `<code>` uses dedicated classes/variables (`code-inline`) without syntax highlighting.

- [ ] **Step 3: Add chat regression tests**
  In `src/components/chat/message-bubble.test.tsx`, assert recognized fenced code emits `.token.keyword`/equivalent, language label remains, copy payload is exact, unknown language renders, inline code stays outside `<pre>`, Traffic Inspector mode still works.

- [ ] **Step 4: Run chat tests**
  ```bash
  npx vitest run src/components/chat/message-bubble.test.tsx --no-file-parallelism
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add src/components/chat/ChatMarkdown.tsx src/components/chat/message-bubble.test.tsx
  git commit -m "feat(chat): integrate theme-aware syntax highlighting into ChatMarkdown"
  ```

---

## Task 8: Add CSS syntax mapping

**Files:**
- Modify: `src/styles/theme.css`
- Modify: `scripts/verify-theme-tokens.cjs`
- Modify: `scripts/verify-theme-tokens.test.ts`

**Interfaces:**
- Code surfaces use `--code-bg`, `--code-fg`, `--code-border`, `--code-header-bg`, `--code-header-fg`, `--code-inline-bg`, `--code-inline-fg`, `--code-selection-bg`.
- `.token.*` classes map to `--syntax-*` variables.

- [ ] **Step 1: Map code surface variables**
  In `src/styles/theme.css`, update `.prose-venice code` (inline), `.prose-venice pre` (block), and the PreRenderer header classes to use code variables.

- [ ] **Step 2: Map token classes**
  Add `.prose-venice .token.comment`, `.token.keyword`, `.token.string`, `.token.function`, etc., mapping to `--syntax-*` variables.

- [ ] **Step 3: Update static verifier**
  In `scripts/verify-theme-tokens.cjs`, add a rule that flags hardcoded `#hex`, `rgb()`, `hsl()`, or named colors in `src/components/chat` and `src/styles` (excluding legitimate palette literals in `src/theme/builtins` and `src/theme/codeSyntaxPresets.ts`).

- [ ] **Step 4: Run verifier tests**
  ```bash
  npm run verify:theme-tokens
  npx vitest run scripts/verify-theme-tokens.test.ts --no-file-parallelism
  ```

- [ ] **Step 5: Commit**
  ```bash
  git add src/styles/theme.css scripts/verify-theme-tokens.cjs scripts/verify-theme-tokens.test.ts
  git commit -m "feat(theme): add CSS code/syntax variable mapping and verifier"
  ```

---

## Task 9: Expand Theme Maker and Theme Preview

**Files:**
- Modify: `src/components/ThemeMaker.tsx`
- Modify: `src/components/ThemePreview.tsx`
- Create/Modify: relevant ThemeMaker tests

**Interfaces:**
- `cloneFamily` deep-clones `variants.<mode>.code`.
- `updateCodePreset(preset)`, `updateCodeToken(key, value)` functions.
- `isDraftDirty` compares `code` config.
- `ThemePreview` renders a syntax-highlighted TypeScript sample.

- [ ] **Step 1: Deep-clone code config**
  Update `cloneFamily` to clone nested code token objects.

- [ ] **Step 2: Add Code & Syntax section**
  Add a new editor area with preset selector, surface color controls, and syntax-token color controls. Populate preset selector from `CODE_SYNTAX_PRESETS`.

- [ ] **Step 3: Implement code update helpers**
  Add `updateCodePreset`, `updateCodeToken`, and wire them to inputs.

- [ ] **Step 4: Update dirty state and flows**
  Include `code` in `isDraftDirty`. Ensure create-from-active, save, reset, restore defaults, import/export preserve code config.

- [ ] **Step 5: Add real syntax preview**
  In `ThemePreview.tsx`, render a representative TypeScript sample through `highlightCode` so it uses the active code palette.

- [ ] **Step 6: Add contrast warnings**
  Warn when code foreground/background, inline foreground/background, header foreground/background, or syntax text colors fail target ratios.

- [ ] **Step 7: Add Theme Maker tests**
  Cover preset change, token edit, light/dark separation, dirty state, reset, save, create-from-active, import/export preservation.

- [ ] **Step 8: Run component tests**
  ```bash
  npx vitest run src/components/ThemeMaker --no-file-parallelism
  npx vitest run src/components/ThemePreview --no-file-parallelism
  ```

- [ ] **Step 9: Commit**
  ```bash
  git add src/components/ThemeMaker.tsx src/components/ThemePreview.tsx
  git commit -m "feat(theme): add Code & Syntax editor and live syntax preview"
  ```

---

## Task 10: i18n and documentation

**Files:**
- Modify: `src/i18n/resources/en-US/common.json` (and other locales via sync)
- Modify: `docs/design/THEME_SYSTEM.md`
- Modify: `docs/summary_of_work.md`
- Modify: `docs/DOCS_INDEX.md` if new docs are retained

**Interfaces:**
- New translation keys for Code & Syntax labels.
- Updated theme-system docs.

- [ ] **Step 1: Add English keys**
  Add keys for "Code & Syntax", "Syntax preset", surface color labels, syntax token labels, "Apply preset", "Syntax preview", "Code contrast warning".

- [ ] **Step 2: Sync catalogs**
  ```bash
  npm run i18n:extract
  npm run i18n:sync-catalogs
  npm run verify:i18n
  npm run verify:i18n:release
  ```

- [ ] **Step 3: Update docs**
  Update `docs/design/THEME_SYSTEM.md` with code token model, preset registry, Refractor architecture, YAML shape, legacy fallback, Theme Maker Code & Syntax controls, supported languages, unknown-language fallback, performance guard, accessibility expectations.

- [ ] **Step 4: Commit**
  ```bash
  git add src/i18n/ docs/design/THEME_SYSTEM.md
  git commit -m "docs(theme): i18n keys and theme-system docs for code syntax"
  ```

---

## Task 11: Full validation and manual QA

**Files:**
- All touched files

- [ ] **Step 1: Focused validation**
  ```bash
  npm run test:unit:theme
  npx vitest run src/components/chat/message-bubble.test.tsx --no-file-parallelism
  npx vitest run src/components/chat/codeHighlighting.test.tsx --no-file-parallelism
  npm run verify:theme-tokens
  npm run verify:i18n
  npm run typecheck
  npm run lint:eslint
  ```

- [ ] **Step 2: Bundle validation**
  ```bash
  npm run build:web
  npm run verify:bundle-budget
  ```

- [ ] **Step 3: Full gates**
  ```bash
  npm run test:ci
  npm run verify:contracts
  npm run verify:i18n:release
  npm run build
  npm run ci
  ```

- [ ] **Step 4: Update summary_of_work.md**
  Append session summary, validation matrix, and any deferred work.

- [ ] **Step 5: Final report**
  Return the completion report specified in the handoff.
