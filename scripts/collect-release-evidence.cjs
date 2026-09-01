#!/usr/bin/env node
/**
 * collect-release-evidence.cjs — aggregate per-platform release artifacts,
 * checksum sidecars, and signature verification evidence into a single
 * release-evidence/ directory. Run in the release workflow publish job after
 * all platform build jobs have succeeded and their artifacts have been
 * downloaded.
 *
 * Outputs:
 *   release-evidence/manifest.json          — artifact inventory with hashes/sizes
 *   release-evidence/checksums.sha256       — aggregate sha256sum-compatible file
 *   release-evidence/metadata.json          — workflow/build metadata
 *   release-evidence/signatures-macos.json  — macOS signing/notarization status
 *   release-evidence/signatures-windows.json — Windows Authenticode status
 *   release-evidence/signatures-linux.json  — Linux code-signing status
 *
 * No secrets, raw payloads, local absolute paths, or command output containing
 * filenames are written. Safe diagnostics include version, commit, artifact
 * names, byte counts, and boolean signature status.
 */
const fs = require("node:fs");
const path = require("node:path");

const CHECKSUMMED_RELEASE_EXTENSIONS = [
  ".exe",
  ".dmg",
  ".zip",
  ".yml",
  ".yaml",
  ".blockmap",
  ".AppImage",
  ".deb",
  ".rpm",
];

const SIGNATURE_FILES = [
  "signatures-macos.json",
  "signatures-windows.json",
  "signatures-linux.json",
];

/**
 * Determine whether a release/ filename is a shippable artifact (not a
 * checksum sidecar or staging file).
 */
function isArtifact(filename) {
  if (typeof filename !== "string") return false;
  if (filename.endsWith(".sha256")) return false;
  return CHECKSUMMED_RELEASE_EXTENSIONS.some((ext) => filename.endsWith(ext));
}

/**
 * Map an artifact filename to its platform for the manifest.
 */
function getPlatform(filename) {
  if (filename.endsWith(".exe")) return "windows";
  if (filename.endsWith(".dmg") || filename.endsWith(".zip") || filename === "latest-mac.yml") {
    return "macos";
  }
  if (
    /latest.*linux.*\.ya?ml$/i.test(filename) ||
    filename.endsWith(".AppImage") ||
    filename.endsWith(".deb") ||
    filename.endsWith(".rpm")
  ) {
    return "linux";
  }
  if (filename === "latest.yml") return "windows";
  return "unknown";
}

/**
 * Read the sha256 sidecar for a release artifact. Returns null if missing.
 */
function readSidecar(releaseDir, filename) {
  const sidecarPath = path.join(releaseDir, `${filename}.sha256`);
  if (!fs.existsSync(sidecarPath)) return null;
  const content = fs.readFileSync(sidecarPath, "ascii").trim();
  const hash = content.split(/\s+/)[0];
  return /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : null;
}

/**
 * Load a per-platform signature evidence file written by a build job.
 */
