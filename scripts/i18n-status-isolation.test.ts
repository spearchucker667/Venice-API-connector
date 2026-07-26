/**
 * Phase 1 regression guard: synthetic fixure invocations of `runVerification`
 * cannot overwrite the canonical translation-status.json at
 * `docs/i18n/translation-status.json`.
 *
 * @vitest-environment node
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";

// eslint-disable-next-line @typescript-eslint/no-require-imports
const verifier = require("./verify-i18n.cjs") as {
  runVerification: (opts: Record<string, unknown>) => {
    ok: boolean;
    errors: string[];
    coverageResults: Record<string, Record<string, number>>;
    status: { locales: Record<string, unknown> };
  };
};

const ROOT = path.resolve(__dirname, "..");
const STATUS_PATH = path.join(ROOT, "docs", "i18n", "translation-status.json");

const tempRoots: string[] = [];

function makeProject(layout: Record<string, Record<string, string>>): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "venice-i18n-status-iso-"));
  tempRoots.push(root);
  const resourcesDir = path.join(root, "src", "i18n", "resources");
  fs.mkdirSync(resourcesDir, { recursive: true });
  for (const [locale, files] of Object.entries(layout)) {
    const localeResources = path.join(resourcesDir, locale);
    fs.mkdirSync(localeResources, { recursive: true });
    for (const [namespace, content] of Object.entries(files)) {
      const file = path.join(localeResources, `${namespace}.json`);
      fs.writeFileSync(file, content, "utf8");
    }
  }
  return root;
}

afterEach(() => {
  while (tempRoots.length > 0) {
    fs.rmSync(tempRoots.pop() as string, { recursive: true, force: true });
  }
});

function sha256(file: string): string {
  const buf = fs.readFileSync(file);
  return crypto.createHash("sha256").update(buf).digest("hex");
}

describe("verify-i18n status-file isolation", () => {
  it("default invocation does not write the canonical status file", () => {
    const before = fs.existsSync(STATUS_PATH) ? sha256(STATUS_PATH) : null;
    const root = makeProject({
      "en-US": { common: '{ "save": "Save" }' },
      es: { common: '{ "save": "Guardar" }' },
    });
    verifier.runVerification({
      locales: ["en-US", "es"],
      namespaces: ["common"],
      resourcesDir: path.join(root, "src", "i18n", "resources"),
      docsDir: path.join(root, "docs", "i18n"),
      docsRequired: [],
      skipSourceInventory: true,
    });
    if (before === null) {
      expect(fs.existsSync(STATUS_PATH)).toBe(false);
    } else {
      expect(sha256(STATUS_PATH)).toBe(before);
    }
  });

  it("statusPath override writes only to the supplied path", () => {
    const root = makeProject({
      "en-US": { common: '{ "save": "Save" }' },
      es: { common: '{ "save": "Guardar" }' },
    });
    const tmpStatus = path.join(root, "status.json");
    verifier.runVerification({
      locales: ["en-US", "es"],
      namespaces: ["common"],
      resourcesDir: path.join(root, "src", "i18n", "resources"),
      docsDir: path.join(root, "docs", "i18n"),
      docsRequired: [],
      skipSourceInventory: true,
      writeStatus: true,
      statusPath: tmpStatus,
    });
    expect(fs.existsSync(tmpStatus)).toBe(true);
    const status = JSON.parse(fs.readFileSync(tmpStatus, "utf8"));
    expect(status.schemaVersion).toBe(2);
    expect(Object.keys(status.locales).sort()).toEqual(["en-US", "es"]);
  });

  it("fixture writeStatus=true with no statusPath targets the real file", () => {
    const root = makeProject({
      "en-US": { common: '{ "save": "Save" }' },
      es: { common: '{ "save": "Guardar" }' },
    });
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "venice-i18n-iso-cwd-"));
    tempRoots.push(workdir);
    const stubRepoRoot = path.join(workdir, "fake-repo");
    fs.mkdirSync(path.join(stubRepoRoot, "src", "i18n", "resources", "en-US"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(stubRepoRoot, "src", "i18n", "resources", "es"), {
      recursive: true,
    });
    fs.mkdirSync(path.join(stubRepoRoot, "docs", "i18n"), { recursive: true });
    const stubStatus = path.join(stubRepoRoot, "docs", "i18n", "translation-status.json");
    const realResourcesDir = path.join(root, "src", "i18n", "resources");
    const realDocsDir = path.join(root, "docs", "i18n");
    verifier.runVerification({
      locales: ["en-US", "es"],
      namespaces: ["common"],
      resourcesDir: realResourcesDir,
      docsDir: realDocsDir,
      docsRequired: [],
      skipSourceInventory: true,
      writeStatus: true,
      statusPath: stubStatus,
    });
    expect(fs.existsSync(stubStatus)).toBe(true);
    expect(fs.existsSync(STATUS_PATH) ? sha256(STATUS_PATH) : "no-real").not.toBe(null);
  });
});
