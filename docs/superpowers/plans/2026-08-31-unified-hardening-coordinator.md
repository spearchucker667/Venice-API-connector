# Unified Theme, CI, CSP, Electron Typecheck, and Replicate Durability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Integrate the approved five-workstream hardening program while preserving the intentionally dirty `main` worktree and publishing only validated, task-owned commits.

**Architecture:** Execute four focused subsystem plans in dependency order, treating the existing Theme Engine V2 and CI/package diff as inherited implementation to reconcile rather than rewrite. Each subsystem produces an independently reviewable commit; the final coordinator gate reruns the complete repository validation and verifies remote `main` at the published SHA.

**Tech Stack:** Node.js 22 from `.nvmrc`, npm 10, TypeScript 5.8, React 19, Electron 43, Vitest 4, Vite 8, GitHub Actions, electron-builder.

**Spec:** `docs/superpowers/specs/2026-08-31-unified-theme-ci-csp-electron-replicate-design.md`

## Global Constraints

- Work exclusively on local `main`; do not create a branch, pull request, additional worktree, or detached checkout.
- Preserve all starting dirty changes; do not reset, restore, clean, stash, or overwrite unrelated work.
- Use the `.nvmrc`-selected Node runtime satisfying `>=22.15.0 <23.0.0` and npm `>=10.0.0`.
- Keep production renderer CSP at `style-src 'self'`; never add `'unsafe-inline'` to solve Meteocon rendering.
- Persist a paid-submission intent before dispatch; ambiguous Replicate acceptance must never trigger blind resubmission.
- Preserve provider tokens in main-process secure storage and exclude secrets, authorization headers, and signed output URLs from durable records and logs.
- Preserve Local Family Safe Mode, SSRF validation, redirect validation, MIME checks, media signatures, IPC validation, and profile isolation.
- Run Vitest repository suites serially where the package scripts require `--no-file-parallelism`.
- Stage files explicitly and commit only validated task-owned changes.
- Before pushing, fetch `origin/main`; stop if remote `main` contains commits absent from local `main`.

---

### Task 1: Establish the execution baseline and ownership ledger

**Files:**
- Read: `AGENT_REINITIALIZATION.md`
- Read: `docs/summary_of_work.md`
- Read: `docs/DOCS_INDEX.md`
- Read: `docs/ROADMAP.md`
- Read: `docs/superpowers/specs/2026-08-31-unified-theme-ci-csp-electron-replicate-design.md`
- Create locally, do not commit: `/tmp/venice-forge-unified-start-status.txt`
- Create locally, do not commit: `/tmp/venice-forge-unified-start-diff.patch`

**Interfaces:**
- Consumes: local `main` and the existing dirty worktree.
- Produces: immutable local evidence used to prove no inherited work was lost.

- [ ] **Step 1: Confirm repository and branch identity**

```bash
EXPECTED_ROOT="/Users/super_user/Projects/Venice_Forge"
test "$(git rev-parse --show-toplevel)" = "$EXPECTED_ROOT"
test "$(git branch --show-current)" = "main"
git symbolic-ref --quiet --short HEAD | grep -qx 'main'
```

- [ ] **Step 2: Select the repository runtime**

```bash
source "$NVM_DIR/nvm.sh"
nvm install
nvm use
node --version
npm --version
node -e 'const [major,minor]=process.versions.node.split(".").map(Number); if (major!==22 || minor<15) process.exit(1)'
```

Expected: Node 22.15 or later but earlier than Node 23, and npm 10 or later.

- [ ] **Step 3: Capture the complete starting state**

```bash
{
  git status --short --branch
  git diff --stat
  git diff --name-status
  git diff --cached
  git rev-parse HEAD
  git log -10 --oneline --decorate
  git remote -v
  git branch -vv
} > /tmp/venice-forge-unified-start-status.txt
git diff --binary > /tmp/venice-forge-unified-start-diff.patch
```

- [ ] **Step 4: Verify the known compiler baseline**

