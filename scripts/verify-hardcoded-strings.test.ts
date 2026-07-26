/** @fileoverview Regression tests for the hardcoded UI baseline-and-ratchet gate. */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const verifier = require("./verify-hardcoded-strings.cjs") as {
  compareToBaseline: (findings: Candidate[], baseline: Baseline) => Comparison;
  createBaseline: (findings: Candidate[]) => Baseline;
  runVerification: (options: Record<string, unknown>) => {
    ok: boolean;
    report: {
      findings: Candidate[];
      allowDirectiveIssues: unknown[];
      baselineComparison: Comparison | null;
    };
  };
};

type Candidate = {
  file: string;
  line: number;
  nodeKind: string;
  text: string;
  raw: string;
};

type Baseline = {
  schemaVersion: number;
  extractor: string;
  candidateCount: number;
  entryCount: number;
  entries: Array<{
    file: string;
    nodeKind: string;
    text: string;
    count: number;
  }>;
};

type Comparison = {
  regressions: Array<{
    file: string;
    text: string;
    count: number;
    baselineCount: number;
  }>;
  decreases: Array<{
    file: string;
    text: string;
    count: number;
    baselineCount: number;
  }>;
};

const tempRoots: string[] = [];

function makeProject(files: Record<string, string>) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-hardcoded-"));
  tempRoots.push(rootDir);
  const srcDir = path.join(rootDir, "src");
  fs.mkdirSync(srcDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(srcDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  }
  return { rootDir, srcDir };
}

function scan(files: Record<string, string>) {
  const project = makeProject(files);
  return verifier.runVerification({
    ...project,
    writeArtifacts: false,
  });
}

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop() as string, { recursive: true, force: true });
  }
});

