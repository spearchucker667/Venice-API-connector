# Audit Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remediate the six remaining audit findings by updating CI workflows, release verifiers, typecheck contract, and branch-protection documentation.

**Architecture:** Make minimal, targeted changes to the existing verifier scripts and workflows. Keep each fix in its canonical owner: version/tag parity in `verify-release-metadata`, artifact allowlist in `verify-dist`, branch-protection context in `enforce-github-rules.sh`, typecheck in `package.json`, and script coverage in `ci.yml`.

**Tech Stack:** GitHub Actions, Node.js/Vitest, TypeScript, shell.

**Spec:** `docs/superpowers/specs/2026-08-30-audit-remediation-design.md`

## Global Constraints

- Node.js pinned to `>=22.15.0 <23.0.0` via `package.json` engines and `.nvmrc`.
- Work on `main`; do not create branches, commits, or PRs unless explicitly requested.
- All workflow external actions must remain pinned to a full 40-hex SHA.
- Do not weaken existing coverage thresholds or remove existing gates.
- Preserve the existing Electron security posture (contextIsolation, nodeIntegration, sandbox, webSecurity, CSP, navigation restrictions).
- Update `docs/summary_of_work.md` before completing.

---

### Task 1: Add tag/version parity gate to release metadata verifier

**Files:**
- Modify: `scripts/verify-release-metadata.cjs`
- Modify: `scripts/verify-release-metadata.test.ts`

**Interfaces:**
- Consumes: `process.env.GITHUB_REF_NAME`, `package.json` version.
- Produces: `verifyReleaseMetadata(rootDir)` returns failure strings; new failure message: `"GitHub tag <tag> must match package.json version <version>"`.

- [ ] **Step 1: Add tag/version check to verifier**

Read `process.env.GITHUB_REF_NAME`. If it is set, starts with `v`, and is not equal to `"v" + version`, push a failure string.

```js
const tag = process.env.GITHUB_REF_NAME;
if (tag && tag.startsWith("v") && tag !== `v${version}`) {
  failures.push(`GitHub tag ${tag} must match package.json version v${version}.`);
}
```

- [ ] **Step 2: Add failing test for mistag**

In `scripts/verify-release-metadata.test.ts`, add a test that sets `process.env.GITHUB_REF_NAME = "v3.0.0"` while the fixture uses `3.0.0-beta.2`, asserts the failure contains the tag/version message, and unsets the env var in a `finally` block.

- [ ] **Step 3: Add passing test for matching tag**

Add a test that sets `GITHUB_REF_NAME = "v3.0.0-beta.2"` and asserts no failures.

- [ ] **Step 4: Run the verifier tests**

Run: `npx vitest run scripts/verify-release-metadata.test.ts --no-file-parallelism`
Expected: PASS

- [ ] **Step 5: Run the full script unit suite**

Run: `npm run test:unit:scripts`
Expected: PASS

---

### Task 2: Invoke tag/version verifier before release packaging

**Files:**
- Modify: `.github/workflows/release.yml`

**Interfaces:**
- Consumes: Existing `verify:release-readiness` step.
- Produces: A new `Verify tag/version parity` step that runs before packaging and fails the release on mistag.

- [ ] **Step 1: Add tag parity step before packaging in all three build jobs**

Insert a step named `Verify tag/version parity` immediately after `Verify release readiness` in `build-macos`, `build-windows`, and `build-linux`:

```yaml
      - name: Verify tag/version parity
        if: startsWith(github.ref, 'refs/tags/v')
        env:
          GITHUB_REF_NAME: ${{ github.ref_name }}
        run: npm run verify:release-metadata
```

- [ ] **Step 2: Verify workflow syntax**

Run: `npx yaml-lint .github/workflows/release.yml` or visually confirm indentation matches surrounding steps.

---

### Task 3: Prepare Electron test TypeScript typecheck (deferred command integration)

**Files:**
- Modify: `tsconfig.electron.test.json`

**Interfaces:**
- Consumes: Existing `tsconfig.electron.test.json` (includes `electron/**/*`).
- Produces: Test tsconfig with `vitest/globals` types; command integration deferred.

- [ ] **Step 1: Add Vitest globals types to the test tsconfig**

Update `tsconfig.electron.test.json` to include the Vitest globals type declarations:

```json
{
  "extends": "./tsconfig.electron.json",
  "compilerOptions": {
    "noEmit": true,
    "types": ["vitest/globals"]
  },
  "include": ["electron/**/*"],
  "exclude": ["node_modules", "src", "dist", "dist-electron"]
}
```

- [ ] **Step 2: Verify the standalone test project typecheck**

