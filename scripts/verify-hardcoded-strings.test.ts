/** @fileoverview Regression tests for the hardcoded UI baseline-and-ratchet gate. */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const verifier = require('./verify-hardcoded-strings.cjs') as {
  compareToBaseline: (findings: Candidate[], baseline: Baseline) => Comparison;
  createBaseline: (findings: Candidate[]) => Baseline;
  runVerification: (options: Record<string, unknown>) => { ok: boolean; report: { findings: Candidate[]; allowDirectiveIssues: unknown[]; baselineComparison: Comparison | null } };
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
  entries: Array<{ file: string; nodeKind: string; text: string; count: number }>;
};

type Comparison = {
  regressions: Array<{ file: string; text: string; count: number; baselineCount: number }>;
  decreases: Array<{ file: string; text: string; count: number; baselineCount: number }>;
};

const tempRoots: string[] = [];

function makeProject(files: Record<string, string>) {
  const rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vf-hardcoded-'));
  tempRoots.push(rootDir);
  const srcDir = path.join(rootDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  for (const [relativePath, content] of Object.entries(files)) {
    const target = path.join(srcDir, relativePath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, 'utf8');
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

describe('verify-hardcoded-strings baseline ratchet', () => {
  it('passes an exact baseline and preserves duplicate occurrence counts', () => {
    const result = scan({ 'Panel.tsx': 'export const Panel = () => <><button>Cancel</button><button>Cancel</button></>;' });
    const baseline = verifier.createBaseline(result.report.findings);
    const comparison = verifier.compareToBaseline(result.report.findings, baseline);

    expect(baseline.candidateCount).toBe(2);
    expect(baseline.entries).toEqual([
      { file: 'src/Panel.tsx', nodeKind: 'JsxText', text: 'Cancel', count: 2 },
    ]);
    expect(comparison.regressions).toEqual([]);
    expect(comparison.decreases).toEqual([]);
  });

  it('fails a newly added candidate or an increased duplicate count', () => {
    const original = scan({ 'Panel.tsx': 'export const Panel = () => <button>Cancel</button>;' });
    const baseline = verifier.createBaseline(original.report.findings);
    const changed = scan({ 'Panel.tsx': 'export const Panel = () => <><button>Cancel</button><button>Cancel</button><p>New label</p></>;' });
    const comparison = verifier.compareToBaseline(changed.report.findings, baseline);

    expect(comparison.regressions).toHaveLength(2);
    expect(comparison.regressions.map((entry) => entry.text).sort()).toEqual(['Cancel', 'New label']);
  });

  it('allows removals and exposes them for explicit baseline regeneration', () => {
    const original = scan({ 'Panel.tsx': 'export const Panel = () => <><button>Cancel</button><p>Old label</p></>;' });
    const baseline = verifier.createBaseline(original.report.findings);
    const changed = scan({ 'Panel.tsx': 'export const Panel = () => <button>Cancel</button>;' });
    const comparison = verifier.compareToBaseline(changed.report.findings, baseline);

    expect(comparison.regressions).toEqual([]);
    expect(comparison.decreases).toEqual([
      expect.objectContaining({ file: 'src/Panel.tsx', text: 'Old label', count: 0, removedCount: 1 }),
    ]);
  });

  it('treats a rename as a new path and catches a removed candidate that reappears after regeneration', () => {
    const original = scan({ 'OldPanel.tsx': 'export const Panel = () => <p>Legacy label</p>;' });
    const originalBaseline = verifier.createBaseline(original.report.findings);
    const renamed = scan({ 'NewPanel.tsx': 'export const Panel = () => <p>Legacy label</p>;' });
    expect(verifier.compareToBaseline(renamed.report.findings, originalBaseline).regressions).toHaveLength(1);

    const removed = scan({ 'OldPanel.tsx': 'export const Panel = () => <p>{t("panel.label")}</p>;' });
    const ratchetedBaseline = verifier.createBaseline(removed.report.findings);
    expect(verifier.compareToBaseline(original.report.findings, ratchetedBaseline).regressions).toHaveLength(1);
  });

  it('requires a reason for allow directives and accepts a scoped reasoned directive', () => {
    const unreasoned = scan({ 'Panel.tsx': 'export const Panel = () => <div>\n// i18n-allow-next-line\nBrand phrase\n</div>;' });
    expect(unreasoned.ok).toBe(false);
    expect(unreasoned.report.allowDirectiveIssues).toHaveLength(1);

    const reasoned = scan({ 'Panel.tsx': 'export const Panel = () => <div>\n// i18n-allow-next-line: registered product name\nBrand phrase\n</div>;' });
    expect(reasoned.ok).toBe(true);
    expect(reasoned.report.allowDirectiveIssues).toEqual([]);
    expect(reasoned.report.findings).toEqual([]);
  });
});
