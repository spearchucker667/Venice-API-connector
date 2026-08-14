#!/usr/bin/env node

/**
 * @fileoverview Synchronizes the local authoritative Venice API documentation mirror
 * from the upstream repository (https://github.com/veniceai/api-docs).
 *
 * Requirements:
 * - Mirror destination: docs/reference/venice-api-upstream/ (ignored by Git)
 * - Read-only mirror; never modifies upstream checkout or commits it.
 * - Validates presence of mandatory authoritative files:
 *   swagger.yaml, llms.txt, skill.md, agents.md, api-reference/, models/, guides/media/
 */

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const REPO_ROOT = path.resolve(__dirname, "..");
const MIRROR_DIR = path.join(REPO_ROOT, "docs", "reference", "venice-api-upstream");
const UPSTREAM_URL = "https://github.com/veniceai/api-docs.git";

const MANDATORY_FILES = [
  "swagger.yaml",
  "llms.txt",
  "skill.md",
  "agents.md",
  "README.md",
  "docs.json",
  path.join("api-reference", "api-spec.mdx"),
  path.join("guides", "media", "image-generation.mdx"),
  path.join("guides", "media", "image-editing.mdx"),
  path.join("guides", "media", "image-upscaling.mdx"),
  path.join("guides", "media", "video-generation.mdx"),
  path.join("guides", "media", "seedance-face-consent.mdx"),
  path.join("guides", "media", "music-and-sound-effects.mdx"),
  path.join("guides", "media", "text-to-speech.mdx"),
  path.join("models", "image.mdx"),
  path.join("models", "video.mdx"),
  path.join("models", "music.mdx"),
];

function runGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
}

function syncUpstream() {
  const referenceDir = path.join(REPO_ROOT, "docs", "reference");
  if (!fs.existsSync(referenceDir)) {
    fs.mkdirSync(referenceDir, { recursive: true });
  }

  const isCloned = fs.existsSync(path.join(MIRROR_DIR, ".git"));

  if (!isCloned) {
    console.log(`[sync-venice-api-docs] Cloning ${UPSTREAM_URL} into ${MIRROR_DIR}...`);
    execFileSync("git", ["clone", "--depth", "1", "--branch", "main", UPSTREAM_URL, MIRROR_DIR], {
      cwd: REPO_ROOT,
      stdio: "inherit",
    });
  } else {
    console.log(`[sync-venice-api-docs] Fetching latest changes in ${MIRROR_DIR}...`);
    runGit(["fetch", "origin", "main"], MIRROR_DIR);
    runGit(["checkout", "main"], MIRROR_DIR);
    runGit(["pull", "--ff-only", "origin", "main"], MIRROR_DIR);
  }

  const commitSha = runGit(["rev-parse", "HEAD"], MIRROR_DIR);
  const commitDate = runGit(["log", "-1", "--format=%ci"], MIRROR_DIR);
  const commitSubject = runGit(["log", "-1", "--format=%s"], MIRROR_DIR);

  console.log(`[sync-venice-api-docs] Upstream HEAD: ${commitSha}`);
  console.log(`[sync-venice-api-docs] Upstream Date: ${commitDate}`);
  console.log(`[sync-venice-api-docs] Upstream Subject: ${commitSubject}`);

  // Validate mandatory files
  const missing = [];
  for (const file of MANDATORY_FILES) {
    const fullPath = path.join(MIRROR_DIR, file);
    if (!fs.existsSync(fullPath)) {
      missing.push(file);
    }
  }

  if (missing.length > 0) {
    console.error("[sync-venice-api-docs] ERROR: Missing mandatory upstream files:");
    for (const m of missing) {
      console.error(` - ${m}`);
    }
    process.exit(1);
  }

  console.log(`[sync-venice-api-docs] All ${MANDATORY_FILES.length} mandatory files verified.`);
  return { commitSha, commitDate, commitSubject };
}

if (require.main === module) {
  try {
    syncUpstream();
  } catch (err) {
    console.error("[sync-venice-api-docs] Failed:", err.message || err);
    process.exit(1);
  }
}

module.exports = {
  syncUpstream,
  MIRROR_DIR,
  MANDATORY_FILES,
};
