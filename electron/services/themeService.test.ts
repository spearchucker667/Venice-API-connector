// @vitest-environment node
/**
 * @fileoverview Unit tests for the Electron theme service (themeService.ts).
 *
 * Locks the contract that:
 *   - built-in/custom theme directories resolve from app paths;
 *   - theme YAML files must be `themes:`-wrapped (or schema-versioned) to be
 *     merged; flat legacy/template files are intentionally skipped;
 *   - `loadAllThemes` merges built-in + legacy + custom files deterministically
 *     (alphabetical) and surfaces warnings instead of throwing;
 *   - `saveTheme`/`deleteTheme` write/remove 0600 YAML files in the custom dir;
 *   - `startThemeWatcher` broadcasts `theme:updated` on .yaml/.yml changes.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import path from "node:path";
import os from "node:os";
import { promises as fs } from "node:fs";
import { REQUIRED_THEME_TOKEN_KEYS } from "../../src/config/configSchema";

const TEST_ROOT = path.join(os.tmpdir(), "vf-theme-service-test");

const mocks = vi.hoisted(() => ({
  getPath: vi.fn((name: string) => path.join(TEST_ROOT, name)),
  getAppPath: vi.fn(() => path.join(TEST_ROOT, "app")),
  isPackaged: false,
  getAllWindows: vi.fn(() => []),
  browserWindowSend: vi.fn(),
  watchOn: vi.fn(),
  watchClose: vi.fn(async () => undefined),
  logInfo: vi.fn(),
}));

vi.mock("electron", () => ({
  app: {
    getPath: mocks.getPath,
    getAppPath: mocks.getAppPath,
    get isPackaged() {
      return mocks.isPackaged;
    },
  },
  BrowserWindow: { getAllWindows: mocks.getAllWindows },
}));

vi.mock("chokidar", () => ({
  watch: vi.fn(() => ({
    on: mocks.watchOn,
    close: mocks.watchClose,
  })),
}));

vi.mock("./logger", () => ({ logInfo: mocks.logInfo }));

import {
  deleteTheme,
  ensureCustomThemesDir,
  getBuiltinThemesDir,
  getCustomThemesDir,
  loadAllThemes,
  readThemeFile,
  saveTheme,
  startThemeWatcher,
} from "./themeService";

function validTokens(): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const key of REQUIRED_THEME_TOKEN_KEYS) tokens[key] = "#123456";
  return tokens;
}

function themeDocument(id: string, displayName: string) {
  return {
    themes: {
      [id]: { id, display_name: displayName, mode: "dark", tokens: validTokens() },
    },
  };
}

async function writeYaml(dir: string, fileName: string, content: unknown): Promise<string> {
  await fs.mkdir(dir, { recursive: true });
  const filePath = path.join(dir, fileName);
  await fs.writeFile(filePath, JSON.stringify(content), "utf8");
  return filePath;
}

beforeEach(async () => {
  mocks.getPath.mockImplementation((name: string) => path.join(TEST_ROOT, name));
  mocks.getAppPath.mockImplementation(() => path.join(TEST_ROOT, "app"));
  mocks.isPackaged = false;
  mocks.logInfo.mockClear();
  mocks.watchOn.mockClear();
  mocks.watchClose.mockClear();
  mocks.getAllWindows.mockClear();
  mocks.browserWindowSend.mockClear();
  await fs.rm(TEST_ROOT, { recursive: true, force: true });
});

describe("themeService paths", () => {
  it("resolves the built-in themes dir from the app path (unpackaged)", () => {
    expect(getBuiltinThemesDir()).toBe(path.join(TEST_ROOT, "app", "config", "themes"));
  });

  it("resolves the built-in themes dir from packaged resources", () => {
    mocks.isPackaged = true;
    const orig = process.resourcesPath;
    (process as { resourcesPath?: string }).resourcesPath = "/fake/resources";
    try {
      expect(getBuiltinThemesDir()).toBe(path.join("/fake/resources", "app.asar", "config", "themes"));
    } finally {
      mocks.isPackaged = false;
      (process as { resourcesPath?: string }).resourcesPath = orig;
    }
  });

  it("resolves custom themes under userData", () => {
    expect(getCustomThemesDir()).toBe(path.join(TEST_ROOT, "userData", "themes"));
  });

  it("creates the custom themes directory on demand", async () => {
    const dir = await ensureCustomThemesDir();
    expect(dir).toBe(path.join(TEST_ROOT, "userData", "themes"));
    await expect(fs.access(dir)).resolves.toBeUndefined();
  });
});

describe("readThemeFile", () => {
  it("parses a themes-wrapped mapping", async () => {
    const filePath = await writeYaml(path.join(TEST_ROOT, "themes"), "a.yaml", themeDocument("emerald", "Emerald"));
    const result = await readThemeFile(filePath);
    expect(result.warnings).toEqual([]);
    expect(result.themes.emerald?.display_name).toBe("Emerald");
  });

  it("returns empty for an empty document", async () => {
    const dir = path.join(TEST_ROOT, "t");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "empty.yaml");
    await fs.writeFile(filePath, "", "utf8");
    const result = await readThemeFile(filePath);
    expect(result).toEqual({ themes: {}, warnings: [] });
  });

  it("skips flat legacy terminal-color files (no themes wrapper)", async () => {
    const filePath = await writeYaml(path.join(TEST_ROOT, "flat"), "flat.yaml", {
      name: "Flat",
      mode: "dark",
      tokens: { background: "#000000" },
    });
    const result = await readThemeFile(filePath);
    expect(result).toEqual({ themes: {}, warnings: [] });
  });

  it("returns an error warning when the YAML is invalid or unreadable", async () => {
    const dir = path.join(TEST_ROOT, "bad");
    await fs.mkdir(dir, { recursive: true });
    const filePath = path.join(dir, "bad.yaml");
    await fs.writeFile(filePath, ":::not yaml:::\n\tbad", "utf8");
    const result = await readThemeFile(filePath);
    expect(result.themes).toEqual({});
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings[0].severity).toBe("error");
  });

  it("surfaces a missing-file error as a warning with the file path as field", async () => {
    const result = await readThemeFile(path.join(TEST_ROOT, "nope", "missing.yaml"));
    expect(result.themes).toEqual({});
    expect(result.warnings[0].field).toContain("missing.yaml");
    expect(result.warnings[0].severity).toBe("error");
  });
});

describe("loadAllThemes", () => {
  it("merges built-in, legacy, and custom themes and sorts by id", async () => {
    const builtin = path.join(TEST_ROOT, "app", "config", "themes");
    await writeYaml(builtin, "b.yaml", themeDocument("zeta", "Zeta"));
    await writeYaml(builtin, "a.yaml", themeDocument("alpha", "Alpha"));

    const legacyPath = path.join(TEST_ROOT, "legacy", "themes.yaml");
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, JSON.stringify(themeDocument("mid", "Mid")), "utf8");

    const custom = path.join(TEST_ROOT, "userData", "themes");
    await writeYaml(custom, "c.yaml", themeDocument("beta", "Beta"));

    const { themes, warnings } = await loadAllThemes(legacyPath);
    expect(Object.keys(themes)).toEqual(["alpha", "beta", "mid", "zeta"]);
    expect(warnings).toEqual([]);
  });

  it("tolerates a missing legacy themes file", async () => {
    const builtin = path.join(TEST_ROOT, "app", "config", "themes");
    await writeYaml(builtin, "a.yaml", themeDocument("alpha", "Alpha"));
    const { themes, warnings } = await loadAllThemes(path.join(TEST_ROOT, "missing", "themes.yaml"));
    expect(Object.keys(themes)).toEqual(["alpha"]);
    expect(warnings).toEqual([]);
  });

  it("records scanning warnings without throwing", async () => {
    const builtin = path.join(TEST_ROOT, "app", "config", "themes");
    await fs.mkdir(builtin, { recursive: true });
    await fs.writeFile(path.join(builtin, "bad.yaml"), "{ not: [valid", "utf8");
    const legacyPath = path.join(TEST_ROOT, "legacy", "themes.yaml");
    await fs.mkdir(path.dirname(legacyPath), { recursive: true });
    await fs.writeFile(legacyPath, JSON.stringify(themeDocument("mid", "Mid")), "utf8");
    const { themes, warnings } = await loadAllThemes(legacyPath);
    expect(themes.mid).toBeDefined();
    expect(warnings.some((w) => w.severity === "error")).toBe(true);
  });
});

describe("saveTheme / deleteTheme", () => {
  it("writes a themes-wrapped YAML with owner-only permissions", async () => {
    const theme = {
      id: "custom-1",
      display_name: "Custom One",
      mode: "dark",
      tokens: validTokens(),
    };
    await saveTheme(theme as never);
    const filePath = path.join(TEST_ROOT, "userData", "themes", "custom-1.yaml");
    const content = await fs.readFile(filePath, "utf8");
    expect(content).toContain("display_name: Custom One");
    expect(content).toContain("tokens:");
    const stat = await fs.stat(filePath);
    expect(stat.mode & 0o777).toBe(0o600);
  });

  it("deletes a theme file and tolerates a missing file", async () => {
    const theme = {
      id: "theme-2",
      display_name: "Custom Two",
      mode: "light",
      tokens: validTokens(),
    };
    await saveTheme(theme as never);
    await deleteTheme("theme-2");
    await expect(fs.access(path.join(TEST_ROOT, "userData", "themes", "theme-2.yaml"))).rejects.toBeDefined();
    await expect(deleteTheme("theme-2")).resolves.toBeUndefined();
  });
});

describe("startThemeWatcher", () => {
  async function registerWatcherCallbacks() {
    const registered: Array<[string, (p: string) => void]> = [];
    mocks.watchOn.mockImplementation((name: string, cb: (p: string) => void) => {
      registered.push([name, cb]);
      return undefined as never;
    });
    await startThemeWatcher();
    return registered;
  }

  it("subscribes to add/change/unlink and broadcasts theme updates for yaml changes", async () => {
    const window = { isDestroyed: () => false, webContents: { send: mocks.browserWindowSend } } as never;
    mocks.getAllWindows.mockReturnValue([window]);

    const registered = await registerWatcherCallbacks();
    expect(registered.map(([name]) => name)).toEqual(["add", "change", "unlink"]);

    const changeCb = registered.find(([name]) => name === "change")![1];
    await changeCb(path.join(TEST_ROOT, "userData", "themes", "custom.yaml"));
    expect(mocks.logInfo).toHaveBeenCalled();
    expect(mocks.browserWindowSend).toHaveBeenCalledWith("theme:updated");

    mocks.browserWindowSend.mockClear();
    await changeCb(path.join(TEST_ROOT, "userData", "themes", "notes.txt"));
    expect(mocks.browserWindowSend).not.toHaveBeenCalled();
  });

  it("skips destroyed windows and closes an existing watcher on restart", async () => {
    const live = { isDestroyed: () => false, webContents: { send: mocks.browserWindowSend } } as never;
    const dead = { isDestroyed: () => true, webContents: { send: mocks.browserWindowSend } } as never;
    mocks.getAllWindows.mockReturnValue([live, dead]);

    const registered = await registerWatcherCallbacks();
    const addCb = registered.find(([name]) => name === "add")![1];
    await addCb(path.join(TEST_ROOT, "userData", "themes", "x.yaml"));
    expect(mocks.browserWindowSend).toHaveBeenCalledTimes(1);

    await startThemeWatcher();
    expect(mocks.watchClose).toHaveBeenCalled();
  });
});