function loadSignatureEvidence(evidenceDir, filename) {
  const filePath = path.join(evidenceDir, filename);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Normalize the Linux signature evidence when the build job did not produce
 * one (Linux packages are not code-signed).
 */
function defaultLinuxEvidence(tag) {
  return {
    platform: "linux",
    status: "no-code-signing",
    signed: false,
    note: "Linux packages are not code-signed",
    tag,
    timestamp: new Date().toISOString(),
  };
}

/**
 * Build the aggregate evidence directory from the downloaded release/ tree.
 */
function collectReleaseEvidence(rootDir) {
  const releaseDir = path.join(rootDir, "release");
  const evidenceDir = path.join(rootDir, "release-evidence");

  if (!fs.existsSync(releaseDir)) {
    throw new Error("release/ directory not found");
  }

  fs.mkdirSync(evidenceDir, { recursive: true });

  const files = fs.readdirSync(releaseDir);
  const artifacts = files.filter(isArtifact).sort();

  if (artifacts.length === 0) {
    throw new Error("no release artifacts found");
  }

  const tag = process.env.GITHUB_REF_NAME || process.env.npm_package_version || "unknown";

  // Load or synthesize per-platform signature evidence.
  const signatures = {
    macos: loadSignatureEvidence(evidenceDir, "signatures-macos.json") || {
      platform: "macos",
      status: "not-recorded",
      signed: false,
      notarized: false,
      tag,
      timestamp: new Date().toISOString(),
    },
    windows: loadSignatureEvidence(evidenceDir, "signatures-windows.json") || {
      platform: "windows",
      status: "not-recorded",
      signed: false,
      signatureStatus: "unknown",
      tag,
      timestamp: new Date().toISOString(),
    },
    linux: loadSignatureEvidence(evidenceDir, "signatures-linux.json") || defaultLinuxEvidence(tag),
  };

  // Build manifest.
  const manifestArtifacts = [];
  for (const filename of artifacts) {
    const hash = readSidecar(releaseDir, filename);
    if (!hash) {
      throw new Error(`missing or invalid checksum sidecar for ${filename}`);
    }
    const stat = fs.statSync(path.join(releaseDir, filename));
    manifestArtifacts.push({
      filename,
      platform: getPlatform(filename),
      sizeBytes: stat.size,
      sha256: hash,
    });
  }

  const manifest = {
    version: tag,
    commit: process.env.GITHUB_SHA || "unknown",
    timestamp: new Date().toISOString(),
    artifacts: manifestArtifacts,
    signatures: {
      macos: signatures.macos.status,
      windows: signatures.windows.status,
      linux: signatures.linux.status,
    },
  };

  // Build aggregate checksums file in sha256sum-compatible format.
  const checksumLines = manifestArtifacts.map((a) => `${a.sha256}  ${a.filename}`);

  // Build metadata.
  const metadata = {
    source: "GitHub Actions release workflow",
    repository: process.env.GITHUB_REPOSITORY || "unknown",
    runId: process.env.GITHUB_RUN_ID || "unknown",
    runAttempt: process.env.GITHUB_RUN_ATTEMPT || "unknown",
    actor: process.env.GITHUB_ACTOR || "unknown",
    runnerOs: process.env.RUNNER_OS || "unknown",
    unsignedAllowed: process.env.RELEASE_ALLOW_UNSIGNED === "true",
    evidenceSchema: "1.0.0",
  };

  return {
    evidenceDir,
    manifest,
    checksumLines,
    metadata,
    signatures,
  };
}

function writeEvidence(evidence) {
  const { evidenceDir, manifest, checksumLines, metadata, signatures } = evidence;

  fs.writeFileSync(
    path.join(evidenceDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n",
  );
  fs.writeFileSync(
    path.join(evidenceDir, "checksums.sha256"),
    checksumLines.join("\n") + "\n",
  );
  fs.writeFileSync(
    path.join(evidenceDir, "metadata.json"),
    JSON.stringify(metadata, null, 2) + "\n",
  );

  for (const [platform, data] of Object.entries(signatures)) {
    const filename = `signatures-${platform}.json`;
    fs.writeFileSync(path.join(evidenceDir, filename), JSON.stringify(data, null, 2) + "\n");
  }
}

function main() {
  try {
    const evidence = collectReleaseEvidence(process.cwd());
    writeEvidence(evidence);

    console.log("[collect-release-evidence] Wrote release-evidence/");
    for (const filename of [
      "manifest.json",
      "checksums.sha256",
      "metadata.json",
      ...SIGNATURE_FILES,
    ]) {
      console.log(`  - ${filename}`);
    }
  } catch (err) {
    console.error(`[collect-release-evidence] ERROR: ${err.message}`);
    process.exit(1);
  }
}

module.exports = {
  CHECKSUMMED_RELEASE_EXTENSIONS,
  isArtifact,
  getPlatform,
  readSidecar,
  loadSignatureEvidence,
  defaultLinuxEvidence,
  collectReleaseEvidence,
  writeEvidence,
};

if (require.main === module) main();
