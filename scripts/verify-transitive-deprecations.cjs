#!/usr/bin/env node
/**
 * @fileoverview VF-AUD-20260831-P3-006 — Transitive deprecation tracker.
 *
 * npm has a long tail of deprecated transitive packages (e.g. inflight,
 * glob@7, lodash.isequal, boolean). These are not security vulnerabilities
 * and the upstream packages we depend on cannot remove them without breaking
 * their own dependency graph. A forced `overrides` block in package.json
 * can also violate electron-builder / electron-updater expectations.
 *
 * This script scans the package-lock.json for entries with a non-empty
 * `deprecated` field and reports them. It exits non-zero when a NEW
 * deprecation appears outside the allowlist and emits a warning (exit 0)
 * for allowlisted entries. To add a new transitive deprecation to the
 * allowlist, append it to KNOWN_DEPRECATIONS below with a one-line rationale.
 *
 * Usage:
 *   node scripts/verify-transitive-deprecations.cjs
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");

/** Transitive packages currently present in the lockfile that we have no
 *  authority to upgrade directly. Each entry MUST include a rationale
 *  for why a forced override would be unsafe. */
const KNOWN_DEPRECATIONS = new Set([
  "inflight@1.0.6",        // transitive from glob@7 → rimraf → many electron-builder deps
  "glob@7",                // transitive from rimraf@2, electron-rebuild, node-gyp
  "glob@7.2.3",            // exact pin from rimraf@2
  "lodash.isequal@4",      // transitive from react/react-dom test fixture chains
  "lodash.isequal@4.5.0",  // exact pin
  "boolean@3",             // transitive from env-paths → global-agent → node-fetch
  "boolean@3.2.0",         // exact pin
  "rimraf@2",              // transitive from electron-builder / @electron/rebuild
  "rimraf@2.6.3",          // exact pin (via temp/node_modules)
  "glob@8",                // deprecated in favor of glob@10; transitive from several dev tools
  "inflight@1",            // alias of inflight@1.0.6
  "lodash.get@4",          // transitive from several test fixtures
]);

const ROOT = process.cwd();
const LOCKFILE = path.join(ROOT, "package-lock.json");

function main() {
  if (!fs.existsSync(LOCKFILE)) {
    console.error(`[verify-transitive-deprecations] No lockfile at ${LOCKFILE}; run \`npm install\` first.`);
    process.exit(2);
  }

  let lock;
  try {
    lock = JSON.parse(fs.readFileSync(LOCKFILE, "utf-8"));
  } catch (err) {
    console.error(`[verify-transitive-deprecations] Failed to parse ${LOCKFILE}: ${err.message}`);
    process.exit(2);
  }

  const packages = (lock && lock.packages) || {};
  const problems = [];
  for (const [installPath, info] of Object.entries(packages)) {
    if (!info || !info.deprecated) continue;
    if (!installPath) continue; // skip the root entry
    problems.push({
      path: installPath,
      name: deriveName(installPath, info),
      version: info.version || "?",
      reason: typeof info.deprecated === "string" ? info.deprecated : "(deprecated)",
    });
  }

  if (problems.length === 0) {
    console.log("[verify-transitive-deprecations] No deprecated transitive packages detected.");
    return;
  }

  const novel = [];
  const known = [];
  for (const p of problems) {
    const key = `${p.name}@${p.version}`;
    const matched = Array.from(KNOWN_DEPRECATIONS).some((allowed) => {
      if (allowed === key) return true;
      const at = allowed.lastIndexOf("@");
      if (at < 0) return false;
      const aName = allowed.slice(0, at);
      const aRange = allowed.slice(at + 1);
      if (aName !== p.name) return false;
      if (!aRange) return false;
      if (aRange.includes(".")) return allowed === key;
      return p.version && p.version.startsWith(`${aRange}.`);
    });
    if (matched) {
      known.push(p);
    } else {
      novel.push(p);
    }
  }

  for (const p of known) {
    console.log(`[verify-transitive-deprecations] known: ${p.path} (${p.name}@${p.version})`);
  }
  for (const p of novel) {
    console.log(`[verify-transitive-deprecations] NEW: ${p.path} (${p.name}@${p.version}) — ${p.reason}`);
  }

  if (novel.length > 0) {
    console.error(
      `[verify-transitive-deprecations] FAILED: ${novel.length} new deprecation(s) outside the allowlist. ` +
      `Prefer upstream upgrades over npm overrides that can violate electron-builder/electron-updater.`,
    );
    process.exit(1);
  }

  console.log(`[verify-transitive-deprecations] OK: ${known.length} known deprecation(s) within the allowlist.`);
}

function deriveName(installPath, info) {
  if (info.name) return info.name;
  // installPath looks like "node_modules/boolean" or "node_modules/temp/node_modules/rimraf".
  // The package name is the last segment after the final "node_modules/".
  const withoutPrefix = installPath.replace(/^node_modules\//, "");
  const parts = withoutPrefix.split("/node_modules/");
  const tail = parts[parts.length - 1];
  return tail || installPath;
}

main();

