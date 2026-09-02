# Theme-Aware Syntax-Colorized Code Rendering — Design Spec

> **Authority:** User handoff dated 2026-09-01.  
> **Scope:** Extend Venice Forge Theme Engine V2 so every user-visible code surface is theme-aware and fenced/multiline Markdown code blocks receive real syntax highlighting.  
> **Branch:** `main`  
> **Schema version:** Keep Theme Engine V2 (`schemaVersion: 2`); add `code` as an optional backward-compatible variant extension.

---

## 1. Goal

1. Fenced/multiline Markdown code blocks are syntax-colorized for recognized languages.
2. Inline Markdown code spans use dedicated theme-aware code colors.
3. Theme changes recolor already-rendered code immediately through CSS variables; no re-tokenization.
4. Theme Maker gains a **Code & Syntax** editor with preset selector, surface colors, token colors, light/dark editing, live preview, and contrast warnings.
5. Every live built-in theme family has explicit light/dark code-syntax preset assignments.
6. Custom themes preserve code-syntax config through save, restart, export, import, duplicate, and create-from-active flows.
7. Legacy themes without `code` data load safely with a deterministic fallback.
8. Copy-code preserves exact raw source text.
9. Unknown/unsupported language identifiers render safely as plain code.
10. No raw HTML injection, `dangerouslySetInnerHTML`, `eval`, or user-controlled dynamic imports.

---

## 2. Current State (Verified)

- `src/components/chat/ChatMarkdown.tsx` renders fenced code as raw text inside `<code>` with a language label and copy button; no tokenization.
- `src/styles/theme.css` styles code surfaces with general UI variables (`--surface`, `--text-primary`, etc.).
- `ThemeVariant` in `src/theme/themeTypes.ts` contains only `tokens: ThemeTokens`.
- `BUILTIN_THEME_FAMILIES` currently exposes 43 families via `src/theme/builtins/index.ts`.
- `applyTheme()` writes UI semantic variables only.
- `ThemeMaker.tsx` edits UI tokens; `ThemePreview.tsx` previews UI tokens only.
- V2 YAML validation/normalization/serialization handles only UI tokens.
- Electron `themeService.ts` persists only UI tokens.
- `settings-store.ts` persists custom themes as legacy single-mode `Theme` objects.
- No Prism/Refractor/Shiki dependency is currently present.

---

## 3. Architecture

### 3.1 Code-theme token contract

Introduce `CodeThemeTokens` with canonical roles mapped to CSS variables:

- Surface: `background`, `foreground`, `border`, `headerBackground`, `headerForeground`, `inlineBackground`, `inlineForeground`, `selectionBackground`.
- Syntax: `comment`, `punctuation`, `property`, `tag`, `boolean`, `number`, `constant`, `symbol`, `deleted`, `selector`, `attribute`, `string`, `character`, `builtin`, `inserted`, `operator`, `entity`, `url`, `atRule`, `keyword`, `function`, `className`, `regex`, `important`, `variable`.

`CodeThemeConfig` attaches a `preset` identifier plus the resolved `tokens` object.  
`ThemeVariant` becomes `{ tokens: ThemeTokens; code: CodeThemeConfig }`.  
`Theme` and `ResolvedTheme` also carry `code: CodeThemeConfig` so the single-mode persistence path does not silently drop code data.

### 3.2 Preset registry

Create `src/theme/codeSyntaxTypes.ts`, `src/theme/codeSyntaxPresets.ts`, and `src/theme/codeSyntax.ts`:

- Define the canonical token key list and preset IDs.
- Provide deterministic fallback/derivation from UI tokens when no code config exists.
- Resolve a full `CodeThemeTokens` object for any preset or fallback.
- Validate preset references.

Every built-in family variant explicitly selects a preset. Editor-inspired families preserve their visual identity; Venice-specific families get deliberately tuned palettes rather than a generic default.

### 3.3 Syntax highlighting engine

Use `refractor` (v5 API):

- Import from `refractor/core` and register grammars explicitly.
- Initial grammar set: bash, c, cpp, csharp, css, diff, go, html/markup/xml, java, javascript, json, kotlin, lua, markdown, php, python, regex, ruby, rust, scss, sql, swift, typescript, yaml, plus jsx/tsx if available.
- Fixed alias map (`js` → `javascript`, `ts` → `typescript`, `py` → `python`, `sh` → `bash`, `yml` → `yaml`, `html`/`xml` → `markup`, etc.).
- Render Refractor HAST to React elements locally; no `dangerouslySetInnerHTML` or dynamic imports from Markdown input.
- Unknown/missing languages fall back to plain escaped code.
- Complexity guard: 50,000 UTF-16 code units / 4,000 lines → plain code.
- Memoize on `language + rawSource`; theme changes must not be part of the key.

