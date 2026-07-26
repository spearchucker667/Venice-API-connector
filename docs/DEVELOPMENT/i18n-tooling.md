# i18n Tooling

Authoritative owner: the `src/i18n/` runtime modules (`locales.ts`, `index.ts`, `formatters.ts`, `direction.ts`) and the tooling scripts under `scripts/`. Anything that mutates the catalog tree must go through the canonical workflow described here — ad-hoc patches are not supported.

## Roles

- **Source-code authoring.** After adding or renaming a key, run `npm run i18n:extract` so the source-key inventory is fresh; this does *not* generate translations, it only proves the key is required.
- **Catalog authoring.** Translators edit JSON in `src/i18n/resources/<locale>/<namespace>.json` by hand. Use established terminology from `docs/i18n/GLOSSARY.md` and copy tone from `docs/i18n/TRANSLATION_GUIDE.md`.
- **Automated sync.** When the source enum grows or a new namespace appears, run `npm run i18n:sync-catalogs`. The tool is **additive only** — it never overwrites a translator's leaf and never writes a sentinel (`[XX]`) — missing keys become explicit `__MISSING__:<keyPath>` placeholders so the verifier can spot them.
- **Verification.** `npm run verify:i18n` (alias: `npm run i18n:coverage`) writes `docs/i18n/translation-status.json` and exits non-zero if any sentinel or `__MISSING__:` marker is detected. Use `--strict` to fail on interpolation mismatch as well.

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `i18n:extract` | `node scripts/extract-i18n-keys.cjs` | AST-based source-key inventory → `artifacts/i18n/source-key-inventory.json` and `.md`. Replaces the prior regex-only extractor. |
| `i18n:sync-catalogs` | `node scripts/sync-catalogs.cjs` | Add new en-US keys into every locale as `__MISSING__:<keyPath>`. Refuses to overwrite existing translations and refuses to seed translations for any locale other than `en-US`. CLI: `--allow-seed-override` (emergency). |
| `i18n:coverage` | `npm run verify:i18n` | Truth translator coverage report. |
| `verify:i18n` | `node scripts/verify-i18n.cjs` | Same engine, with explicit CLI flags (`--strict`, `--allow-sentinels`, `--allow-missing-markers`, `--locales`, `--namespaces`, `--resources-dir`). |
| `test:i18n` | `npx vitest run scripts/i18n-tooling.test.ts src/i18n/i18n.test.ts` | Lockdown tests for the tooling itself. |

## Status JSON schema (v2)

`docs/i18n/translation-status.json` reports each locale against the en-US canonical leaf count. Fields per locale:

- `canonicalKeyTotal` — leaves in `en-US/<ns>.json` (the source of truth).
- `translatedKeyTotal` — leaves in the locale that differ from en-US and are not sentinels / `__MISSING__:`.
- `sentinelLeaves` — leaves matching `^\s*\[[A-Za-z][A-Za-z-]{1,10}\]\s` (the false-green pattern).
- `missingMarkerLeaves` — leaves matching `^\s*__MISSING__:`.
- `identicalUnapprovedLeaves` — leaves equal to en-US but not on the identical-allowlist (cn names, file types, model IDs, etc.).
- `docsCoveragePercent` — `100 - <missing docs directory entries> / <total docs required> * 100`.
- `reviewStatus` — `complete` only when `pct === 100 && sentinelLeaves === 0 && missingMarkerLeaves === 0 && identicalUnapprovedLeaves === 0 && docsCoveragePercent === 100`. Otherwise `pending-translation` if there are sentinel/missing entries, else `in-progress`.

Top-level: `schemaVersion`, `updatedAt`, `extractorArtifact` (path to `artifacts/i18n/source-key-inventory.json`), `verifier` (`verify-i18n.cjs` semantic version).

## Obsolete scripts (locked down)

These must not be invoked. They exist only for forensic review of the 2026-07-25 false-green commit.

- `scripts/generate-locales.cjs` — sentinel producer (`[RU]/[DE]/[FR]/...`). Head-of-file guard prints a VF-I18N-REMEDIATION-20260725-01 retirement notice and exits with code 2 when called directly. Not exposed via `package.json`.
- `scripts/populate-en-us-catalogs.cjs` — en-US default-dumper. Refuses to run unless `--legacy-seed` is provided. Not exposed via `package.json`.

## Translator workflow

1. Run `npm run i18n:extract` to confirm the source-of-truth key inventory is current.
2. Open `src/i18n/resources/<your-locale>/<namespace>.json` for the namespace you are translating.
3. Replace each `__MISSING__:<keyPath>` line with the translated string. **Do not leave the placeholder.**
4. Keep `{{name}}` interpolation variables intact — the verifier rejects mismatched interpolation.
5. Use the identical-allowlist (Venice Forge, API, JSON, PNG, MP4, GLM 5.2, etc.) for product and protocol names that should not be translated.
6. Run `npm run verify:i18n`. Expect exit code 0 and `<locale>` row to show `sentinelLeaves: 0`, `missingMarkerLeaves: 0`, and `reviewStatus: complete` only when every other locale also clears.
7. Update `docs/i18n/<locale>/` prose pages with the same terminology.
