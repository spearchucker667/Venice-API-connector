# Venice Forge — Repository Hygiene Audit

Date: 2026-09-01
Ref inspected: `main` @ `030380a6685a6ada83db9e0595043ae8821264fc`
(earlier tree walk also covered `43554fc15e20c8f6eda51942d92ccda3581167e4`)

This document is the inventory and decision record for the public-distribution hygiene pass. Deletions are limited to files whose purpose was verified and that are not required to build, test, document, or package the application.

## Current Structure

Top-level distribution surface:

| Path | Classification | Notes |
| --- | --- | --- |
| `src/`, `electron/`, `server.ts`, `index.html` | Public / required | Application source |
| `public/`, `config/`, `build/icon.*` | Public / required | Runtime and installer assets |
| `assets/branding/`, `assets/mascot/` | Public / required | README branding and in-app mascot (`CharacterCreatorMascot.tsx`) |
| `assets/ReadMe_Preview.png` (2.8 MiB) | Public / retained | Only README hero screenshot; keep until a compressed replacement exists |
| `docs/` | Mixed | Active docs plus historical audits/reports/archives |
| `scripts/`, `tests/`, `.github/` | Public / required | CI, verify contracts, release |
| `inactive-features/research-browser/` | Retained archive | Required by `verify-inactive-feature-archive`; not bundled |
| Root legal/governance markdown | Public / required | `README.md`, `LICENSE`, `SECURITY.md`, `AGENTS.md`, etc. |
| `VENICE_FORGE_COMPLETE_AUDIT.md` | Stale stub | Already listed in `.gitignore`; 288-byte placeholder |

Documentation layout already matches the intended public map (`ABOUT`, `FAQ`, `ROADMAP`, `DOCS_INDEX`, plus `architecture/`, `DEVELOPMENT/`, `security/`, `RELEASE/`, `audits/`, `user/`). Historical material lives under `docs/archives/`, `docs/audits/Records/`, and `docs/reports/historical/`.

## Problems Found

### Clone and checkout bloat

| File | Size | Usage |
| --- | ---: | --- |
| `assets/ReadMe_Preview.png` | 2,803,600 | Referenced only from `README.md`. Retained (product screenshot). |
| `docs/archives/session-history-pre-2026-07-11.md` | 1,294,543 | Pre-2026-07-11 agent session dump. Policy already ignores `/docs/archives/`. Not referenced by runtime, CI scripts, or `CANONICAL_REPORT_INDEX.md`. |
| `docs/reports/historical/historical_summary_of_work.md` | 1,216,168 | Superseded session ledger. Live ledger is `docs/summary_of_work.md`. Not listed in `CANONICAL_REPORT_INDEX.md`. |
| `docs/reference/Venice_swagger_api.yaml` | 569,331 | Required API contract snapshot. Retained. |
| `docs/audits/Records/CHANGELOG.md` | 149,494 | Historical ledger. Retained as audit history. |

The two multi-megabyte Markdown dumps are the highest-confidence removable bloat. They are generated agent/session history, not product documentation.

### Incomplete prior hygiene pass

`docs/audits/repository-hygiene-audit.md` and `docs/audits/repository-hygiene-final-report.md` were 579- and 412-byte stubs from 2026-09-01 claiming removal of root `scratch*.cjs` files that are already absent from the tracked tree. `VENICE_FORGE_COMPLETE_AUDIT.md` at the repository root is a three-paragraph stub and is already gitignored.

### `.gitignore` contradictions

- Canonical docs `docs/ROADMAP.md` and `docs/DOCS_INDEX.md` are ignored even though they are tracked and are the public documentation map. Left in place in this pass so `verify-markdown-links` does not newly scan pre-existing historical links; documented as follow-up.
- A trailing `/docs/audits` rule after more specific `!` allowlists ignored the entire audits tree for link scanning.
- Agent workspace directories from the hygiene charter (`.agent/`, `.claude/`, `.local/`, and similar) were incomplete.

### Documentation index drift

`docs/DOCS_INDEX.md` pointed at files that are not in the tree:

- `docs/AGENTS/AGENTS.md` and `docs/AGENTS/agent-reinitialization.md` (`/docs/AGENTS/` is gitignored and absent)
- `docs/audits/Records/venice-forge-exhaustive-audit-2026-08-15/00-EXECUTIVE-SUMMARY.md`
- `docs/audits/Records/semantic-media-classifier-decision-2026-09-01.md`
- `docs/audits/Records/browser-reactivation-work-order.md`
- `docs/audits/Records/repository-hygiene-audit.md` (actual path is `docs/audits/repository-hygiene-audit.md`)

It also listed `docs/DEVELOPMENT/BUG_HUNTING_AGENT_PROMPT.md` as deleted while that file remains tracked. The file is retained: `CANONICAL_REPORT_INDEX.md` treats the historical copy as evidence, and `verify-repo-handoff-hygiene.cjs` still understands the prompt if present at `docs/BUG_HUNTING_AGENT_PROMPT.md`.

### Intentionally not removed

- Mascot GIF/PNG set under `assets/mascot/` — imported by `src/components/character-creator/CharacterCreatorMascot.tsx` and `src/components/generation/generation-animation-registry.ts`.
- Branding SVGs — README and legal attribution.
- `build/icon.ico`, `build/icon.icns`, `build/icon.png` — installer assets required by `verify-archive-clean` / `clean-repo-zip.sh`.
- `inactive-features/research-browser/` — archive contract, not bundled.
- `docs/audits/Records/**` dated reports — development history; not clone-blocking individually.
- `docs/superpowers/**` current plans/specs — active agent design records referenced from `DOCS_INDEX.md`.
- Verification scripts under `scripts/verify-*.cjs` — each is wired from `package.json` `verify:contracts*`.

## Proposed Changes

1. Delete the two multi-megabyte historical Markdown dumps.
2. Delete the root `VENICE_FORGE_COMPLETE_AUDIT.md` stub.
3. Delete the empty `docs/audits/Records/Venice_Forge-audit-evidence-20260717-031029/EVIDENCE_MANIFEST.md` placeholder.
4. Replace this audit and the final report with complete records.
5. Repair `docs/DOCS_INDEX.md` links that target missing files.
6. Update `docs/archives/README.md` to state that bulky session dumps are no longer tracked.
7. Harden `.gitignore` for agent/local workspaces and remove the trailing `/docs/audits` contradiction. Preserve every pattern required by `scripts/verify-archive-clean.cjs`.

## Files Removed

See `docs/audits/repository-hygiene-final-report.md`.

## Files Moved

None in this pass. Historical reports already live under `docs/archives/`, `docs/audits/Records/`, and `docs/reports/historical/`.

## Files Retained

All application source, tests, CI, legal files, branding, mascot animations, installer icons, API reference snapshot, and dated audit records other than the dumps listed above.

## Reasoning

Public clones should not download 2.5 MiB of superseded agent session text. Product binaries, themes, i18n catalogs, and contract verifiers stay. Screenshot compression and Git LFS for `assets/ReadMe_Preview.png` are deferred so the README hero image remains available.
