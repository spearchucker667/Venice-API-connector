# Venice Forge Translation Guide

This guide describes translation standards, key conventions, and review workflows for localizing Venice Forge.

## Key Rules

1. **English Source:** `src/i18n/resources/en-US/` is the canonical key source.
2. **Semantic Key Names:** Use stable semantic paths (`settings:languageRegion.title`), never full raw sentences as key names.
3. **Variable Parity:** Preserve interpolation tokens (`{{count}}`, `{{model}}`, `{{language}}`) exactly across all locales.
4. **Local Execution:** All translation files ship with the desktop build. Never request translations from remote APIs at runtime.
5. **No Code/Token Localization:** Do not translate API routes, JSON fields, model IDs, environment variables, CSS selectors, or CLI commands.

## Adding a New Locale

1. Register metadata in `src/i18n/locales.ts` and `src/i18n/locale-types.ts`.
2. Add namespace JSON files under `src/i18n/resources/<locale_code>/`.
3. Add concise documentation under `docs/i18n/<locale_code>/`.
4. Run `npm run verify:i18n` to confirm key and interpolation parity.

## Reviewer Workflow

**Honest translator note (post `MINIMAX-M3-I18N-FULL-APP-REMEDIATION-2026-07-26`):** The first-pass translations shipped for `es`, `fr`, `de`, `pt-BR`, `ru`, `zh-CN`, `ja`, `hi`, `ar`, `ko`, `sv-SE` were produced by the Venice `chat/completions` endpoint using model `zai-org-glm-5-2`. They are **not** native-speaker grade. Reviewers MUST score every leaf, replace artefacts, and validate. Two known classes of machine artefact to police:

1. **CamelCase leaks** — an English identifier (`actions.saveKey`, `byteArrays`) surviving inside a translated leaf. Search `rg -E '\b[a-z]+[A-Z][a-zA-Z]*\b' src/i18n/resources/<locale>/` on your locale.
2. **Concrete identifiers** — model names, protocol names, brand tokens pasted unchanged from English in a translated leaf. These are correct *only* if they satisfy the `ALLOWLISTED_IDENTICAL` set in `scripts/verify-i18n.cjs:48-136` (Venice Forge, JSON, PNG, MP4, GLM 5.2, Argon2id, XChaCha20-Poly1305, base64, SHA-256, ESC, Auto, Retro, Minimal, Tactile, Persona, Scenario, Lorebook, RP Studio, Traffic Inspector, card-1, conv-1, lib-1, rpchat-1, true, q1, q2, together-groq-anthropic, `{{count}} / {{max}} tokens`, `Format: v{{version}}{{appVersion}}`, `Volume: {{volume}}%`).

The translation pipeline (`scripts/translate-missing.cjs`) batches ≤60 keys per request, rejects any response that does not match the source key set, validates `{{name}}` interpolation parity, refuses responses that leak `__MISSING__:` or `[XX]` markers, and only writes when `--write` is supplied. **Default mode is dry-run**; reviewers can rerun locally before merging.

## Markers and Sentinels

Two placeholder formats exist in the catalog history. Both are detectable by `scripts/verify-i18n.cjs` and are scrubbed at runtime by `src/i18n/resourceNormalizer.ts` — so end-users see falling-back English instead of the marker:

- `__MISSING__:<keyPath>` — inserted by `scripts/sync-catalogs.cjs` when a key is missing in a locale. Reviewers must replace with a real translation; the placeholder must never ship to `main`.
- `[XX] <text>` — the obsolete sentinel prefix from `scripts/generate-locales.cjs` (locked down in `VF-I18N-REMEDIATION-20260725-01`). The obsolete producer refuses to run; any residual `[XX]` entries are pipeline leftovers and must be migrated into proper translations by hand.

Both markers can also be safely deleted by Reviewers when re-running `sync-catalogs.cjs --write`, which will recreate them as `__MISSING__` placeholders.

## Verifier Status JSON

`docs/i18n/translation-status.json` is the canonical measurement surface. `reviewStatus: complete` only when ALL of the following are true:

- `translatedKeyTotal === canonicalKeyTotal`
- `sentinelLeaves === 0` (no `[XX]` prefixes)
- `missingMarkerLeaves === 0` (no `__MISSING__:` placeholders)
- `identicalUnapprovedLeaves === 0` (no un-translated English leaves outside the allowlist)

The same status JSON drives `LOCALE_COMPLETION[<locale>].isProductionComplete` in `src/i18n/locale-completion-status.ts`, which `src/i18n/locales.ts` consumes. **There are no longer hardcoded `isProductionComplete: true` literals anywhere.**

## Hardcoded-String Audit

`scripts/verify-hardcoded-strings.cjs` uses the TypeScript Compiler API to inspect production `.ts`/`.tsx` files for visible JSX text and attributes, conditional/logical expression branches, semantic registries, toast/dialog arguments, and status-item prose. The historical 1,667-candidate runtime inventory has been migrated; both the strict scan and `config/i18n-hardcoded-baseline.json` now report zero candidates across the production surface.

Run both gates before merging visible UI work:

```bash
npm run i18n:verify-hardcoded
npm run verify:i18n-hardcoded-regressions
```

Do not add broad allowlists or increase the baseline to accept new prose. A necessary technical/proper-name exception must be narrow, reasoned in source, and reviewed alongside the generated inventory. Generated reports under `artifacts/i18n/` are validation output, not documentation authority.

## Runtime Translation Status

Catalog structure, runtime-surface coverage, and linguistic approval are separate measurements. `en-US` is the canonical source language. The other 11 catalogs currently have complete key/runtime coverage but remain `first-pass-machine` and `isProductionComplete: false` until a qualified reviewer and review date are recorded in the native-review metadata. Never describe structural coverage as native-speaker completion.
