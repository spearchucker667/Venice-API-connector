#!/usr/bin/env node

const fs = require("node:fs");
const path = require("node:path");

const ROADMAP_PATH = "docs/ROADMAP.md";
const EVIDENCE_PATH = "docs/audits/Records/Venice_Forge-audit-evidence-20260717-031029/EVIDENCE_MANIFEST.md";

function verifyCurrentRoadmap(rootDir) {
  const failures = [];
  const roadmapPath = path.join(rootDir, ROADMAP_PATH);
  const evidencePath = path.join(rootDir, EVIDENCE_PATH);
  const summaryPath = path.join(rootDir, "docs/summary_of_work.md");

  if (!fs.existsSync(roadmapPath)) {
    return [`Missing canonical current roadmap: ${ROADMAP_PATH}`];
  }
  if (!fs.existsSync(evidencePath)) {
    return [`Missing retained scan evidence: ${EVIDENCE_PATH}`];
  }

  const roadmap = fs.readFileSync(roadmapPath, "utf8");
  if (!roadmap.includes("current unfinished work only")) {
    failures.push("Roadmap must declare that it contains current unfinished work only.");
  }
  if (!roadmap.includes(EVIDENCE_PATH)) {
    failures.push(`Roadmap must cite ${EVIDENCE_PATH} as audit input.`);
  }
  if (/^## Recently Closed\s*$/m.test(roadmap)) {
    failures.push("Roadmap must not contain a Recently Closed history section.");
  }
  if (/^### \[x\]/im.test(roadmap)) {
    failures.push("Roadmap must not retain closed top-level task sections.");
  }
  if (/^- \*\*Status:\*\*\s*Closed\b/im.test(roadmap)) {
    failures.push("Roadmap must not retain historical closed status fields.");
  }

  // Denylist from summary_of_work.md
  if (fs.existsSync(summaryPath)) {
    const summary = fs.readFileSync(summaryPath, "utf8");
    const completedIds = new Set();
    const idRegex = /\b(P[0-9]-[0-9]{3}|CSP-[0-9]{3}|VF-(?:AUDIT|SCAN|THEME|RULES01|ELECTRON|USER|DEFERRED|SAFETY|PAID|EXHAUSTIVE|VENICE|CHARACTER|IMAGE|CHAT|MEDIA|PR|CONTEXT|DOC|CUSTOM|I18N|GOVERNANCE)-[A-Z0-9-]+)\b/g;

    const regex = /^### \d{4}-\d{2}-\d{2} — (.*)/gm;
    let match;
    while ((match = regex.exec(summary)) !== null) {
      if (match[1].match(/completion|completed|closed|remediated|fix/i)) {
        const ids = match[1].match(idRegex);
        if (ids) ids.forEach(id => completedIds.add(id));
      }
    }
    const todoLedgerMatch = summary.match(/## Open TODO Ledger[\s\S]*?(?=##|$)/);
    if (todoLedgerMatch) {
      const lines = todoLedgerMatch[0].split('\n');
      for (const line of lines) {
        if (line.includes('Completed') || line.includes('Closed')) {
          const ids = line.match(idRegex);
          if (ids) ids.forEach(id => completedIds.add(id));
        }
      }
    }
    
    // Also extract explicit (closed ...) markers directly from Roadmap to force cleanup of old style
    const inlineClosedMatch = Array.from(roadmap.matchAll(/^`([^`]+)`/gm));
    for (const m of inlineClosedMatch) {
      if (m[1].toLowerCase().includes('(closed') && !m[1].toLowerCase().includes('live admin follow-up open')) {
        const ids = m[1].match(idRegex);
        if (ids) ids.forEach(id => completedIds.add(id));
      }
    }
    
    const roadmapLines = roadmap.split('\n');
    for (const id of completedIds) {
      // Find if this ID is the subject of an entry
      for (let i = 0; i < roadmapLines.length; i++) {
        if (roadmapLines[i].startsWith('`' + id) || roadmapLines[i].startsWith(`\`${id} `)) {
          failures.push(`Roadmap must not contain completed item ${id}. Remove it or move to docs/summary_of_work.md`);
        }
      }
    }
  }

  const withoutTrancheIds = roadmap.replace(/VF-(?:AUDIT|SCAN)-[A-Za-z0-9-]+/g, "");
  const mirroredFindingIds = Array.from(withoutTrancheIds.matchAll(/\bAUDIT-\d{3}\b/g), (match) => match[0]);
  if (mirroredFindingIds.length > 0) {
    failures.push(`Roadmap must not mirror per-finding audit statuses: ${[...new Set(mirroredFindingIds)].join(", ")}.`);
  }

  return failures;
}

function main() {
  const failures = verifyCurrentRoadmap(process.cwd());
  if (failures.length > 0) {
    console.error("[verify:roadmap-current] FAIL");
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }
  console.log("[verify:roadmap-current] OK — the roadmap contains current work only and retained scan evidence remains input, not status authority.");
}

module.exports = { EVIDENCE_PATH, ROADMAP_PATH, verifyCurrentRoadmap };

if (require.main === module) main();