New module: `src/components/chat/codeHighlighting.tsx` (+ tests).

### 3.4 CSS variable contract

`applyTheme()` writes code/syntax variables such as `--code-bg`, `--code-fg`, `--code-border`, `--code-header-bg`, `--code-header-fg`, `--code-inline-bg`, `--code-inline-fg`, `--code-selection-bg`, and `--syntax-*` for every canonical token.  
`src/styles/theme.css` maps `.prose-venice .token.*` classes to these variables. No hardcoded syntax colors in components or CSS mapping rules.

### 3.5 Theme Maker / Preview expansion

- Add a **Code & Syntax** section to `ThemeMaker.tsx`.
- Preset selector populated from `CODE_SYNTAX_PRESETS`.
- Surface color controls and syntax-token color controls.
- Light/dark tabs edit the matching variant's `code` config independently.
- Dirty-state comparison includes `code` config.
- Create/duplicate/import/export flows deep-clone and persist `code` config.
- `ThemePreview.tsx` renders a real syntax-highlighted TypeScript sample using the same token classes.
- Contrast warnings for code surface and syntax text colors.

### 3.6 Persistence compatibility

- Extend `Theme` with `code: CodeThemeConfig`.
- `singleModeThemeFromFamily` copies the active variant's code config.
- `legacyThemeToFamily` carries any existing code config into both variants; old records without code receive the fallback.
- `isValidPersistedTheme` accepts themes missing `code` and derives a fallback.
- `settings-store` migration preserves code config in `customThemes`.
- `vf.theme.bootstrap` snapshot includes enough information for the selected custom theme to resolve.
- Electron `themeService.ts` `ThemeFamilyV2` shape and serialization include `code` data.
- V2 YAML variant allowlist adds `code`; validation/normalization/serialization handle full code config.

---

## 4. Security & Reliability Constraints

- No `dangerouslySetInnerHTML`, `innerHTML`, `eval`, `new Function`.
- No dynamic imports driven by Markdown fence labels.
- Preserve existing `rehype-sanitize` and URL sanitization behavior.
- Preserve copy-code raw source exactly.
- Theme persistence stays in existing trusted locations; no new plaintext secret-bearing surfaces.

---

## 5. Accessibility

- Code foreground/background ≥ 4.5:1.
- Inline foreground/background ≥ 4.5:1.
- Header foreground/background ≥ 4.5:1.
- Textual syntax colors target ≥ 4.5:1 against code background for built-ins; custom themes warn.
- Built-in themes are tested for compliance.

---

## 6. Testing Strategy

- Unit tests for `codeHighlighting.tsx`: token spans, aliases, unknown/missing languages, raw source preservation, HTML safety, size guard, HAST safety.
- Chat regression tests in `message-bubble.test.tsx`: semantic token spans, language labels, copy payload, inline code, Traffic Inspector mode.
- `applyTheme.test.ts`: all code/syntax CSS variables are written and change with theme.
- `themes.test.ts`: every family has complete code config, valid colors, preset exists, contrast passes, no silent emergency fallback.
- YAML tests: full code config, missing-code fallback, partial override, invalid color/token rejection, dangerous key rejection, round-trip.
- Settings persistence tests: custom theme light/dark code palettes round-trip.
- Theme Maker tests: preset change, token edit, light/dark separation, dirty state, reset, save, create-from-active, import/export.
- Static verifier update: `scripts/verify-theme-tokens.cjs` guards against hardcoded syntax colors in `src/components/chat` and `src/styles`.

---

## 7. i18n

Add localized keys for all new Theme Maker and preview labels, then run the repository's `i18n:extract`, `i18n:sync-catalogs`, and strict verification scripts.

---

## 8. Documentation

Update `docs/design/THEME_SYSTEM.md` with the code token model, preset registry, Refractor architecture, YAML shape, legacy fallback, Theme Maker Code & Syntax controls, supported languages, unknown-language fallback, performance guard, and accessibility expectations. Update `docs/summary_of_work.md` at session end. Register any new retained docs in `docs/DOCS_INDEX.md`.
