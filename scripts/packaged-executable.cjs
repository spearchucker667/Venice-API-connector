"use strict";

const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

function findPackagedExecutable(
  root,
  platform = os.platform(),
  architecture = os.arch(),
) {
  const releaseDir = path.join(root, "release");

  if (platform === "win32") {
    const unpacked = path.join(releaseDir, "win-unpacked");
    if (!fs.existsSync(unpacked)) return undefined;
    const pkg = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
    const productName = typeof pkg.productName === "string" ? pkg.productName.trim() : "";
    if (!productName) return undefined;
    const executable = path.join(unpacked, `${productName}.exe`);
    return fs.existsSync(executable) ? executable : undefined;
  }

  if (platform === "darwin") {
    const architectureDirectories =
      architecture === "arm64" ? ["mac-arm64", "mac"] : ["mac", "mac-arm64"];
    const searchDirectories = [
      ...architectureDirectories.map((directory) => path.join(releaseDir, directory)),
      releaseDir,
    ];

    const findExecutableInBundle = (directory) => {
      if (!fs.existsSync(directory)) return undefined;
      for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        const entryPath = path.join(directory, entry.name);
        if (entry.name.endsWith(".app")) {
          const executableDirectory = path.join(entryPath, "Contents", "MacOS");
          if (!fs.existsSync(executableDirectory)) continue;
          const candidates = fs
            .readdirSync(executableDirectory, { withFileTypes: true })
            .filter((candidate) => candidate.isFile());
          if (candidates.length === 1) {
            return path.join(executableDirectory, candidates[0].name);
          }
          continue;
        }
        const nestedExecutable = findExecutableInBundle(entryPath);
        if (nestedExecutable) return nestedExecutable;
      }
      return undefined;
    };

    for (const directory of searchDirectories) {
      const executable = findExecutableInBundle(directory);
      if (executable) return executable;
    }
    return undefined;
  }

  if (platform === "linux") {
    const unpackedDirectories =
      architecture === "arm64"
        ? ["linux-arm64-unpacked", "linux-unpacked"]
        : ["linux-unpacked", "linux-arm64-unpacked"];
    for (const directory of unpackedDirectories) {
      const executable = path.join(releaseDir, directory, "venice-forge");
      if (fs.existsSync(executable)) return executable;
    }
  }

  return undefined;
}

module.exports = { findPackagedExecutable };
