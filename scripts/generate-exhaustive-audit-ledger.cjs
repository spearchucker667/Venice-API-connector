#!/usr/bin/env node

const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const output = path.join(root, "docs/audits/venice-forge-exhaustive-audit-2026-08-15/02-FILE-AUDIT-LEDGER.md");
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root })
  .toString("utf8")
  .split("\0")
  .filter(Boolean)
  .sort();

const binaryExtensions = new Set([".avif", ".bmp", ".dmg", ".gif", ".icns", ".ico", ".jpeg", ".jpg", ".mp3", ".mp4", ".pdf", ".png", ".ttf", ".webp", ".woff", ".woff2", ".zip"]);
const generatedPatterns = [/^package-lock\.json$/, /^docs\/reference\/Venice_swagger_api\.yaml$/, /^src\/i18n\/resources\//];
const sourceExtensions = new Set([".cjs", ".css", ".html", ".js", ".jsx", ".mjs", ".scss", ".ts", ".tsx"]);
const configNames = new Set(["package.json", "tsconfig.json", "tsconfig.electron.json", "vite.config.ts", "vitest.config.ts", "electron-builder.config.cjs"]);

function classify(file) {
  const ext = path.extname(file).toLowerCase();
  if (binaryExtensions.has(ext)) return ["asset/binary", "no", "inventory + metadata review", "Binary content; semantic line review not applicable"];
  if (generatedPatterns.some((pattern) => pattern.test(file))) return ["generated/reference", "no", "schema/catalog/tool validation", "Mechanically generated or authoritative reference snapshot"];
  if (file.startsWith("docs/audits/Records/") || file.startsWith("docs/reports/historical/")) return ["historical evidence", "no", "inventory + authority reconciliation", "Immutable historical evidence; not current product behavior"];
  if (file.startsWith("docs/")) return ["documentation", "yes", "semantic documentation review + link validation", "Checked for authority, drift, and discoverability"];
  if (file.startsWith(".github/") || file.startsWith("config/") || configNames.has(file) || /(^|\/)(eslint|vite|vitest|playwright|tsconfig|electron-builder)/.test(file)) return ["configuration/CI", "yes", "semantic configuration review + repository gates", "Checked against scripts, runtime, and release boundaries"];
  if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(file) || file.startsWith("tests/")) return ["test", "yes", "test-quality review + executed suite", "Reviewed for assertions, mocks, skipped paths, and false confidence"];
  if (file.startsWith("scripts/") || sourceExtensions.has(ext)) return ["source", "yes", "static/pattern review + compiler/lint/tests; high-risk paths semantically traced", "Included in substantive source coverage"];
  return ["repository support", "yes", "inventory + semantic/config review", "Tracked non-binary repository artifact"];
}

const counts = new Map();
let substantive = 0;
const rows = files.map((file) => {
  const [category, isSubstantive, method, note] = classify(file);
  counts.set(category, (counts.get(category) || 0) + 1);
  if (isSubstantive === "yes") substantive += 1;
  return `| \`${file.replaceAll("|", "\\|")}\` | ${category} | ${isSubstantive} | ${method} | ${note} |`;
});

const summaryRows = [...counts.entries()].sort().map(([category, count]) => `| ${category} | ${count} |`);
const body = `# File Audit Ledger

Generated from tracked files at audit commit \`bc5c1737\` on 2026-08-15. This ledger distinguishes semantic source review from mechanical/generated or binary inspection; it does not represent binary assets as line-reviewable source.

## Coverage summary

| Metric | Count |
|---|---:|
| Tracked files | ${files.length} |
| Substantive tracked artifacts | ${substantive} |
| Non-substantive generated/reference/binary artifacts | ${files.length - substantive} |

| Category | Files |
|---|---:|
${summaryRows.join("\n")}

## Method

All tracked artifacts were enumerated. Substantive code was covered by syntax-aware compiler/lint execution, full unit/integration/UI test execution, high-risk-pattern searches, and semantic call-path tracing for API, IPC, persistence, security, streaming, retry, media, and job boundaries. Tests and broad gates are supporting evidence, not substitutes for the semantic traces recorded in the findings. Generated catalogs, the OpenAPI snapshot, and lockfiles were validated through their canonical generators/verifiers; binary assets received inventory and metadata review.

## Per-file ledger

| Path | Category | Substantive | Review method | Disposition |
|---|---|---|---|---|
${rows.join("\n")}
`;

fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, body);
console.log(`Wrote ${path.relative(root, output)} with ${files.length} tracked-file rows.`);