```bash
npx tsc --noEmit --project tsconfig.electron.test.json 2>&1 | tee /tmp/venice-forge-electron-test-tsc-baseline.log
test "$(rg -c 'error TS[0-9]+' /tmp/venice-forge-electron-test-tsc-baseline.log)" -eq 146
```

Expected: the command fails with the reconciled 146-diagnostic baseline. If the count differs, regenerate the per-file inventory before editing and record the new factual count in the final handoff.

- [ ] **Step 5: Read the four subsystem plans before execution**

```text
docs/superpowers/plans/2026-08-31-electron-test-typecheck.md
docs/superpowers/plans/2026-08-31-csp-meteocon-remediation.md
docs/superpowers/plans/2026-08-31-replicate-paid-submission-durability.md
docs/superpowers/plans/2026-08-31-theme-ci-reconciliation.md
```

### Task 2: Execute the Electron test typecheck plan

**Files:**
- Plan: `docs/superpowers/plans/2026-08-31-electron-test-typecheck.md`

**Interfaces:**
- Consumes: the 146-diagnostic baseline and dirty `tsconfig.electron.test.json`.
- Produces: a passing standalone Electron test compiler project and canonical `npm run typecheck` integration.

- [ ] **Step 1: Execute every unchecked task in the Electron typecheck plan**

Run the plan with `superpowers:executing-plans` or the approved task-by-task execution workflow.

- [ ] **Step 2: Verify its terminal gates**

```bash
npx tsc --noEmit --project tsconfig.electron.test.json
npm run typecheck
npm run test:electron
```

Expected: all three commands pass.

### Task 3: Execute CSP-001 remediation

**Files:**
- Plan: `docs/superpowers/plans/2026-08-31-csp-meteocon-remediation.md`

**Interfaces:**
- Consumes: strict production CSP and the passing typecheck boundary.
- Produces: CSP-compatible Meteocon output plus raw/build/package regression checks.

- [ ] **Step 1: Execute every unchecked task in the CSP plan**

Run the plan without changing `rendererCsp(false)` semantics.

- [ ] **Step 2: Verify its terminal gates**

```bash
npx vitest run src/components/ui/Meteocon.test.tsx electron/utils/rendererCsp.test.ts tests/csp/inlineStyleInvariant.test.ts --no-file-parallelism
npm run build
```

Expected: focused tests and production build pass with no generated Meteocon `<style>` or `style=` markup.

### Task 4: Execute Replicate paid-submission durability

**Files:**
- Plan: `docs/superpowers/plans/2026-08-31-replicate-paid-submission-durability.md`

**Interfaces:**
- Consumes: the compiler and CSP-safe integrated tree.
- Produces: provider-neutral durable submission orchestration, Replicate write-ahead integration, restart recovery, and bounded reads.

- [ ] **Step 1: Execute every unchecked task in the Replicate durability plan**

Preserve all current URL, token, MIME, signature, safety, and profile checks.

- [ ] **Step 2: Verify its terminal gates**

```bash
npx vitest run electron/services/paidSubmissionManager.test.ts electron/services/replicateService.test.ts electron/ipc/handlers/replicateHandlers.test.ts electron/services/backgroundTaskManager.replicate.test.ts --no-file-parallelism
npm run test:electron
npm run typecheck
```

Expected: all commands pass and the handler has no direct create-prediction-then-create-task path.

### Task 5: Reconcile inherited Theme Engine V2 and CI/package work

**Files:**
- Plan: `docs/superpowers/plans/2026-08-31-theme-ci-reconciliation.md`

**Interfaces:**
- Consumes: the inherited uncommitted Theme/CI implementation plus all preceding subsystem commits.
- Produces: reviewed Theme V2 and CI/package changes with current-tree validation evidence.

- [ ] **Step 1: Execute every unchecked task in the Theme/CI reconciliation plan**

Do not rewrite generated family files solely to make authorship cleaner.

- [ ] **Step 2: Verify its terminal gates**

```bash
npm run test:unit:theme
npm run verify:theme-tokens
npm run test:coverage:scripts
npm run verify:ci-contract
npm run verify:dist
```

