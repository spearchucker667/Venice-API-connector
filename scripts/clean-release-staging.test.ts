// @vitest-environment node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  ALLOWLIST,
  FILE_ALLOWLIST,
  cleanReleaseStaging,
  validateReleaseDir,
  isWithin,
  parseArgs,
} = require("./clean-release-staging.cjs") as {
  ALLOWLIST: string[];
  FILE_ALLOWLIST: string[];
  cleanReleaseStaging(options?: { releaseDir?: string | null }): { removed: string[]; skipped: { dirName: string; reason: string }[] };
  validateReleaseDir(releaseDir: string | null | undefined, cwd: string): string;
  isWithin(parent: string, child: string): boolean;
  parseArgs(argv: string[]): { releaseDir: string | null };
};

const roots: string[] = [];

function makeTempRoot(prefix: string): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  roots.push(root);
  return root;
}

function makeReleaseDir(root: string): string {
  const releaseDir = path.join(root, "release");
  fs.mkdirSync(releaseDir, { recursive: true });
  return releaseDir;
}

afterEach(() => {
  for (const root of roots.splice(0)) {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

describe("clean-release-staging allowlist", () => {
  it("contains the expected electron-builder staging directories", () => {
    expect(ALLOWLIST).toEqual([
      "mac",
      "mac-x64",
      "mac-arm64",
      "win-unpacked",
      "linux-unpacked",
      "linux-arm64-unpacked",
    ]);
  });
  
  it("contains the expected files", () => {
    expect(FILE_ALLOWLIST).toEqual([
      "builder-debug.yml",
      "builder-debug.yml.sha256",
    ]);
  });
});

describe("clean-release-staging path safety", () => {
  it("rejects the filesystem root", () => {
    const root = path.parse(process.cwd()).root;
    expect(() => validateReleaseDir(root, process.cwd())).toThrow("filesystem root");
  });

  it("rejects the repository root", () => {
    const cwd = process.cwd();
    expect(() => validateReleaseDir(cwd, cwd)).toThrow("repository root");
  });

  it("rejects a directory not named release", () => {
    const root = makeTempRoot("vf-clean-");
    const badDir = path.join(root, "not-release");
    fs.mkdirSync(badDir, { recursive: true });
    expect(() => validateReleaseDir(badDir, root)).toThrow("named 'release'");
  });

  it("defaults to release/ under cwd when no directory is given", () => {
    const cwd = process.cwd();
    expect(validateReleaseDir(null, cwd)).toBe(path.join(cwd, "release"));
    expect(validateReleaseDir(undefined, cwd)).toBe(path.join(cwd, "release"));
  });

  it("isWithin returns false for identical or escaping paths", () => {
    const parent = "/foo/bar";
    expect(isWithin(parent, "/foo/bar")).toBe(false);
    expect(isWithin(parent, "/foo/bar/../baz")).toBe(false);
    expect(isWithin(parent, "/foo/baz")).toBe(false);
    expect(isWithin(parent, "/foo/bar/baz")).toBe(true);
  });
});

describe("clean-release-staging removal behavior", () => {
  it("removes allowed staging directories and files while preserving final artifacts", () => {
    const root = makeTempRoot("vf-clean-rm-");
    const releaseDir = makeReleaseDir(root);

    fs.mkdirSync(path.join(releaseDir, "mac-arm64"), { recursive: true });
    fs.mkdirSync(path.join(releaseDir, "linux-unpacked"), { recursive: true });
    fs.writeFileSync(path.join(releaseDir, "Venice-Forge-3.0.0-beta.2-arm64.dmg"), "dmg");
    fs.writeFileSync(path.join(releaseDir, "latest-mac.yml"), "yaml");
    fs.writeFileSync(path.join(releaseDir, "builder-debug.yml"), "debug stuff");
    fs.writeFileSync(path.join(releaseDir, "builder-debug.yml.sha256"), "debug checksum");

    const result = cleanReleaseStaging({ releaseDir });

    expect(result.removed.sort()).toEqual(["builder-debug.yml", "builder-debug.yml.sha256", "linux-unpacked", "mac-arm64"]);
    expect(result.skipped).toEqual([]);
    expect(fs.existsSync(path.join(releaseDir, "mac-arm64"))).toBe(false);
    expect(fs.existsSync(path.join(releaseDir, "linux-unpacked"))).toBe(false);
    expect(fs.existsSync(path.join(releaseDir, "builder-debug.yml"))).toBe(false);
    expect(fs.existsSync(path.join(releaseDir, "builder-debug.yml.sha256"))).toBe(false);
    expect(fs.existsSync(path.join(releaseDir, "Venice-Forge-3.0.0-beta.2-arm64.dmg"))).toBe(true);
    expect(fs.existsSync(path.join(releaseDir, "latest-mac.yml"))).toBe(true);
  });

  it("is idempotent when no staging directories exist", () => {
    const root = makeTempRoot("vf-clean-idem-");
    const releaseDir = makeReleaseDir(root);
    fs.writeFileSync(path.join(releaseDir, "artifact.zip"), "zip");

    const first = cleanReleaseStaging({ releaseDir });
    const second = cleanReleaseStaging({ releaseDir });

    expect(first.removed).toEqual([]);
    expect(second.removed).toEqual([]);
    expect(fs.existsSync(path.join(releaseDir, "artifact.zip"))).toBe(true);
  });

  it("skips non-directory entries with matching names", () => {
    const root = makeTempRoot("vf-clean-file-");
    const releaseDir = makeReleaseDir(root);
    fs.writeFileSync(path.join(releaseDir, "mac-arm64"), "not a directory");

    const result = cleanReleaseStaging({ releaseDir });

    expect(result.removed).toEqual([]);
    expect(result.skipped).toEqual([{ dirName: "mac-arm64", reason: "not a directory" }]);
    expect(fs.existsSync(path.join(releaseDir, "mac-arm64"))).toBe(true);
  });

  it("skips directories outside the allowlist", () => {
    const root = makeTempRoot("vf-clean-allow-");
    const releaseDir = makeReleaseDir(root);
    fs.mkdirSync(path.join(releaseDir, "some-other-dir"), { recursive: true });

    const result = cleanReleaseStaging({ releaseDir });

    expect(result.removed).toEqual([]);
    expect(fs.existsSync(path.join(releaseDir, "some-other-dir"))).toBe(true);
  });
});

describe("clean-release-staging CLI argument parsing", () => {
  it("parses --release-dir", () => {
    const args = ["node", "script", "--release-dir", "/foo/bar/release"];
    expect(parseArgs(args)).toEqual({ releaseDir: "/foo/bar/release" });
  });

  it("defaults releaseDir to null when not provided", () => {
    expect(parseArgs(["node", "script"])).toEqual({ releaseDir: null });
  });

  it("throws when --release-dir has no value", () => {
    expect(() => parseArgs(["node", "script", "--release-dir"])).toThrow("requires a path argument");
  });
});
