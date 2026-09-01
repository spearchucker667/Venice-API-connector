#!/usr/bin/env node

/**
 * Remove electron-builder staging directories from release/ after packaging.
 *
 * These unpacked application bundles are required by packaged smoke tests but
 * must not be published as release artifacts. The script is intentionally
 * narrow: it only removes directory names on an explicit allowlist, refuses
 * any path that could escape the release directory, and is idempotent.
 *
 * Usage:
 *   node scripts/clean-release-staging.cjs
 *   node scripts/clean-release-staging.cjs --release-dir /path/to/release
 */

const fs = require("node:fs");
const path = require("node:path");

const ALLOWLIST = Object.freeze([
  "mac",
  "mac-x64",
  "mac-arm64",
  "win-unpacked",
  "linux-unpacked",
  "linux-arm64-unpacked",
]);

const FILE_ALLOWLIST = Object.freeze([
  "builder-debug.yml",
  "builder-debug.yml.sha256",
]);

function parseArgs(argv) {
  const args = argv.slice(2);
  let releaseDir = null;
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--release-dir") {
      if (i + 1 >= args.length) {
        throw new Error("--release-dir requires a path argument");
      }
      releaseDir = args[i + 1];
      i += 1;
    }
  }
  return { releaseDir };
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  if (relative === "") return false; // same directory
  if (relative.startsWith("..")) return false;
  return !path.isAbsolute(relative);
}

function validateReleaseDir(releaseDir, cwd) {
  if (!releaseDir) {
    return path.resolve(cwd, "release");
  }

  const resolved = path.resolve(releaseDir);
  const fsRoot = path.parse(resolved).root;

  if (resolved === fsRoot) {
    throw new Error(`Refusing to use filesystem root as release directory: ${resolved}`);
  }

  if (resolved === cwd) {
    throw new Error(`Refusing to use repository root as release directory: ${resolved}`);
  }

  if (path.basename(resolved) !== "release") {
    throw new Error(`Release directory must be named 'release', got: ${resolved}`);
  }

  return resolved;
}

function cleanReleaseStaging(options = {}) {
  const cwd = process.cwd();
  const releaseDir = validateReleaseDir(options.releaseDir, cwd);

  if (!fs.existsSync(releaseDir)) {
    console.log(`[clean-release-staging] Release directory does not exist, nothing to clean: ${releaseDir}`);
    return { removed: [], skipped: [] };
  }

  const removed = [];
  const skipped = [];

  for (const dirName of ALLOWLIST) {
    const fullPath = path.join(releaseDir, dirName);

    // Path-safety: target must be strictly inside the release directory.
    if (!isWithin(releaseDir, fullPath)) {
      skipped.push({ dirName, reason: "path escapes release directory" });
      continue;
    }

    // Refuse to act on anything that is not a directory (e.g. a symlink or file).
    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch {
      // Does not exist — idempotent no-op for this entry.
      continue;
    }

    if (!stat.isDirectory()) {
      skipped.push({ dirName, reason: "not a directory" });
      continue;
    }

    fs.rmSync(fullPath, { recursive: true, force: true });
    removed.push(dirName);
    console.log(`[clean-release-staging] Removed ${path.relative(cwd, fullPath)}/`);
  }

  for (const fileName of FILE_ALLOWLIST) {
    const fullPath = path.join(releaseDir, fileName);

    if (!isWithin(releaseDir, fullPath)) {
      skipped.push({ dirName: fileName, reason: "path escapes release directory" });
      continue;
    }

    let stat;
    try {
      stat = fs.lstatSync(fullPath);
    } catch {
      continue;
    }

    if (!stat.isFile()) {
      skipped.push({ dirName: fileName, reason: "not a file" });
      continue;
    }

    fs.rmSync(fullPath, { force: true });
    removed.push(fileName);
    console.log(`[clean-release-staging] Removed file ${path.relative(cwd, fullPath)}`);
  }

  if (removed.length === 0) {
    console.log("[clean-release-staging] No staging directories or files present.");
  }

  return { removed, skipped };
}

function main() {
  try {
    const { releaseDir } = parseArgs(process.argv);
    cleanReleaseStaging({ releaseDir });
    process.exit(0);
  } catch (err) {
    console.error(`[clean-release-staging] ERROR: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  ALLOWLIST,
  FILE_ALLOWLIST,
  cleanReleaseStaging,
  validateReleaseDir,
  isWithin,
  parseArgs,
};

if (require.main === module) {
  main();
}
