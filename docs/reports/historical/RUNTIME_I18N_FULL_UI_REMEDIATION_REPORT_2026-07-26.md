# Runtime i18n Full-UI Remediation Report

> Historical snapshot. This report records the 2026-07-26 implementation and
> validation state. Current task authority remains `docs/ROADMAP.md`, and live
> source plus current verification output supersede this retained evidence.

## Repository State

- Venice Forge `3.0.0-beta.2`, canonical `main` checkout.
- Node 22.13.1 / npm 10.9.2.
- The worktree was clean before implementation. The completed changes are local
  and uncommitted; no commit, push, package publication, or pull request was
  authorized.

## Reproduction

The former JSX-text-only scan could report zero while English remained in
attributes, expression branches, registries, toast/dialog calls, service/store
status text, and module metadata. Expanding the scanner reproduced 1,667
candidates across 146 production files. After classifying technical literals
and migrating runtime-visible prose, the same expanded scan reports zero
candidates across 480 production files.

Rendered Swedish checks reproduced English prompt, Image Studio, capability,
header, and status text. A Swedish-to-Arabic live switch additionally reproduced
stale memoized diagnostic headings and non-Latin React/DOM ID collisions.

## Verified Root Causes

1. The scanner only inspected `JsxText`.
2. Prompt starters and presentation registries stored final English strings.
3. Runtime-visible service/store data had no structured translation contract.
4. Some localized module metadata was cached without a locale dependency.
5. Diagnostics section IDs were generated with an ASCII-only slug of translated
   labels, collapsing multiple non-Latin headings to duplicate IDs.

## Hardcoded Scanner Expansion

`scripts/verify-hardcoded-strings.cjs` now detects raw JSX text; visible JSX
attributes; string/template expressions; conditional and logical branches;
semantic registry fields; arrays; toast calls; canonical text/decision dialogs;
and status `makeItem` arguments. It excludes tests, CSS classes, SVG paths,
URLs, MIME types, model IDs, hex colors, and reviewed technical tokens.

Reasoned source exceptions are required. The schema-v2 exact baseline is now
zero, and the no-regression gate reports zero additions and zero increases.
Regression tests cover every required scanner class, slash-separated visible
prose, technical slash tokens, duplicate counts, baseline decreases, and
reason-required directives.

## Prompt Starter Architecture

All 149 bundled starters use stable IDs, translation keys, English fallbacks,
categories, and tags. Services return records rather than final localized
strings. Chat, Image, Audio, Music, and Embeddings translate records at render
time; selection passes the currently localized prompt without rewriting user
drafts or persisted history.

## Chat Remediation

Composer placeholders, attachment states, drag/drop copy, controls, settings,
search/citation/scrape states, history, character-chat presentation, tooltips,
toasts, dialogs, conditional labels, and accessible names now resolve through
i18next. Canonical request/state values remain unchanged.

## Header and Status Remediation

Navigation retains stable IDs and derives labels/subtitles at render time.
Header, sidebar, command palette, model/API/task/status actions, and accessible
names are localized.

`AppStatusItem` now stores structured `StatusText { key, values }` values and
`actionLabelKey`, not final English summaries/details/actions. External error
text is bounded and represented through a localized wrapper. Drawer and header
resolve the structured status with the active translator. Locale-dependent
memos include the translator, and diagnostics use stable locale-neutral section
IDs, preventing non-Latin duplicate keys/IDs.

## Image Studio Remediation

Image generation and tools, capability summaries, aspect/quality options,
templates, negative prompt, seed, variants, results, error/loading states,
downloads, toasts, empty states, and accessible names are localized.
Capability descriptors carry stable translation keys and interpolation values.
Provider/API values such as `1:1`, resolutions, model IDs, and quality enums
remain canonical.

## Other UI Surfaces Remediated

The full production sweep migrated runtime-visible values across application
shell, Characters, Character Creator, Documents, Embeddings, Gallery, Image
Inspector, Media Studio, Music, Notifications, Playground, Privacy, Prompts,
Research, RP Studio, Scenes, Search, Settings, Theme Maker, Video, Workflows,
shared UI, service/store messages, workflow schemas, provider descriptors, and
image-processing metadata. Reviewed language-neutral protocol, model, format,
provider, and legal/proper-name literals use narrow reasoned exceptions.

## Catalog Changes

All 12 locales and 12 namespaces have structural parity. Extraction reports
2,049 source usages, 1,941 unique keys, and zero missing source entries.
Catalog sync is idempotent at 3,012 `common` entries per locale. Every new
non-English leaf received first-pass translation; five machine outputs that
remained effectively English were corrected directly. The identical-value
allowlist is restricted to reviewed technical/proper/same-spelling values.

## Runtime Reactivity

