#!/usr/bin/env node
/**
 * @fileoverview VF-AUD-20260831-P3-012 — Create a metadata-free ZIP archive.
 *
 * macOS Finder's "Compress" produces archives that include a parallel
 * `__MACOSX/` directory full of AppleDouble (`._*`) metadata files. These
 * files are not part of the repository source and only add noise to
 * audit/hand-off bundles. Generic archive scanners can also be confused
 * by them.
 *
 * This script creates a ZIP that excludes every `__MACOSX/` entry and
 * every `._*` file, so an audit ZIP carries only the live repository
 * tree. The output filename and source root are configurable.
 *
 * Usage:
 *   node scripts/create-clean-zip.cjs --source <root> --output <file>
 *   node scripts/create-clean-zip.cjs                     # uses sensible defaults
 *
 * Defaults:
 *   --source  the current working directory
 *   --output  ./<basename>-<timestamp>.zip
 *
 * Implementation notes:
 *   - Uses the platform `zip` binary so the output is identical to what
 *     `unzip` would emit on the same platform. The script refuses to run
 *     if `zip` is not on PATH.
 *   - `-X` strips extra metadata; `--no-mac-files` skips the `._*` and
 *     `__MACOSX/` entries Finder would otherwise embed.
 *   - Hidden VCS directories (.git, .github) and node_modules are
 *     excluded by default to keep the archive small. Pass
 *     `--include-vcs` or `--include-node-modules` to override.
 */

"use strict";

const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const args = {
    source: process.cwd(),
    output: "",
    includeVcs: false,
    includeNodeModules: false,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const flag = argv[i];
    switch (flag) {
      case "--source":
        args.source = path.resolve(argv[++i] || ".");
        break;
      case "--output":
        args.output = path.resolve(argv[++i] || "");
        break;
      case "--include-vcs":
        args.includeVcs = true;
        break;
      case "--include-node-modules":
        args.includeNodeModules = true;
        break;
      case "-h":
      case "--help":
        printHelp();
        process.exit(0);
        break;
      default:
        console.error(`[create-clean-zip] Unknown flag: ${flag}`);
        printHelp();
        process.exit(2);
    }
  }
  return args;
}

function printHelp() {
  console.log(`Usage: node scripts/create-clean-zip.cjs [--source <root>] [--output <file>]

Options:
  --source <root>                Directory to archive (default: cwd)
  --output <file>                Output .zip path (default: ./<root>-<ts>.zip)
  --include-vcs                  Include .git and .github (excluded by default)
  --include-node-modules         Include node_modules (excluded by default)
  -h, --help                     Show this help`);
}

function ensureZipAvailable() {
  const probe = spawnSync("zip", ["--version"], { encoding: "utf-8" });
  if (probe.status !== 0) {
    console.error("[create-clean-zip] 'zip' is not on PATH. Install it (apt: zip, brew: zip, apk: zip) and retry.");
    process.exit(2);
  }
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  ensureZipAvailable();

  if (!fs.existsSync(args.source) || !fs.statSync(args.source).isDirectory()) {
    console.error(`[create-clean-zip] Source is not a directory: ${args.source}`);
    process.exit(2);
  }

  const sourceName = path.basename(args.source) || "archive";
  const outputPath = args.output || path.join(process.cwd(), `${sourceName}-${timestamp()}.zip`);

  // Build zip arguments:
  //   -X            strip extra metadata
  //   -r            recurse into directories
  //   -q            suppress per-file output
  // The macOS-specific --no-mac-files flag is not portable; instead we
  // explicitly exclude __MACOSX/ and every ._* AppleDouble file via -x
  // patterns. This works on Info-ZIP zip across macOS, Linux, and BSD.
  const zipArgs = ["-X", "-r", "-q", outputPath, "."];
  if (!args.includeVcs) {
    zipArgs.push("-x", ".git/*", ".github/*");
  }
  if (!args.includeNodeModules) {
    zipArgs.push("-x", "node_modules/*", "**/node_modules/*");
  }
  zipArgs.push(
    "-x", "__MACOSX/*",
    "-x", "__MACOSX/**",
    "-x", "**/__MACOSX/*",
    "-x", "**/__MACOSX/**",
    "-x", "._*",
    "-x", "**/._*",
  );

  const result = spawnSync("zip", zipArgs, {
    cwd: args.source,
    encoding: "utf-8",
    stdio: "inherit",
  });

  if (result.status !== 0) {
    console.error(`[create-clean-zip] zip exited with status ${result.status}`);
    process.exit(result.status || 1);
  }

  const stat = fs.statSync(outputPath);
  console.log(`[create-clean-zip] Wrote ${outputPath} (${stat.size} bytes)`);
  console.log(`[create-clean-zip] Excluded: __MACOSX/, ._*, .git/, .github/, node_modules/ (overridable via flags)`);
}

main();
