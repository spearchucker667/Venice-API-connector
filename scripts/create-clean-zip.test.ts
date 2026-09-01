import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("create-clean-zip (VF-AUD-20260831-P3-012)", () => {
  let workDir: string;
  let zipPath: string;

  beforeEach(() => {
    workDir = fs.mkdtempSync(path.join(os.tmpdir(), "vf-clean-zip-"));
    // Create a representative tree that includes the patterns we want to
    // exclude in production: a .git/ directory, node_modules, and
    // AppleDouble-style ._* files.
    fs.writeFileSync(path.join(workDir, "hello.txt"), "hello world");
    fs.mkdirSync(path.join(workDir, "subdir"));
    fs.writeFileSync(path.join(workDir, "subdir", "world.txt"), "sub world");
    fs.mkdirSync(path.join(workDir, ".git"));
    fs.writeFileSync(path.join(workDir, ".git", "HEAD"), "ref: refs/heads/main");
    fs.mkdirSync(path.join(workDir, "node_modules", "fake-pkg"), { recursive: true });
    fs.writeFileSync(path.join(workDir, "node_modules", "fake-pkg", "index.js"), "module.exports = 1");
    fs.mkdirSync(path.join(workDir, "__MACOSX"));
    fs.writeFileSync(path.join(workDir, "__MACOSX", "._hello.txt"), "macos metadata");
    fs.writeFileSync(path.join(workDir, "._hello.txt"), "macos metadata sibling");
    zipPath = path.join(workDir, "out.zip");
  });

  afterEach(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
  });

  it("creates a zip that excludes __MACOSX, ._*, .git, and node_modules", () => {
    execFileSync(
      "node",
      [path.join(process.cwd(), "scripts", "create-clean-zip.cjs"), "--source", workDir, "--output", zipPath],
      { encoding: "utf-8", stdio: "pipe" },
    );
    expect(fs.existsSync(zipPath)).toBe(true);

    const listing = execFileSync("unzip", ["-l", zipPath], { encoding: "utf-8" });
    const entries = listing
      .split("\n")
      .map((line) => line.trim().split(/\s+/).pop() ?? "")
      .filter(Boolean);

    expect(entries).toContain("hello.txt");
    expect(entries).toContain("subdir/world.txt");
    expect(entries).not.toContain("__MACOSX/");
    expect(entries).not.toContain("__MACOSX/._hello.txt");
    expect(entries).not.toContain("._hello.txt");
    expect(entries).not.toContain(".git/HEAD");
    expect(entries).not.toContain("node_modules/fake-pkg/index.js");
  });
});
