// @vitest-environment node

import { afterEach, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const { captureSmokeDiagnostics, readArguments, repositoryRelativeExecutable } = require("./capture-smoke-diagnostics.cjs") as {
  captureSmokeDiagnostics: (input: {
    root: string;
    platform: NodeJS.Platform;
    architecture: string;
    outputPath: string;
    env?: NodeJS.ProcessEnv;
  }) => Record<string, string>;
  readArguments: (argv: string[]) => { platform: NodeJS.Platform; arch: string; output: string };
  repositoryRelativeExecutable: (root: string, executable?: string) => string;
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});

describe("capture-smoke-diagnostics", () => {
  it("parses the portable CLI arguments and rejects malformed input", () => {
    expect(
      readArguments([
        "--platform",
        "darwin",
        "--arch",
        "arm64",
        "--output",
        "smoke-diagnostics/summary.json",
      ]),
    ).toEqual({
      platform: "darwin",
      arch: "arm64",
      output: "smoke-diagnostics/summary.json",
    });
    expect(() => readArguments(["--unknown", "value"])).toThrow("Unknown argument");
    expect(() => readArguments(["--platform", "--arch", "x64"])).toThrow("Missing value");
    expect(() => readArguments(["--platform", "freebsd", "--arch", "x64", "--output", "x"])).toThrow(
      "Unsupported platform",
    );
  });

  it("redacts executable paths outside the repository", () => {
    expect(repositoryRelativeExecutable("/workspace/project", undefined)).toBe("(not found)");
    expect(repositoryRelativeExecutable("/workspace/project", "/tmp/application")).toBe("(outside repository)");
  });

  it("writes sanitized repository-relative executable evidence", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "venice-smoke-diagnostics-"));
    temporaryDirectories.push(root);
    fs.writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify({ version: "1.2.3", productName: "Venice Forge" }),
    );
    const executable = path.join(root, "release", "win-unpacked", "Venice Forge.exe");
    fs.mkdirSync(path.dirname(executable), { recursive: true });
    fs.writeFileSync(executable, "fixture");

    const result = captureSmokeDiagnostics({
      root,
      platform: "win32",
      architecture: "x64",
      outputPath: "smoke-diagnostics/summary.json",
      env: { GITHUB_SHA: "abc123", RUNNER_OS: "Windows" },
    });

    expect(result).toEqual({
      platform: "win32",
      arch: "x64",
      appVersion: "1.2.3",
      commit: "abc123",
      runner: "Windows",
      discoveredExecutable: "release/win-unpacked/Venice Forge.exe",
    });
    const raw = fs.readFileSync(path.join(root, "smoke-diagnostics", "summary.json"), "utf8");
    expect(raw).not.toContain(root);
  });

  it("records a missing package without failing the diagnostic step", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "venice-smoke-diagnostics-"));
    temporaryDirectories.push(root);
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));

    const result = captureSmokeDiagnostics({
      root,
      platform: "linux",
      architecture: "x64",
      outputPath: "smoke-diagnostics/summary.json",
      env: {},
    });

    expect(result.discoveredExecutable).toBe("(not found)");
  });

  it("rejects an output path outside the workspace", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "venice-smoke-diagnostics-"));
    temporaryDirectories.push(root);
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));

    expect(() =>
      captureSmokeDiagnostics({
        root,
        platform: "linux",
        architecture: "x64",
        outputPath: "../summary.json",
        env: {},
      }),
    ).toThrow("inside the repository workspace");
  });

  it("runs as a standalone Node CLI", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "venice-smoke-diagnostics-"));
    temporaryDirectories.push(root);
    fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ version: "1.2.3" }));
    const script = path.join(process.cwd(), "scripts", "capture-smoke-diagnostics.cjs");

    const result = spawnSync(
      process.execPath,
      [script, "--platform", "linux", "--arch", "x64", "--output", "diagnostics/summary.json"],
      { cwd: root, encoding: "utf8" },
    );

    expect(result.status, result.stderr).toBe(0);
    expect(fs.existsSync(path.join(root, "diagnostics", "summary.json"))).toBe(true);
  });
});