describe("verify-hardcoded-strings baseline ratchet", () => {
  it("passes an exact baseline and preserves duplicate occurrence counts", () => {
    const result = scan({
      "Panel.tsx":
        "export const Panel = () => <><button>Cancel</button><button>Cancel</button></>;",
    });
    const baseline = verifier.createBaseline(result.report.findings);
    const comparison = verifier.compareToBaseline(
      result.report.findings,
      baseline,
    );

    expect(baseline.candidateCount).toBe(2);
    expect(baseline.entries).toEqual([
      { file: "src/Panel.tsx", nodeKind: "JsxText", text: "Cancel", count: 2 },
    ]);
    expect(comparison.regressions).toEqual([]);
    expect(comparison.decreases).toEqual([]);
  });

  it("fails a newly added candidate or an increased duplicate count", () => {
    const original = scan({
      "Panel.tsx": "export const Panel = () => <button>Cancel</button>;",
    });
    const baseline = verifier.createBaseline(original.report.findings);
    const changed = scan({
      "Panel.tsx":
        "export const Panel = () => <><button>Cancel</button><button>Cancel</button><p>New label</p></>;",
    });
    const comparison = verifier.compareToBaseline(
      changed.report.findings,
      baseline,
    );

    expect(comparison.regressions).toHaveLength(2);
    expect(comparison.regressions.map((entry) => entry.text).sort()).toEqual([
      "Cancel",
      "New label",
    ]);
  });

  it("allows removals and exposes them for explicit baseline regeneration", () => {
    const original = scan({
      "Panel.tsx":
        "export const Panel = () => <><button>Cancel</button><p>Old label</p></>;",
    });
    const baseline = verifier.createBaseline(original.report.findings);
    const changed = scan({
      "Panel.tsx": "export const Panel = () => <button>Cancel</button>;",
    });
    const comparison = verifier.compareToBaseline(
      changed.report.findings,
      baseline,
    );

    expect(comparison.regressions).toEqual([]);
    expect(comparison.decreases).toEqual([
      expect.objectContaining({
        file: "src/Panel.tsx",
        text: "Old label",
        count: 0,
        removedCount: 1,
      }),
    ]);
  });

  it("treats a rename as a new path and catches a removed candidate that reappears after regeneration", () => {
    const original = scan({
      "OldPanel.tsx": "export const Panel = () => <p>Legacy label</p>;",
    });
    const originalBaseline = verifier.createBaseline(original.report.findings);
    const renamed = scan({
      "NewPanel.tsx": "export const Panel = () => <p>Legacy label</p>;",
    });
    expect(
      verifier.compareToBaseline(renamed.report.findings, originalBaseline)
        .regressions,
    ).toHaveLength(1);

    const removed = scan({
      "OldPanel.tsx": 'export const Panel = () => <p>{t("panel.label")}</p>;',
    });
    const ratchetedBaseline = verifier.createBaseline(removed.report.findings);
    expect(
      verifier.compareToBaseline(original.report.findings, ratchetedBaseline)
        .regressions,
    ).toHaveLength(1);
  });

  it("requires a reason for allow directives and accepts a scoped reasoned directive", () => {
    const unreasoned = scan({
      "Panel.tsx":
        "export const Panel = () => <div>\n// i18n-allow-next-line\nBrand phrase\n</div>;",
    });
    expect(unreasoned.ok).toBe(false);
    expect(unreasoned.report.allowDirectiveIssues).toHaveLength(1);

    const reasoned = scan({
      "Panel.tsx":
        "export const Panel = () => <div>\n// i18n-allow-next-line: registered product name\nBrand phrase\n</div>;",
    });
    expect(reasoned.ok).toBe(true);
    expect(reasoned.report.allowDirectiveIssues).toEqual([]);
    expect(reasoned.report.findings).toEqual([]);
  });

  it("detects runtime-visible JSX attributes, expressions, conditionals, and logical branches", () => {
    const result = scan({
      "Panel.tsx": `
        export const Panel = ({ loading, error }: { loading: boolean; error: boolean }) => <>
          <input placeholder="Ask anything" aria-label="Message input" />
          <button title={'Send message'}>{loading ? 'Generating…' : 'Generate'}</button>
          <div>{error && 'Image save failed'}</div>
          <Widget label="Document Tools" emptyText="No results found" />
        </>;
      `,
    });

    expect(result.report.findings.map((entry) => entry.text).sort()).toEqual([
      "Ask anything",
      "Document Tools",
      "Generate",
      "Generating",
      "Image save failed",
      "Message input",
      "No results found",
      "Send message",
    ]);
  });

  it("detects semantic registries, prompt starters, and toast/dialog arguments", () => {
    const result = scan({
      "registry.tsx": `
        export const TAB_REGISTRY = [{ id: 'image', label: 'Image Studio', subtitle: 'Generate images from text' }];
        export const options = [{ id: '1:1', label: 'Square (Default)' }];
        export const starters = [{ id: 'writing-email', prompt: 'Draft a polite email to my landlord.' }];
        toast.error('Image save failed', 'The image could not be downloaded.');
        askText({ title: 'Create project', message: 'Choose a project name' });
        askDecision({ title: loading ? 'Please wait' : 'Delete project' });
        makeItem('apiKey', 'warn', 'API key configuration needs attention.');
      `,
    });

    expect(result.report.findings.map((entry) => entry.text)).toEqual(
      expect.arrayContaining([
        "Image Studio",
        "Generate images from text",
        "Square (Default)",
        "Draft a polite email to my landlord",
        "Image save failed",
        "The image could not be downloaded",
        "Create project",
        "Choose a project name",
        "Please wait",
        "Delete project",
        "API key configuration needs attention",
      ]),
    );
  });

  it("detects runtime prose separated by a slash while ignoring technical slash tokens", () => {
    const result = scan({
      "SlashLabels.tsx": `
        export const SlashLabels = () => <>
          <span>Edit / Upscale / Remove background</span>
          <code>image/png</code>
        </>;
      `,
    });

    expect(result.report.findings.map((entry) => entry.text)).toEqual([
      "Edit / Upscale / Remove background",
    ]);
  });

  it("ignores technical attributes, identifiers, paths, MIME types, and provider model IDs", () => {
    const result = scan({
      "Technical.tsx": `
        export const Technical = () => <>
          <div className="text-sm" id="status-panel" data-testid="status-panel" />
          <path d="M5 12h14" />
          <input accept="image/png,image/jpeg" />
          <Model id="zai-org-glm-5-2" endpoint="/api/v1/models" />
        </>;
        export const state = { value: 'off', modelId: 'zai-org-glm-5-2', mimeType: 'image/png', placeholder: '#7a8fa8' };
      `,
    });

    expect(result.report.findings).toEqual([]);
  });
});