Run: `npx tsc --noEmit --project tsconfig.electron.test.json`
Expected: Surfaces ~140 pre-existing type errors; do not add the command to `npm run typecheck` until those errors are remediated.

- [ ] **Step 3: Track the deferred command integration**

Add `VF-ELECTRON-TEST-TYPECHECK-2026-08-31` to `docs/ROADMAP.md` describing the remaining work to fix the type errors and then update the `typecheck` script.

---

### Task 4: Add required script coverage CI job

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `vitest.config.ts`

**Interfaces:**
- Consumes: `npm run test:coverage:scripts` and the `lint-and-typecheck` job.
- Produces: A new `script-coverage` job whose result is available for branch protection; dedicated script-coverage thresholds in `vitest.config.ts`.

- [ ] **Step 1: Configure dedicated script-coverage thresholds**

In `vitest.config.ts`, make the coverage thresholds conditional on `COVERAGE_SCRIPTS`:

- When `COVERAGE_SCRIPTS=true`: apply the scripts/ thresholds globally and exclude `src/` and `electron/` from coverage so only `scripts/` files are measured.
- Otherwise: keep the existing app thresholds and exclude `scripts/`.

- [ ] **Step 2: Add script-coverage job**

Insert a new job after `coverage` and before `contracts`:

```yaml
  script-coverage:
    runs-on: ubuntu-22.04
    timeout-minutes: 30
    needs: [lint-and-typecheck]
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
      - uses: actions/setup-node@820762786026740c76f36085b0efc47a31fe5020 # v7.0.0
        with:
          node-version-file: '.nvmrc'
          cache: npm
      - run: npm ci
      - run: npm run test:coverage:scripts
      - name: Upload Script Coverage
        uses: actions/upload-artifact@ea165f8d65b6e75b540449e92b4886f43607fa02 # v4.6.2
        if: failure()
        with:
          name: script-coverage
          path: coverage/
          if-no-files-found: ignore
          retention-days: 7
```

- [ ] **Step 3: Update build job dependencies**

Change the `build` job `needs:` from:

```yaml
needs: [lint-and-typecheck, unit-and-integration-tests, coverage, contracts]
```

to:

```yaml
needs: [lint-and-typecheck, unit-and-integration-tests, coverage, script-coverage, contracts]
```

- [ ] **Step 4: Run CI contract verifier**

Run: `npm run verify:ci-contract`
Expected: PASS

---

### Task 5: Add release artifact allowlist to verify-dist

**Files:**
- Modify: `scripts/verify-dist.cjs`
- Modify: `scripts/verify-dist.test.ts`

**Interfaces:**
- Consumes: `version`, platform flags, `releaseDir` file list.
- Produces: `buildReleaseAllowlist(version, { checkWin, checkMac, checkLinux, targetArches, isPortableOnly })` returning a `Set<string>`; `verify-dist` fails if any file in `release/` is not on the allowlist.

- [ ] **Step 1: Implement allowlist builder**

Add a helper function near `getTargets`:

```js
function buildReleaseAllowlist(version, { checkWin, checkMac, checkLinux, targetArches, isPortableOnly }) {
  const allowed = new Set();
  const addSidecars = (name) => {
    allowed.add(name);
    allowed.add(`${name}.sha256`);
    if (name.endsWith(".exe") || name.endsWith(".dmg") || name.endsWith(".zip")) {
      allowed.add(`${name}.blockmap`);
      allowed.add(`${name}.blockmap.sha256`);
    }
  };

  if (checkWin) {
    const winArches = targetArches.includes("x64") ? ["x64"] : [];
    for (const arch of winArches) {
      if (!isPortableOnly) {
        addSidecars(`Venice-Forge-${version}-${arch}-Setup.exe`);
      }
      addSidecars(`Venice-Forge-${version}-${arch}-Portable.exe`);
    }
    if (!isPortableOnly) {
      addSidecars("latest.yml");
    }
  }

  if (checkMac) {
    for (const arch of targetArches) {
      addSidecars(`Venice-Forge-${version}-${arch}.dmg`);
      addSidecars(`Venice-Forge-${version}-${arch}.zip`);
    }
    addSidecars("latest-mac.yml");
  }

  if (checkLinux) {
    for (const ext of [".AppImage", ".deb", ".rpm"]) {
      addSidecars(`Venice-Forge-${version}-${ext}`);
    }
    // Updater metadata is platform-specific; include common Linux metadata files.
    const files = fs.readdirSync(releaseDir);
    for (const file of files) {
      if (/latest.*linux.*\.ya?ml$/i.test(file)) {
        addSidecars(file);
      }
    }
  }

  return allowed;
}
```

Export it when `require.main !== module`.

