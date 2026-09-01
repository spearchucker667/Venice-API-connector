# Venice Forge — Repository Hygiene Final Report

Date: 2026-09-01
Branch: `chore/repository-hygiene-2026-09-01`
Base: `main` @ `030380a6685a6ada83db9e0595043ae8821264fc`

## Removed Files

| File | Reason |
| --- | --- |
| `docs/archives/session-history-pre-2026-07-11.md` | 1.29 MiB pre-2026-07-11 agent session dump. Not referenced by runtime, package scripts, or `CANONICAL_REPORT_INDEX.md`. Directory is already policy-ignored via `/docs/archives/`. Git history retains the blob. |
| `docs/reports/historical/historical_summary_of_work.md` | 1.22 MiB superseded session ledger. Live ledger is `docs/summary_of_work.md`. |
| `VENICE_FORGE_COMPLETE_AUDIT.md` | Root-level 288-byte stub. Already listed in `.gitignore`. Root audit reports are forbidden by `docs/reports/historical/README.md`. |

## Moved Files

| Old Location | New Location |
| --- | --- |
| — | No moves. Active hygiene reports remain at `docs/audits/repository-hygiene-*.md`. |

## Updated Files

| File | Change |
| --- | --- |
| `docs/audits/repository-hygiene-audit.md` | Replaced stub with inventory, size evidence, and keep/remove rationale. |
| `docs/audits/repository-hygiene-final-report.md` | Replaced stub with execution record. |
| `docs/archives/README.md` | Clarified that bulky session dumps are untracked; git history remains. |
| `docs/DOCS_INDEX.md` | Removed links to missing AGENTS/Records paths; pointed hygiene reports at their real locations. |
| `.gitignore` | Added agent/local workspace patterns; removed trailing `/docs/audits` rule that undid the audits allowlist. Preserved every `verify-archive-clean` required pattern. |
| `docs/audits/Records/Venice_Forge-audit-evidence-20260717-031029/EVIDENCE_MANIFEST.md` | Replaced the empty file with a historical provenance note. The path remains required by `docs/ROADMAP.md` and `verify:roadmap-current`. |

## Ignored Files

| Pattern | Reason |
| --- | --- |
| `.agent/`, `.agents/`, `.ai/`, `.cursor/`, `.claude/`, `.local-ai/` | Agent working directories must not re-enter the public tree. |
| `.local/`, `.local-dev/`, `.dev/`, `tmp/` | Local-only developer scratch. |
| `/docs/archives/` | Historical extracts and future session dumps stay local. |
| `VENICE_FORGE_COMPLETE_AUDIT.md` | Prevents another root audit stub. |
| Existing build/secret/session patterns | Required by `scripts/verify-archive-clean.cjs`. |

## Validation

This pass changes documentation, ignore rules, and historical text only. It does not alter `src/`, `electron/`, `package.json`, or CI workflows.

Commands that remain the source of truth on a clean checkout:

```bash
npm ci
npm run lint:eslint
npm run typecheck
npm test
npm run build
npm run verify:archive-clean
npm run verify:markdown-links
npm run verify:repo-handoff-hygiene
npm run verify:agent-docs
```

This agent environment cannot run the full Node 22 Electron suite against a complete checkout (prior clones timed out on large blobs). After merge, CI on `.github/workflows/ci.yml` is the authoritative validation.

Expected local effects:

- `verify-archive-clean` continues to pass: required `.gitignore` strings are preserved; deleted files were not in its forbidden-path set.
- `verify-markdown-links` should not newly fail: deleted targets were not required by scanned, non-ignored docs (`CANONICAL_REPORT_INDEX.md` did not list the dumps).
- `verify-repo-handoff-hygiene` still forbids root `AUDIT-*.md` / session artifacts; the removed root stub did not match those patterns but violated the documented root-report policy.

## Follow-up (not in this pass)

1. Compress or replace `assets/ReadMe_Preview.png` (2.8 MiB) with a WebP/JPEG under ~400 KiB and keep the PNG only if packaging requires it.
2. Stop gitignoring tracked canonical files `docs/ROADMAP.md` and `docs/DOCS_INDEX.md` after a dedicated markdown-link repair of those two files.
3. Consider Git LFS only if additional binary screenshots are added.
4. Optionally relocate `docs/DEVELOPMENT/BUG_HUNTING_AGENT_PROMPT.md` next to `docs/reports/historical/BUG_HUNTING_AGENT_PROMPT.md` in a later docs PR after updating any identity-verifier expectations.
