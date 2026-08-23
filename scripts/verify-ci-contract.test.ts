// @vitest-environment node

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("verify:ci-contract required gate coverage", () => {
  it.each([
    "verify:theme-tokens",
    "verify:ci-contract",
    "verify:agent-docs",
  ])("requires %s", (gate) => {
    const source = fs.readFileSync(path.resolve(__dirname, "verify-ci-contract.cjs"), "utf8");
    const requiredGates = source.match(/const requiredGates = \[([\s\S]*?)\];/)?.[1] ?? "";
    expect(requiredGates).toContain(`'${gate}'`);
  });

  it("fails if vitest.config.ts uses the unsupported global threshold key", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "verify-ci-contract.cjs"), "utf8");
    expect(source).toContain("Coverage thresholds must not be nested under 'global'");
  });

  it("requires tracked CodeQL and dependency-review workflows", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "verify-ci-contract.cjs"), "utf8");
    expect(source).toContain(".github/workflows/codeql.yml");
    expect(source).toContain(".github/workflows/dependency-review.yml");
    expect(source).toContain("github/codeql-action");
    expect(source).toContain("dependency-review-action");
  });

  // VERIFY-112 regression guard
  it("requires the segmented CI suite to include all non-smoke contract test roots", () => {
    const source = fs.readFileSync(path.resolve(__dirname, "verify-ci-contract.cjs"), "utf8");
    expect(source).toContain("const requiredContractTestPaths = [");
    expect(source).toContain("'tests/safety'");
    expect(source).toContain("'tests/csp'");
    expect(source).toContain("'tests/electron'");
    expect(source).toContain("'scripts/verify-document-ingestion.test.ts'");
    expect(source).toContain("test:ci must invoke test:contracts");
  });
});

describe("verify:ci-contract external action pinning enforcement", () => {
  const readVerifier = () => fs.readFileSync(path.resolve(__dirname, "verify-ci-contract.cjs"), "utf8");

  it("contains a generalized full-SHA pinning check covering every workflow file", () => {
    const source = readVerifier();
    expect(source).toContain(".github/workflows");
    expect(source).toContain("[0-9a-f]{40}$/i");
    expect(source).toContain("uses:");
    expect(source).toContain("FULL_SHA_RE");
    expect(source).toContain("['branches', 59]");
  });

  it("never treats a floating tag or branch as pinned", () => {
    const source = readVerifier();
    // The verifier must reject refs that are not a full 40-hex commit SHA.
    expect(source).toContain("[0-9a-f]{40}$/i");
    expect(source).not.toMatch(/actions\/upload-artifact@v4\s/);
  });

  it("enforces the coverage threshold floor (no silent lowering)", () => {
    const source = readVerifier();
    expect(source).toContain("the coverage bar cannot be lowered");
    expect(source).toContain("['branches', 59]");
    expect(source).toContain("['functions', 68]");
    expect(source).toContain("['lines', 73]");
    expect(source).toContain("['statements', 70]");
  });

  it("enforces the CI job dependency graph (build gates on coverage, smokes gate on platform)", () => {
    const source = readVerifier();
    expect(source).toContain("'build' job must depend on the 'coverage' job");
    expect(source).toContain("electron-smoke-macos");
    expect(source).toContain("electron-smoke-windows");
    expect(source).toContain("must depend on both 'build'");
  });

  it("enforces the CodeQL language matrix (javascript-typescript + actions)", () => {
    const source = readVerifier();
    expect(source).toContain("language: javascript-typescript");
    expect(source).toContain("language: actions");
    expect(source).toContain("languages: ${{ matrix.language }}");
    expect(source).toContain("deterministic per-language category");
  });
});

describe("verify-ci-contract workflow contents", () => {
  const root = path.resolve(__dirname, "..");
  const workflowsDir = path.join(root, ".github/workflows");

  it("has no unpinned external action references in any workflow", () => {
    for (const file of fs.readdirSync(workflowsDir)) {
      if (!/\.ya?ml$/i.test(file)) continue;
      const content = fs.readFileSync(path.join(workflowsDir, file), "utf8");
      const refs = content.match(/(^|\s)uses:\s*([^\s#]+)/g) ?? [];
      for (const raw of refs) {
        const value = raw.replace(/^\s*uses:\s*/, "").trim();
        if (value.startsWith("./")) continue;
        if (value.startsWith("docker://")) continue;
        expect(value, `${file}: ${value}`).toMatch(/^[^.][^\s]*@[0-9a-fA-F]{40}$/);
      }
    }
  });
});