Expected: all locally applicable commands pass; artifact-dependent checks report a factual skip only when the required packaged artifacts do not exist.

### Task 6: Run the integrated repository gate and update canonical documentation

**Files:**
- Modify: `docs/summary_of_work.md`
- Modify: `docs/ROADMAP.md`
- Modify only if authority changes: `docs/DOCS_INDEX.md`

**Interfaces:**
- Consumes: all validated subsystem commits.
- Produces: final-tree evidence and an accurate remaining-work ledger.

- [ ] **Step 1: Run the mandatory broad sequence**

```bash
npm run lint:eslint
npm run typecheck
npm test
npm run verify:safety-guard
npm run verify:markdown-links
npm run verify:contracts
npm run build
npm run ci
```

Expected: each command exits zero. Record exact test totals, skips, coverage summaries, and command durations from actual output.

- [ ] **Step 2: Run UI-adjacent localization checks**

```bash
npm run verify:i18n
npm run verify:i18n-hardcoded-regressions
```

Expected: both pass; non-English locale status remains governed by native-review metadata.

- [ ] **Step 3: Run the strongest feasible packaged macOS sequence**

```bash
npm run dist:mac:arm64
RUN_ELECTRON_SMOKE=true npx vitest run tests/smoke/electron-smoke.test.ts --no-file-parallelism
node scripts/clean-release-staging.cjs
node scripts/verify-dist.cjs --mac --arch arm64
```

Expected: packaging, four packaged smoke cases, cleanup, and artifact verification pass. If signing or environment configuration prevents this sequence, record the exact command and error without weakening the test.

- [ ] **Step 4: Update canonical documentation with actual results**

Add a latest-session summary and dated session-history entry covering:

```text
starting and final commits
pre-existing dirty work
task-owned files
Electron diagnostic categories and zero-error result
CSP root cause and unchanged directive
Replicate lifecycle and recovery table
Theme and CI reconciliation findings
every command actually run and its result
manual or hosted evidence not obtained
```

Update `docs/ROADMAP.md` only from verified current evidence. Do not mark paid live Replicate acceptance, Windows/Linux packaging, native-speaker translation review, or hosted CI/CodeQL complete without direct evidence.

- [ ] **Step 5: Validate documentation and commit it**

```bash
npm run verify:markdown-links
npm run verify:agent-docs
git add docs/summary_of_work.md docs/ROADMAP.md docs/DOCS_INDEX.md
git diff --cached --check
git commit -m "docs: record unified hardening validation"
```

Stage `docs/DOCS_INDEX.md` only if it changed during implementation.

### Task 7: Prove dirty-worktree preservation and publish local main

**Files:**
- Read: `/tmp/venice-forge-unified-start-status.txt`
- Read: `/tmp/venice-forge-unified-start-diff.patch`

**Interfaces:**
- Consumes: final local commits and the starting evidence bundle.
- Produces: verified publication to remote `main` without losing unrelated work.

- [ ] **Step 1: Inspect final local state**

```bash
git status --short
git diff
git diff --cached
git log --oneline --decorate -n 10
```

Expected: no task-related changes remain uncommitted. Any remaining paths are identified as preserved unrelated work.

- [ ] **Step 2: Check remote advancement**

```bash
git remote -v
git branch -vv
git fetch origin main
git rev-list --left-right --count origin/main...main
```

Expected: the left count is `0`. If it is non-zero, stop; do not pull, merge, rebase, reset, or overwrite remote history.

- [ ] **Step 3: Verify the exact publication set**

```bash
git diff --stat origin/main..main
git log --oneline origin/main..main
```

- [ ] **Step 4: Push and verify remote main**

```bash
git push
LOCAL_HEAD="$(git rev-parse main)"
REMOTE_HEAD="$(git ls-remote origin refs/heads/main | awk '{print $1}')"
test -n "$REMOTE_HEAD"
test "$LOCAL_HEAD" = "$REMOTE_HEAD"
```

Expected: push succeeds and both hashes match exactly.