Runtime text is resolved through `useTranslation`, `Trans`, or the active
i18next-backed runtime translator. Locale-sensitive hooks include the translator
in their dependency arrays. Rendered onboarding switching from Swedish to Arabic
without remounting updated diagnostics headings, document language/direction,
Image Studio copy, and navigation immediately.

## Accessibility

Visible labels, placeholders, titles, tooltips, and ARIA attributes are
localized. Arabic applies `lang=ar` and `dir=rtl`. Stable diagnostics IDs no
longer depend on localized glyphs. Automated assertions cover Swedish live
switching. Rendered compact Arabic QA found no document/body horizontal
overflow and no unresolved key markers.

## Tests

- Scanner/baseline regressions, including slash prose and technical exclusions.
- Stable prompt-starter record and live-locale behavior.
- Chat composer/view, header, status cluster/drawer, Image Studio/tools, shared
  UI, locale completion, status isolation, and image capability descriptors.
- Quote-neutral document-ingestion source verification after formatting changed
  a contract literal from single to double quotes.
- Full and segmented repository suites.

## Commands

| Command | Result |
|---|---|
| `npm ci` | PASS; 16 high transitive audit findings reported |
| `npm run i18n:extract` | PASS — 2,049 usages / 1,941 unique / 0 missing |
| `npm run i18n:sync-catalogs` | PASS — idempotent |
| `npm run verify:i18n` | PASS — 12 locales / 12 namespaces |
| `npm run i18n:verify-hardcoded` | PASS — 0 candidates / 480 files |
| baseline + no-regression gates | PASS — zero entries / zero regressions |
| `npm run test:i18n` | PASS — 49/49 |
| required focused localization suite | PASS — 89/89 |
| focused status/scanner/image suite | PASS — 116/116 |
| `npm run lint:eslint` | PASS — zero warnings |
| `npm run typecheck` | PASS — renderer and Electron |
| `npm test` | PASS — 4,745 passed / 1 skipped |
| `npm run test:ci` | PASS — every segment |
| `npm run verify:safety-guard` | PASS |
| `npm run verify:markdown-links` | PASS — 244 files |
| `npm run build` | PASS — web, server, Electron |
| `npm run verify:contracts` | FAIL — 13 pre-existing historical banner defects |
| `npm run ci` | FAIL after tests — 16 high transitive audit findings |

## Validation

Catalog structural and runtime-surface coverage are both 100%. `en-US` is
source-language complete. Every non-English locale remains truthfully
`first-pass-machine` and `isProductionComplete=false` until qualified,
dated human review. The scanner baseline is zero. Lint, both typechecks, full
tests, segmented tests, safety, links, and production build pass.

The aggregate contract failure is independent repository history: 13 older
files under `docs/reports/historical/` lack the exact required banner. This
report has the banner. Aggregate CI passes lint, typecheck, and every segmented
test, then stops at 16 high transitive `brace-expansion` findings; npm offers
only a breaking Electron Builder downgrade, which was not forced or suppressed.

## Manual QA

All supported locales were selected in the rendered app:
`en-US`, `es`, `fr`, `de`, `pt-BR`, `ru`, `zh-CN`, `ja`, `hi`,
`ar`, `ko`, and `sv-SE`. Each applied the expected `lang`; Arabic applied
RTL and all others LTR. No unresolved runtime keys, missing markers, or
document-level horizontal overflow appeared.

Swedish Chat, Image Studio, prompt starters, image capabilities, and diagnostics
were inspected. A live Swedish-to-Arabic switch updated memoized headings after
the reactivity fix. At 390×844 Arabic retained `lang=ar`, `dir=rtl`, and
390-pixel document/body scroll widths with no unresolved markers.

This was headed development-web QA. Packaged macOS, Windows, screen-reader,
keyboard-only, high-zoom, restart-persistence, signed/notarized, and paid-provider
QA were not run and are not claimed.

## Remaining English Literals

The expanded production scanner reports zero runtime-visible candidates.
Expected English may still appear as user/provider/model output, proper names,
legal source text, protocol/API values, MIME/format tokens, model IDs, URLs, or
reasoned technical exceptions; these are not app-authored localizable prose.

## Explicit Allowlist

`docs/i18n/identical-value-allowlist.json` records reviewed locale-identical
technical/proper values. Source annotations are narrow and reasoned. There is no
broad prose exemption and no non-zero debt baseline.

## Native Review

`en-US` is the source language. The other 11 catalogs are complete first-pass
machine translations only, with no qualified reviewer or review date.
`isProductionComplete` therefore remains false for those locales.

## Risks

- Machine translation terminology and grammar require qualified native review.
- Packaged, signed, Windows, assistive-technology, persistence, and paid-provider
  manual evidence remains external to this local implementation.
- The repository-wide historical-banner and dependency-audit failures remain
  outside this localization work.

No Electron privilege boundary, Venice request enum, persisted user-content
schema, raw secret, or user-authored content was altered.
