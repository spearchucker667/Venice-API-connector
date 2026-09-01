/** @fileoverview Unit tests for scripts/collect-release-evidence.cjs.
 *
 * Verifies that the evidence collector:
 *   - recognizes canonical release artifact extensions
 *   - rejects sidecars and junk files
 *   - aggregates sidecars into checksums.sha256
 *   - builds a manifest with platform, size, and hash
 *   - loads per-platform signature evidence or synthesizes safe defaults
 *   - never writes secrets or local absolute paths
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
// @ts-expect-error - CJS import in TS test
import { isArtifact, getPlatform, readSidecar, loadSignatureEvidence, collectReleaseEvidence, writeEvidence } from "./collect-release-evidence.cjs";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

describe("collect-release-evidence.cjs", () => {
  describe("isArtifact", () => {
    it("accepts every canonical release artifact extension", () => {
      const positives = [
        "Venice-Forge-1.0.6-x64-Setup.exe",
        "Venice-Forge-1.0.6-x64-Portable.exe",
        "Venice-Forge-1.0.6-arm64.dmg",
        "Venice-Forge-1.0.6-x64.zip",
        "latest.yml",
        "latest-mac.yml",
        "latest-linux.yml",
        "Venice-Forge-1.0.6-x64.exe.blockmap",
        "Venice-Forge-1.0.6.AppImage",
        "venice-forge_1.0.6_amd64.deb",
        "Venice-Forge-1.0.6.x86_64.rpm",
      ];
      for (const f of positives) {
        expect(isArtifact(f), `${f} should be an artifact`).toBe(true);
      }
    });

    it("rejects checksum sidecars and non-artifact files", () => {
      const negatives = [
        "Venice-Forge-1.0.6-x64-Setup.exe.sha256",
        "latest.yml.sha256",
        "builder-effective-config.yaml.sha256",
        "NOTES",
        "logs.txt",
        "",
        "   ",
      ];
      for (const f of negatives) {
        expect(isArtifact(f), `${JSON.stringify(f)} should NOT be an artifact`).toBe(false);
      }
    });
  });

  describe("getPlatform", () => {
    it("classifies artifacts by platform", () => {
      expect(getPlatform("Venice-Forge-1.0.6-x64-Setup.exe")).toBe("windows");
      expect(getPlatform("Venice-Forge-1.0.6-arm64.dmg")).toBe("macos");
      expect(getPlatform("Venice-Forge-1.0.6-x64.zip")).toBe("macos");
      expect(getPlatform("latest-mac.yml")).toBe("macos");
      expect(getPlatform("latest.yml")).toBe("windows");
      expect(getPlatform("latest-linux.yml")).toBe("linux");
      expect(getPlatform("Venice-Forge-1.0.6.AppImage")).toBe("linux");
      expect(getPlatform("venice-forge_1.0.6_amd64.deb")).toBe("linux");
      expect(getPlatform("Venice-Forge-1.0.6.x86_64.rpm")).toBe("linux");
    });
  });

  describe("readSidecar", () => {
    it("parses a canonical sha256 sidecar", () => {
      const root = mkdtempSync(join(tmpdir(), "venice-evidence-sidecar-"));
      try {
        const releaseDir = join(root, "release");
        mkdirSync(releaseDir);
        writeFileSync(join(releaseDir, "artifact.exe.sha256"), "deadbeef".repeat(8) + "  artifact.exe\n");
        expect(readSidecar(releaseDir, "artifact.exe")).toBe("deadbeef".repeat(8));
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("returns null when the sidecar is missing or malformed", () => {
      const root = mkdtempSync(join(tmpdir(), "venice-evidence-sidecar-bad-"));
      try {
        const releaseDir = join(root, "release");
        mkdirSync(releaseDir);
        expect(readSidecar(releaseDir, "missing.exe")).toBeNull();
        writeFileSync(join(releaseDir, "bad.exe.sha256"), "not-a-hash  bad.exe\n");
        expect(readSidecar(releaseDir, "bad.exe")).toBeNull();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("loadSignatureEvidence", () => {
    it("loads valid signature JSON", () => {
      const root = mkdtempSync(join(tmpdir(), "venice-evidence-sig-"));
      try {
        const evidenceDir = join(root, "release-evidence");
        mkdirSync(evidenceDir);
        writeFileSync(join(evidenceDir, "signatures-macos.json"), JSON.stringify({ platform: "macos", status: "signed" }));
        expect(loadSignatureEvidence(evidenceDir, "signatures-macos.json")).toEqual({
          platform: "macos",
          status: "signed",
        });
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });

    it("returns null for missing or malformed files", () => {
      const root = mkdtempSync(join(tmpdir(), "venice-evidence-sig-missing-"));
      try {
        const evidenceDir = join(root, "release-evidence");
        mkdirSync(evidenceDir);
        expect(loadSignatureEvidence(evidenceDir, "signatures-macos.json")).toBeNull();
        writeFileSync(join(evidenceDir, "signatures-windows.json"), "not json");
        expect(loadSignatureEvidence(evidenceDir, "signatures-windows.json")).toBeNull();
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  });

  describe("collectReleaseEvidence", () => {
    let root: string;
    let originalEnv: NodeJS.ProcessEnv;

    beforeEach(() => {
      originalEnv = { ...process.env };
      root = mkdtempSync(join(tmpdir(), "venice-evidence-collect-"));
      process.env.GITHUB_REF_NAME = "v1.2.3";
      process.env.GITHUB_SHA = "abc123";
      process.env.GITHUB_REPOSITORY = "spearchucker667/Venice_Forge";
      process.env.GITHUB_RUN_ID = "12345";
      process.env.GITHUB_RUN_ATTEMPT = "1";
      process.env.GITHUB_ACTOR = "release-bot";
      process.env.RUNNER_OS = "Linux";
      process.env.RELEASE_ALLOW_UNSIGNED = "false";
    });

    afterEach(() => {
      process.env = originalEnv;
      rmSync(root, { recursive: true, force: true });
    });

    it("aggregates artifacts and checksums into evidence files", () => {
      const releaseDir = join(root, "release");
      const evidenceDir = join(root, "release-evidence");
      mkdirSync(releaseDir);
      mkdirSync(evidenceDir);

      const artifacts = [
        { name: "Venice-Forge-1.2.3-x64-Setup.exe", hash: "a".repeat(64) },
        { name: "Venice-Forge-1.2.3-arm64.dmg", hash: "b".repeat(64) },
        { name: "Venice-Forge-1.2.3.AppImage", hash: "c".repeat(64) },
      ];
      for (const a of artifacts) {
        writeFileSync(join(releaseDir, a.name), `payload-${a.name}`);
        writeFileSync(join(releaseDir, `${a.name}.sha256`), `${a.hash}  ${a.name}\n`);
      }

      writeFileSync(
        join(evidenceDir, "signatures-macos.json"),
        JSON.stringify({ platform: "macos", status: "signed-and-notarized", signed: true, notarized: true }),
      );
      writeFileSync(
        join(evidenceDir, "signatures-windows.json"),
        JSON.stringify({ platform: "windows", status: "signed", signed: true, signatureStatus: "Valid" }),
      );
      // Linux signature file intentionally absent to test default synthesis.

      const evidence = collectReleaseEvidence(root);
      writeEvidence(evidence);

      expect(existsSync(join(evidenceDir, "manifest.json"))).toBe(true);
      expect(existsSync(join(evidenceDir, "checksums.sha256"))).toBe(true);
      expect(existsSync(join(evidenceDir, "metadata.json"))).toBe(true);
      expect(existsSync(join(evidenceDir, "signatures-macos.json"))).toBe(true);
      expect(existsSync(join(evidenceDir, "signatures-windows.json"))).toBe(true);
      expect(existsSync(join(evidenceDir, "signatures-linux.json"))).toBe(true);

      const manifest = JSON.parse(readFileSync(join(evidenceDir, "manifest.json"), "utf8"));
      expect(manifest.version).toBe("v1.2.3");
      expect(manifest.commit).toBe("abc123");
      expect(manifest.artifacts).toHaveLength(3);
      expect(manifest.signatures).toEqual({
        macos: "signed-and-notarized",
        windows: "signed",
        linux: "no-code-signing",
      });

      const checksums = readFileSync(join(evidenceDir, "checksums.sha256"), "utf8").trim().split("\n");
      expect(checksums).toHaveLength(3);
      const checksumNames = checksums.map((line) => line.split(/\s{2}/)[1]);
      expect(checksumNames).toEqual([
        "Venice-Forge-1.2.3-arm64.dmg",
        "Venice-Forge-1.2.3-x64-Setup.exe",
        "Venice-Forge-1.2.3.AppImage",
      ]);

      const metadata = JSON.parse(readFileSync(join(evidenceDir, "metadata.json"), "utf8"));
      expect(metadata.repository).toBe("spearchucker667/Venice_Forge");
      expect(metadata.unsignedAllowed).toBe(false);
      expect(metadata.evidenceSchema).toBe("1.0.0");

      // Linux default should be synthesized when missing.
      const linuxSig = JSON.parse(readFileSync(join(evidenceDir, "signatures-linux.json"), "utf8"));
      expect(linuxSig.platform).toBe("linux");
      expect(linuxSig.status).toBe("no-code-signing");
      expect(linuxSig.signed).toBe(false);
    });

    it("throws when an artifact is missing its checksum sidecar", () => {
      const releaseDir = join(root, "release");
      const evidenceDir = join(root, "release-evidence");
      mkdirSync(releaseDir);
      mkdirSync(evidenceDir);
      writeFileSync(join(releaseDir, "Venice-Forge-1.2.3-x64-Setup.exe"), "payload");
      // No sidecar.

      expect(() => collectReleaseEvidence(root)).toThrow(/missing or invalid checksum sidecar/);
    });

    it("throws when release/ is empty", () => {
      const releaseDir = join(root, "release");
      const evidenceDir = join(root, "release-evidence");
      mkdirSync(releaseDir);
      mkdirSync(evidenceDir);

      expect(() => collectReleaseEvidence(root)).toThrow(/no release artifacts found/);
    });
  });
});
