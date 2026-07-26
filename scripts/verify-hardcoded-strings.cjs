#!/usr/bin/env node
/**
 * @fileoverview Hardcoded visible-text verifier.
 *
 * Uses the TS Compiler API (with `setParentNodes: true`) to walk every
 * `.ts`/`.tsx` source file under `src/` and locate JSX-Text leaves — i.e.,
 * raw user-visible text inside the JSX tree that is NOT wrapped in
 * `{t('…')}` / `{variable}` / `{i18nKey}`. These are candidates that should
 * either be moved to the i18n catalog or carry an explicit
 * `// i18n-allow` (or `// i18n-allow-next-line`) override comment.
 *
 * Design goals:
 *   1. Surgical: only flags raw JSX text. Comments, className strings, default
 *      prop values (`<Foo defaultValue="…" />`), attribute strings, JS
 *      template literals, and expressions are out of scope here — those are
 *      covered by `extract-i18n-keys.cjs`'s dynamic-key detection instead.
 *   2. Allow-list narrow but explicit. The hard-coded product/acronym list
 *      lives in this file so a translator/PM can curate it. New entries
 *      should be added only after review.
 *   3. Comma / period / colon / ellipsis etc. is stripped from the candidate
 *      before allow-list lookup so trailing punctuation doesn't create a
 *      false-fail (e.g. "Cancel" vs "Cancel.").
 *   4. Aggregated report lands in `artifacts/i18n/hardcoded-strings.json`
 *      (and `.md`). Verifier exits 1 only when a non-allowlisted candidate
 *      is found AND the `--strict` flag is passed. Default mode is advisory.
 *
 * Phase 4 of `MINIMAX-M3-I18N-FULL-APP-REMEDIATION-2026-07-26`.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts', 'i18n');

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'build',
  'coverage',
  '.git',
  'release',
  '__tests__',
  '__mocks__',
]);

const SCAN_EXTS = new Set(['.ts', '.tsx']);

/**
 * Curated hard-coded allowlist of values that are language-neutral by design.
 * Keep this list narrow. Anything user-translatable should route through
 * the i18n catalog instead of being added here.
 */
const HARD_CODED_ALLOWLIST = new Set([
  'Venice Forge',
  'Venice',
  'Venice.ai',
  'API',
  'JSON',
  'PNG',
  'JPEG',
  'WebP',
  'MP4',
  'TTS',
  'ST',
  'OS',
  'IDB',
  'SHA-256',
  'Argon2id',
  'XChaCha20-Poly1305',
  'LTR',
  'RTL',
  'GLM 5.2',
  'zai-org-glm-5-2',
  'Markdown',
  'YAML',
  'TOML',
  'UTF-8',
  'UTF-16',
  'CSV',
  'URI',
  'URL',
  'UUID',
  'OAuth',
  'OpenID',
  'WebCrypto',
  'did:key',
  'base64',
  'utf-8',
]);

/**
 * Strip trailing/leading punctuation that materially doesn't change the
 * translatable token. Allows "Cancel." and "Cancel" both be recognised as
 * the same candidate.
 */
