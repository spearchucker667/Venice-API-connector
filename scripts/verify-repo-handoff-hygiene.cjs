#!/usr/bin/env node

/**
 * Repository handoff/audit hygiene guard.
 *
 * Locks three repo-governance invariants:
 * - current bug-hunt prompt is canonical and zip-aware;
 * - stale audit reports do not live at the repository root;
 * - VERIFY IDs stay in the documented namespace: VERIFY-001..VERIFY-158 plus
 *   the intentional legacy T-168 bridge id VERIFY-168.
 *
 * Updated 2026-07-27: extended namespace to VERIFY-001..VERIFY-158 for the
 * Phase C inspector-telemetry emitter regression-coverage (VERIFY-156 = agent
 * tool executor; VERIFY-157 = chat agent runner; VERIFY-158 = main-video
 * retrieve) layered on top of the custom-protocol CORS regression (VERIFY-155).
 * The prior 2026-07-18 extension to VERIFY-154 covered
 * the Document Agent attachment-promotion surface (VERIFY-154) layered on
 * top of the security foundation (VERIFY-145..153).
 * The prior 2026-07-16 extension to VERIFY-138 covered
 * the P0 #1–#6 sync/import integrity remediation (VERIFY-132..137) alongside
 * the prior VERIFY-001..VERIFY-131 active sequence. VERIFY-128..131 closed the
 * P1 phase; VERIFY-132..137 close the P0 phase of the 3.0 beta audit.
 */

const fs = require("fs");
const path = require("path");

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function read(relativePath) {
  const full = path.join(root, relativePath);
  if (!fs.existsSync(full)) {
    fail(`Missing required file: ${relativePath}`);
    return "";
  }
  return fs.readFileSync(full, "utf8");
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git" || entry.name === ".superpowers" || entry.name === "node_modules" || entry.name === "dist" || entry.name === "dist-electron" || entry.name === "release" || entry.name === "coverage") {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// BUG_HUNTING_AGENT_PROMPT.md removed in 2026-08-22 hygiene pass.
// The file was an operational agent prompt, not end-user documentation.
// If reactivated, place it in docs/agent-prompts/ and update this verifier.
const bugHuntPromptPath = "docs/BUG_HUNTING_AGENT_PROMPT.md";
if (fs.existsSync(bugHuntPromptPath)) {
  const prompt = read(bugHuntPromptPath);
  for (const required of [
    "Security, Storage, and Release Audit Agent",
    "Repository Source Selection",
    "LEAD-018",
  ]) {
    if (!prompt.includes(required)) {
      fail(`docs/BUG_HUNTING_AGENT_PROMPT.md is missing required marker: ${required}`);
    }
  }
}

const reportsReadme = read("docs/reports/historical/README.md");
if (!reportsReadme.includes("docs/reports/historical/") || !reportsReadme.includes("Do not add audit reports at the repository root")) {
  fail("docs/reports/historical/README.md must explain historical reports and root-report prohibition.");
}

const rootReportPatterns = [
  /^AUDIT-.*\.md$/i,
  /^VALIDATION_REPORT.*\.md$/i,
  /^audit_report\.ya?ml$/i,
  /^audit-validation-report-.*\.md$/i,
  /^first-prompt.*\.txt$/i,
  /^extract\.py$/i,
  /^fix_.*\.py$/i,
  /^get_p.*\.py$/i,
  /^get_rest\.py$/i,
  /^patch_.*\.py$/i,
  /^update_summary\.py$/i,
  /^.*work.*done.*\.md$/i,
  /^.*session.*\.json$/i,
];
for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
  if (entry.isFile() && rootReportPatterns.some((pattern) => pattern.test(entry.name))) {
    fail(`Root-level audit artifact is not allowed: ${entry.name}`);
  }
}

const agents = read("AGENTS.md");
if (!agents.includes("VERIFY-168") || !agents.includes("intentional legacy")) {
  fail("AGENTS.md must document VERIFY-168 as an intentional legacy/allowlisted VERIFY id.");
}

const allowedVerifyIds = new Set(["VERIFY-168"]);
for (let id = 1; id <= 158; id += 1) {
  allowedVerifyIds.add(`VERIFY-${String(id).padStart(3, "0")}`);
}

const verifyIds = new Map();
for (const full of walk(root)) {
  const rel = path.relative(root, full).split(path.sep).join("/");
  if (/\.(png|jpg|jpeg|webp|gif|ico|icns|pdf|zip|dmg|exe)$/i.test(rel)) continue;
  let content;
  try {
    content = fs.readFileSync(full, "utf8");
  } catch {
    continue;
  }
  for (const match of content.matchAll(/VERIFY-[0-9]{3}/g)) {
    const id = match[0];
    if (!verifyIds.has(id)) verifyIds.set(id, new Set());
    verifyIds.get(id).add(rel);
  }
  
  // Hygiene: check for absolute local paths or agent directories in source code
  if (!rel.startsWith("scripts/verify-repo-handoff-hygiene.cjs") && !rel.startsWith("scripts/verify-archive-clean.cjs")) {
    if (content.includes("/.gemini/antigravity/brain/") || content.includes("\\.gemini\\antigravity\\brain\\")) {
      fail(`File contains forbidden AI-agent workspace paths: ${rel}`);
    }
  }
}

for (const [id, files] of verifyIds) {
  if (!allowedVerifyIds.has(id)) {
    fail(`Unexpected ${id} in ${Array.from(files).sort().join(", ")}`);
  }
}

if (failures.length > 0) {
  console.error("[verify:repo-handoff-hygiene] FAIL");
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("[verify:repo-handoff-hygiene] OK");