- [ ] **Step 2: Reject unknown release files**

After the platform-specific verification blocks and before the success log, add:

```js
const allowed = buildReleaseAllowlist(version, { checkWin, checkMac, checkLinux, targetArches, isPortableOnly });
const unexpected = fs.readdirSync(releaseDir).filter((f) => !allowed.has(f));
if (unexpected.length > 0) {
  fail(`Unexpected files in release/ are not on the artifact allowlist:\n  ${unexpected.join("\n  ")}`);
}
```

- [ ] **Step 3: Add allowlist unit tests**

In `scripts/verify-dist.test.ts`, add tests for:

1. `buildReleaseAllowlist` includes expected Windows x64 setup and portable artifacts plus latest.yml and their checksums/blockmaps.
2. It excludes unexpected files.
3. Running the verifier on a release dir with an extra file fails with "Unexpected files".

- [ ] **Step 4: Run verify-dist tests**

Run: `npx vitest run scripts/verify-dist.test.ts --no-file-parallelism`
Expected: PASS

- [ ] **Step 5: Run script unit suite**

Run: `npm run test:unit:scripts`
Expected: PASS

---

### Task 6: Update branch-protection helper with smoke jobs

**Files:**
- Modify: `scripts/enforce-github-rules.sh`
- Modify: `.github/bypass_actors.md`

**Interfaces:**
- Consumes: Existing ruleset JSON payload.
- Produces: Updated payload with the three smoke jobs in `required_status_checks`.

- [ ] **Step 1: Add smoke jobs to required_status_checks**

Change the `required_status_checks` array in `scripts/enforce-github-rules.sh` to:

```json
        "required_status_checks": [
          { "context": "lint-and-typecheck" },
          { "context": "unit-and-integration-tests" },
          { "context": "coverage" },
          { "context": "script-coverage" },
          { "context": "contracts" },
          { "context": "build" },
          { "context": "windows-sensitive-tests" },
          { "context": "macos-sensitive-tests" },
          { "context": "electron-smoke-macos" },
          { "context": "electron-smoke-windows" },
          { "context": "electron-smoke-linux" },
          { "context": "CodeQL / javascript-typescript" },
          { "context": "CodeQL / actions" }
        ]
```

Note: exact GitHub status-check context names may differ depending on how Rules01 is configured (workflow job names vs. full `Workflow / job` names). Update the helper to match the live ruleset naming convention; the audit finding text uses bare job names, so use those unless inspection shows otherwise.

- [ ] **Step 2: Document bypass-actor risk acceptance**

In `.github/bypass_actors.md`, append an explicit risk-acceptance note to the admin bypass entry:

```markdown
- **Risk acceptance:** This is a deliberate, documented emergency bypass. It is the only remaining bypass actor and is restricted to repository administrators. Removing it would require an alternate out-of-band recovery process for incidents where the normal PR/CI path is unavailable. Re-evaluate at each security review.
```

- [ ] **Step 3: Shell-check the helper**

Run: `bash -n scripts/enforce-github-rules.sh`
Expected: No syntax errors.

---

### Task 7: Update session handoff and roadmaps

**Files:**
- Modify: `docs/summary_of_work.md`
- Modify: `docs/ROADMAP.md` if any finding is deferred.

**Interfaces:**
- Consumes: The changes made in Tasks 1–6.
- Produces: Updated `Latest Session Summary` and `Session History` entries.

- [ ] **Step 1: Read docs/summary_of_work.md**

Run: `cat docs/summary_of_work.md`

- [ ] **Step 2: Update Latest Session Summary and append Session History entry**

Add a dated entry summarizing the six findings, the files changed, the commands run, and the manual follow-up required to synchronize live Rules01.

- [ ] **Step 3: Update ROADMAP.md if needed**

If the live ruleset update is deferred, add or update a ROADMAP item: "Synchronize live GitHub Rules01 with updated enforce-github-rules.sh (requires repo admin)."

---

### Task 8: Final validation

**Files:**
- All changed files.

- [ ] **Step 1: Run lint and typecheck**

Run: `npm run lint:eslint && npm run typecheck`
Expected: PASS

- [ ] **Step 2: Run relevant verifiers**

Run:
```bash
npm run verify:release-metadata
npm run verify:dist
npm run verify:ci-contract
```
Expected: PASS

- [ ] **Step 3: Run targeted test suites**

Run:
```bash
npx vitest run scripts/verify-release-metadata.test.ts scripts/verify-dist.test.ts scripts/verify-ci-contract.test.ts --no-file-parallelism
```
Expected: PASS

- [ ] **Step 4: Record validation results in docs/summary_of_work.md**

Update the Validation Matrix with the exact commands and results.
