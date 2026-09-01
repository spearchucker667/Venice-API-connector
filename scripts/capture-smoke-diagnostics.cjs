#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { findPackagedExecutable } = require("./packaged-executable.cjs");

function readArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    const key = argv[index];
    if (!["--platform", "--arch", "--output"].includes(key)) {
      throw new Error(`Unknown argument: ${key}`);
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${key}`);
    }
    result[key.slice(2)] = value;
    index += 1;
  }
  if (!result.platform || !result.arch || !result.output) {
    throw new Error("Usage: capture-smoke-diagnostics.cjs --platform <platform> --arch <arch> --output <file>");
  }
  if (!["darwin", "linux", "win32"].includes(result.platform)) {
    throw new Error(`Unsupported platform: ${result.platform}`);
  }
  return result;
}

function repositoryRelativeExecutable(root, executable) {
  if (!executable) return "(not found)";
  const relative = path.relative(root, executable);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return "(outside repository)";
  }
  return relative.split(path.sep).join("/");
}

function captureSmokeDiagnostics({ root, platform, architecture, outputPath, env = process.env }) {
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const executable = findPackagedExecutable(root, platform, architecture);
  const summary = {
    platform,
    arch: architecture,
    appVersion: pkg.version,
    commit: env.GITHUB_SHA || "(local)",
    runner: env.RUNNER_OS || process.platform,
    discoveredExecutable: repositoryRelativeExecutable(root, executable),
  };
  const resolvedOutput = path.resolve(root, outputPath);
  const relativeOutput = path.relative(root, resolvedOutput);
  if (!relativeOutput || relativeOutput.startsWith("..") || path.isAbsolute(relativeOutput)) {
    throw new Error("Diagnostic output must remain inside the repository workspace");
  }
  fs.mkdirSync(path.dirname(resolvedOutput), { recursive: true });
  fs.writeFileSync(resolvedOutput, `${JSON.stringify(summary, null, 2)}\n`, { mode: 0o600 });
  return summary;
}

if (require.main === module) {
  try {
    const args = readArguments(process.argv.slice(2));
    captureSmokeDiagnostics({
      root: process.cwd(),
      platform: args.platform,
      architecture: args.arch,
      outputPath: args.output,
    });
  } catch (error) {
    console.error(`[capture-smoke-diagnostics] ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  }
}

module.exports = {
  captureSmokeDiagnostics,
  readArguments,
  repositoryRelativeExecutable,
};