function normalizeCandidate(raw) {
  return raw
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[…\.\!\?\,\:\;\-\—\(\)\[\]\{\}\"'`]+/, '')
    .replace(/[…\.\!\?\,\:\;\-\—\(\)\[\]\{\}\"'`]+$/, '')
    .trim();
}

/**
 * True only for string-shaped text that looks like user-visible prose.
 * Filters out numbers, single tokens like "v1", and tokens that are too
 * short to be translatable.
 */
function looksLikeVisibleText(text) {
  if (typeof text !== 'string') return false;
  const stripped = text.trim();
  if (stripped.length === 0) return false;
  if (stripped.length < 3) return false;
  // Must contain at least one ASCII letter or CJK ideograph — anything
  // shorter that is pure-symbol is not user-prose.
  if (!/[A-Za-z\u00C0-\u024F\u0400-\u04FF\u4E00-\u9FFF\u3040-\u309F\u30A0-\u30FF\uAC00-\uD7AF\u0900-\u097F]/.test(stripped)) {
    return false;
  }
  // Skip obvious comment / placeholder artifacts.
  if (/^(TODO|FIXME|XXX|HACK|NOTE)/i.test(stripped)) return false;
  if (/^\/\//.test(stripped)) return false;
  // File-system-style strings: contains '/', '\', or starts with 'src/' — not user prose.
  if (/[\\/]/.test(stripped)) return false;
  return true;
}

function findFiles(dir, out = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findFiles(full, out);
    } else if (SCAN_EXTS.has(path.extname(entry.name))) {
      out.push(full);
    }
  }
  return out;
}

/**
 * Look for `// i18n-allow` (same line as the JSXText) or
 * `// i18n-allow-next-line` (the comment directly above the JSXText's parent).
 * Comment text inspection is text-based — we do not parse the AST for
 * comments because TypeScript discards them by default.
 */
function isAllowMarked(sourceText, jsxTextStart) {
  // Backwards scan up to ~200 chars from the JSX start to find the closest
  // "i18n-allow" hint on the same line or the previous one.
  const slice = sourceText.slice(Math.max(0, jsxTextStart - 200), jsxTextStart);
  if (/i18n-allow[^a-z-]/i.test(slice)) return true;
  // Same line forward: also allow inline trailing comments.
  const lineEnd = sourceText.indexOf('\n', jsxTextStart);
  const sameLine = sourceText.slice(
    jsxTextStart,
    lineEnd === -1 ? jsxTextStart + 200 : lineEnd,
  );
  if (/i18n-allow/i.test(sameLine)) return true;
  return false;
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.ES2022,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX,
  );
  const relPath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/');
  const out = [];

  function visit(node) {
    if (ts.isJsxText(node)) {
      const raw = node.getText(sf);
      const norm = normalizeCandidate(raw);
      if (looksLikeVisibleText(norm)) {
        const start = node.getStart(sf);
        const { line } = sf.getLineAndCharacterOfPosition(start);
        const isAllow = isAllowMarked(source, start);
        if (!isAllow && !HARD_CODED_ALLOWLIST.has(norm)) {
          out.push({
            file: relPath,
            line: line + 1,
            text: norm,
            raw,
          });
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
  return out;
}

function runVerification({ strict = false } = {}) {
  const files = findFiles(SRC_DIR);
  const findings = [];
  for (const fp of files) {
    try {
      const f = scanFile(fp);
      findings.push(...f);
    } catch (err) {
      // Surface scan failures but do not crash the whole audit.
      const rel = path.relative(ROOT_DIR, fp).replace(/\\/g, '/');
      findings.push({
        file: rel,
        line: 0,
        text: `<scan-error: ${err.message}>`,
        raw: '',
        error: true,
      });
    }
  }

  // Compose report.
  const byFile = {};
  for (const f of findings) {
    byFile[f.file] = (byFile[f.file] || 0) + 1;
  }
  const report = {
    timestamp: new Date().toISOString(),
    schemaVersion: 1,
    extractor: 'typescript-compiler-api-jsx-text',
    strict,
    fileCount: files.length,
    findingsCount: findings.length,
    filesWithHardcoded: Object.keys(byFile).length,
    byFile,
    findings,
  };

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'hardcoded-strings.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  // Markdown rollup.
  let md = `# Hardcoded Visible-String Report\n\n`;
  md += `**Generated At:** ${report.timestamp}\n`;
  md += `**Extractor:** \`${report.extractor}\` (TS Compiler API; flags raw JSX text not covered by \`t()\`).\n`;
  md += `**Files Scanned:** ${report.fileCount}\n`;
  md += `**Hardcoded Candidates:** ${findings.length}\n`;
  md += `**Files With Candidates:** ${Object.keys(byFile).length}\n\n`;
  if (findings.length > 0) {
    md += `## Candidates by File\n\n`;
    md += `| File | Line | Text | Raw |\n| --- | --- | --- | --- |\n`;
    for (const f of findings.slice(0, 200)) {
      const safeText = f.text.replace(/\|/g, '\\|');
      md += `| \`${f.file}\` | ${f.line} | ${safeText} | _see source_ |\n`;
    }
    if (findings.length > 200) {
      md += `\n_…and ${findings.length - 200} more in the JSON report._\n`;
    }
  } else {
    md += `\nNo hardcoded visible text candidates detected.\n`;
  }
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'hardcoded-strings.md'),
    md,
    'utf8',
  );

  // Default: advisory exit 0; strict: exit 1 if any candidate found.
  if (strict && findings.length > 0) {
    process.stderr.write(
      `[verify:hardcoded-strings] ${findings.length} hardcoded candidate(s) detected; pass without --strict to suppress exit code.\n`,
    );
    process.exit(1);
  }
  process.stdout.write(
    `[verify:hardcoded-strings] ${findings.length} candidate(s) across ${Object.keys(byFile).length} file(s) (advisory; strict=${strict}).\n`,
  );
}

if (require.main === module) {
  const strict = process.argv.includes('--strict');
  runVerification({ strict });
}

module.exports = { runVerification, HARD_CODED_ALLOWLIST };
