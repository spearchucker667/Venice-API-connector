/** @fileoverview Unit tests for release verification platform selection. */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it, expect } from "vitest";
// @ts-expect-error - CJS import in TS file
import { getTargets, buildReleaseAllowlist, FORBIDDEN_DIST_PATTERNS, SECRET_PATTERNS, FORBIDDEN_ELECTRON_TEXT_PATTERNS, brandingNoticesInSync } from "./verify-dist.cjs";

describe("verify-dist platform selection", () => {
  it("selects Windows x64 when running on win32 with no args", () => {
    const targets = getTargets("win32", []);
    expect(targets.checkWin).toBe(true);
    expect(targets.checkMac).toBe(false);
    expect(targets.targetArches).toEqual(["x64"]);
  });

  it("selects macOS x64/arm64 when running on darwin with no args", () => {
    const targets = getTargets("darwin", []);
    expect(targets.checkWin).toBe(false);
    expect(targets.checkMac).toBe(true);
    expect(targets.targetArches).toEqual(["x64", "arm64"]);
  });

  it("selects both when --all is passed", () => {
    const targets = getTargets("linux", ["--all"]);
    expect(targets.checkWin).toBe(true);
    expect(targets.checkMac).toBe(true);
    expect(targets.targetArches).toEqual(["x64", "arm64"]);
  });

  it("respects explicit --win and --mac flags", () => {
    const targets = getTargets("linux", ["--win", "--mac"]);
    expect(targets.checkWin).toBe(true);
    expect(targets.checkMac).toBe(true);
  });

  it("respects explicit --arch flag", () => {
    const targets = getTargets("darwin", ["--arch", "arm64"]);
    expect(targets.targetArches).toEqual(["arm64"]);
  });

  it("prevents Linux from defaulting to Windows (regression test)", () => {
    const targets = getTargets("linux", []);
    expect(targets.checkWin).toBe(false);
    expect(targets.checkMac).toBe(false);
    expect(targets.checkLinux).toBe(false);
  });

  it("selects Linux when --linux is passed", () => {
    const targets = getTargets("linux", ["--linux"]);
    expect(targets.checkLinux).toBe(true);
    expect(targets.checkWin).toBe(false);
    expect(targets.checkMac).toBe(false);
  });

  it("selects all platforms when --all is passed on any OS", () => {
    const targets = getTargets("darwin", ["--all"]);
    expect(targets.checkLinux).toBe(true);
    expect(targets.checkMac).toBe(true);
    expect(targets.checkWin).toBe(true);
    expect(targets.targetArches).toEqual(["x64", "arm64"]);
  });

  it("does not treat --release-artifacts-only as a platform selector", () => {
    const targets = getTargets("linux", ["--release-artifacts-only"]);
    expect(targets.checkLinux).toBe(false);
    expect(targets.checkMac).toBe(false);
    expect(targets.checkWin).toBe(false);
  });
});

describe("verify-dist release artifact allowlist", () => {
  const version = "3.0.0-beta.2";

  it("includes expected Windows setup, portable, and updater artifacts", () => {
    const allowed = buildReleaseAllowlist(version, {
      checkWin: true,
      checkMac: false,
      checkLinux: false,
      targetArches: ["x64"],
      isPortableOnly: false,
    });
    expect(allowed.has(`Venice-Forge-${version}-x64-Setup.exe`)).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-x64-Portable.exe`)).toBe(true);
    expect(allowed.has("latest.yml")).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-x64-Setup.exe.sha256`)).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-x64-Setup.exe.blockmap`)).toBe(true);
  });

  it("includes expected macOS artifacts for both architectures", () => {
    const allowed = buildReleaseAllowlist(version, {
      checkWin: false,
      checkMac: true,
      checkLinux: false,
      targetArches: ["x64", "arm64"],
      isPortableOnly: false,
    });
    expect(allowed.has(`Venice-Forge-${version}-x64.dmg`)).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-arm64.zip`)).toBe(true);
    expect(allowed.has("latest-mac.yml")).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-x64.dmg.blockmap.sha256`)).toBe(true);
  });

  it("includes expected Linux artifacts for x64", () => {
    const allowed = buildReleaseAllowlist(version, {
      checkWin: false,
      checkMac: false,
      checkLinux: true,
      targetArches: ["x64"],
      linuxArches: ["x64"],
      isPortableOnly: false,
    });
    expect(allowed.has(`Venice-Forge-${version}-x86_64.AppImage`)).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-amd64.deb`)).toBe(true);
    expect(allowed.has(`Venice-Forge-${version}-x86_64.rpm`)).toBe(true);
    expect(allowed.has("latest-linux.yml")).toBe(true);
  });

  it("excludes unrelated platform artifacts", () => {
    const allowed = buildReleaseAllowlist(version, {
      checkWin: true,
      checkMac: false,
      checkLinux: false,
      targetArches: ["x64"],
      isPortableOnly: false,
    });
    expect(allowed.has(`Venice-Forge-${version}-x64.dmg`)).toBe(false);
    expect(allowed.has(`Venice-Forge-${version}-x64.AppImage`)).toBe(false);
  });

  it("excludes electron-builder debug manifest", () => {
    const allowed = buildReleaseAllowlist(version, {
      checkWin: false,
      checkMac: false,
      checkLinux: false,
      targetArches: ["x64"],
      isPortableOnly: false,
    });
    expect(allowed.has("builder-debug.yml")).toBe(false);
    expect(allowed.has("builder-debug.yml.sha256")).toBe(false);
  });
});

