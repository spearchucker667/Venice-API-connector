/** @fileoverview Regression tests for scripts/enforce-github-rules.sh.
 *
 * Verifies that the ruleset-sync helper:
 *   - is valid bash syntax
 *   - lists the exact required checks that match the CI workflow jobs
 *   - preserves the Rules01 ruleset ID
 *   - does not alter admin bypass in its payload construction
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
const scriptPath = join(__dirname, "enforce-github-rules.sh");

describe("enforce-github-rules.sh", () => {
  it("is valid bash syntax", () => {
    const out = spawnSync("bash", ["-n", scriptPath], { encoding: "utf8" });
    expect(out.status, out.stderr).toBe(0);
  });

  it("targets the canonical Rules01 ruleset ID", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain('RULESET_ID="21229461"');
  });

  it("lists the exact required checks from CI and CodeQL workflows", () => {
    const source = readFileSync(scriptPath, "utf8");
    const ciYaml = readFileSync(join(repoRoot, ".github/workflows/ci.yml"), "utf8");
    const codeqlYaml = readFileSync(join(repoRoot, ".github/workflows/codeql.yml"), "utf8");

    const ciChecks = [
      "lint-and-typecheck",
      "unit-and-integration-tests",
      "coverage",
      "script-coverage",
      "contracts",
      "build",
      "windows-sensitive-tests",
      "macos-sensitive-tests",
      "electron-smoke-macos",
      "electron-smoke-windows",
      "electron-smoke-linux",
    ];
    const codeqlChecks = ["Analyze javascript-typescript", "Analyze actions"];

    for (const check of [...ciChecks, ...codeqlChecks]) {
      expect(source).toContain(`"${check}"`);
    }

    for (const check of ciChecks) {
      expect(ciYaml).toContain(`${check}:`);
    }

    expect(codeqlYaml).toContain("name: Analyze ${{ matrix.language }}");
    expect(codeqlYaml).toContain("language: javascript-typescript");
    expect(codeqlYaml).toContain("language: actions");
  });

  it("preserves bypass_actors in the payload shape", () => {
    const source = readFileSync(scriptPath, "utf8");
    expect(source).toContain("bypass_actors: .bypass_actors");
  });
});
