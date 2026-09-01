#!/usr/bin/env node
/**
 * write-signature-evidence.cjs — write a per-platform signature evidence JSON
 * file for the release workflow. Called by each platform build job after
 * signature verification.
 *
 * Usage:
 *   node scripts/write-signature-evidence.cjs --platform macos --tag v1.2.3
 *   node scripts/write-signature-evidence.cjs --platform windows --tag v1.2.3 --unsigned
 *   node scripts/write-signature-evidence.cjs --platform linux --tag v1.2.3
 *
 * No secrets or raw command output are written.
 */
const fs = require("node:fs");
const path = require("node:path");

const ALLOWED_PLATFORMS = new Set(["macos", "windows", "linux"]);

function parseArgs(args) {
  const platformIdx = args.indexOf("--platform");
  const tagIdx = args.indexOf("--tag");
  const platform = platformIdx !== -1 ? args[platformIdx + 1] : undefined;
  const tag = tagIdx !== -1 ? args[tagIdx + 1] : undefined;
  const unsigned = args.includes("--unsigned");
  return { platform, tag, unsigned };
}

function buildEvidence(platform, tag, unsigned) {
  if (!ALLOWED_PLATFORMS.has(platform)) {
    throw new Error(`Unknown platform: ${platform}`);
  }

  const timestamp = new Date().toISOString();

  if (platform === "macos") {
    return {
      platform: "macos",
      status: unsigned ? "unsigned-exception" : "signed-and-notarized",
      signed: !unsigned,
      notarized: !unsigned,
      ...(unsigned ? { note: "RELEASE_ALLOW_UNSIGNED=true; deliberately unsigned draft" } : {}),
      tag,
      timestamp,
    };
  }

  if (platform === "windows") {
    return {
      platform: "windows",
      status: unsigned ? "unsigned-exception" : "signed",
      signed: !unsigned,
      signatureStatus: unsigned ? "N/A" : "Valid",
      ...(unsigned ? { note: "RELEASE_ALLOW_UNSIGNED=true; deliberately unsigned draft" } : {}),
      tag,
      timestamp,
    };
  }

  // linux
  return {
    platform: "linux",
    status: "no-code-signing",
    signed: false,
    note: "Linux packages are not code-signed",
    tag,
    timestamp,
  };
}

function main() {
  const { platform, tag, unsigned } = parseArgs(process.argv);
  if (!platform || !tag) {
    console.error(
      "Usage: node write-signature-evidence.cjs --platform <macos|windows|linux> --tag <tag> [--unsigned]",
    );
    process.exit(1);
  }

  const evidence = buildEvidence(platform, tag, unsigned);
  fs.mkdirSync("release-evidence", { recursive: true });
  const outPath = path.join("release-evidence", `signatures-${platform}.json`);
  fs.writeFileSync(outPath, JSON.stringify(evidence, null, 2) + "\n");
  console.log(`[write-signature-evidence] Wrote ${outPath}`);
}

module.exports = { ALLOWED_PLATFORMS, parseArgs, buildEvidence };

if (require.main === module) main();