describe("verify-dist Phase 2J hygiene guards", () => {
  it("FORBIDDEN_DIST_PATTERNS rejects source maps, test files, env, db, local config", () => {
    const bad = [
      "assets/index.js.map",
      "src/foo.test.ts",
      "src/foo.spec.js",
      "scripts/run.test.cjs",
      ".env",
      ".env.local",
      ".config/config.local.yaml",
      ".config/themes.prod.yml",
      "cache.db",
      "data.sqlite3",
      ".design-captures/x.png",
      "chat-history/conv.json",
      ".integration-src/run.ts",
    ];
    for (const s of bad) {
      const hit = FORBIDDEN_DIST_PATTERNS.some((re: RegExp) => re.test(s) || re.test("/" + s));
      expect(hit).toBe(true);
    }
    // Allowed: real source / asset names
    const ok = [
      "assets/index-DaRjS5zB.js",
      "branding/venice-logo.svg",
      "branding/NOTICE.md",
      "index.html",
      "server.cjs",
    ];
    for (const s of ok) {
      const hit = FORBIDDEN_DIST_PATTERNS.some((re: RegExp) => re.test(s) || re.test("/" + s));
      expect(hit).toBe(false);
    }
  });

  it("SECRET_PATTERNS catch real Venice / sk- / Bearer tokens but not internal constants", () => {
    const real = [
      "const k = 'venice_" + "a".repeat(40) + "';",
      "Authorization: Bearer " + "a".repeat(40),
      "sk-" + "x".repeat(40),
      "vn-abc_DEF.1234567890",
      "OPENAI_API_KEY=sk-abc_DEF.1234567890",
    ];
    for (const s of real) {
      const hit = SECRET_PATTERNS.some((re: RegExp) => {
        re.lastIndex = 0;
        return re.test(s);
      });
      expect(hit).toBe(true);
    }
    // App-internal identifiers must not match
    const internal = [
      "venice_canvas_studio_v1",
      "venice_forge_traffic_logs_",
      "VENICE_API_KEY constant name",
    ];
    for (const s of internal) {
      const hit = SECRET_PATTERNS.some((re: RegExp) => {
        re.lastIndex = 0;
        return re.test(s);
      });
      expect(hit).toBe(false);
    }
  });

  it("FORBIDDEN_ELECTRON_TEXT_PATTERNS rejects generated imports back into src/", () => {
    const bad = [
      'const redaction = require("../../src/shared/redaction");',
      'import { limits } from "../src/shared/limits";',
    ];
    for (const s of bad) {
      const hit = FORBIDDEN_ELECTRON_TEXT_PATTERNS.some(({ re }: { re: RegExp }) => re.test(s));
      expect(hit).toBe(true);
    }

    const ok = [
      'const electron = require("electron");',
      'const local = require("./services/secureStore");',
      'import path from "node:path";',
    ];
    for (const s of ok) {
      const hit = FORBIDDEN_ELECTRON_TEXT_PATTERNS.some(({ re }: { re: RegExp }) => re.test(s));
      expect(hit).toBe(false);
    }
  });
});

describe("verify-dist branding NOTICE sync (CI-007)", () => {
  it("accepts identical tracked NOTICE files in the real repository", () => {
    const repoRoot = path.resolve(__dirname, "..");
    const result = brandingNoticesInSync(repoRoot);
    expect(result.ok).toBe(true);
  });

  it("rejects a diverged runtime copy", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "vf-branding-"));
    try {
      fs.mkdirSync(path.join(root, "assets/branding"), { recursive: true });
      fs.mkdirSync(path.join(root, "public/assets/branding"), { recursive: true });
      fs.writeFileSync(path.join(root, "assets/branding/NOTICE.md"), "same\n");
      fs.writeFileSync(path.join(root, "public/assets/branding/NOTICE.md"), "DIFFERENT\n");
      const result = brandingNoticesInSync(root);
      expect(result.ok).toBe(false);
      expect(result.reason).toContain("must remain identical");
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });

  it("rejects a missing runtime copy", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "aff-branding2-"));
    try {
      fs.mkdirSync(path.join(root, "assets/branding"), { recursive: true });
      fs.writeFileSync(path.join(root, "assets/branding/NOTICE.md"), "# Source\n");
      expect(() => brandingNoticesInSync(root)).toThrow();
    } finally {
      fs.rmSync(root, { recursive: true, force: true });
    }
  });
});
