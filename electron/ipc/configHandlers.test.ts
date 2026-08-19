// @vitest-environment node

import { describe, expect, it, vi, beforeEach } from "vitest";

vi.mock("electron", () => ({
  ipcMain: { handle: vi.fn() },
  dialog: { showSaveDialog: vi.fn() },
}));

vi.mock("../services/configService", () => ({
  exportConfigTemplate: vi.fn(),
  getPaths: vi.fn(),
  getSanitizedConfig: vi.fn(),
  getStatus: vi.fn(),
  initializeConfig: vi.fn(),
  loadMergedThemes: vi.fn(),
  openConfigFolder: vi.fn(),
  reloadConfig: vi.fn(),
  resetSecureStoreKeys: vi.fn(),
  writeSanitizedConfig: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock("../services/secureStore", () => ({
  isMasterPasswordSet: vi.fn(),
  verifyMasterPassword: vi.fn(),
}));

import { ipcMain } from "electron";
import { isMasterPasswordSet, verifyMasterPassword } from "../services/secureStore";
import { writeSanitizedConfig } from "../services/configService";
import { redactConfigPaths, registerConfigIpcHandlers } from "./configHandlers";
import { resetIpcRateLimitForTests } from "../utils/rateLimit";

describe("configHandlers", () => {
  it("redacts absolute config paths before returning status to the renderer", () => {
    const paths = redactConfigPaths({
      configPath: "/Users/example/.config/venice-forge/config.yaml",
      themesPath: "/Users/example/.config/venice-forge/themes.yaml",
      source: "userdata",
    });

    expect(paths).toEqual({
      configPath: "config.yaml",
      themesPath: "themes.yaml",
      source: "userdata",
      configDirLabel: "user config directory",
    });
    expect(JSON.stringify(paths)).not.toContain("/Users/example");
  });
});

describe("safety:setFamilySafeMode", () => {
  let handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    resetIpcRateLimitForTests();
    handlers = {};
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler;
    });
    registerConfigIpcHandlers();
  });

  const callHandler = async (payload: any) => {
    return handlers["safety:setFamilySafeMode"]({} as any, payload);
  };

  it("rejects when no master password is set", async () => {
    vi.mocked(isMasterPasswordSet).mockReturnValue(false);
    const result = await callHandler({ enabled: false });
    expect(result).toEqual({ ok: false, error: "MASTER_PASSWORD_REQUIRED" });
  });

  it("rejects toggle request without password", async () => {
    vi.mocked(isMasterPasswordSet).mockReturnValue(true);
    const result = await callHandler({ enabled: false });
    expect(result).toEqual({ ok: false, error: "Master password required to change Family Safe Mode." });
  });

  it("rejects wrong password", async () => {
    vi.mocked(isMasterPasswordSet).mockReturnValue(true);
    vi.mocked(verifyMasterPassword).mockReturnValue({ verified: false, lockedOutSeconds: 0 });
    const result = await callHandler({ enabled: false, masterPassword: "wrong" });
    expect(result).toEqual({ ok: false, error: "Incorrect master password." });
  });

  it("rejects locked-out password", async () => {
    vi.mocked(isMasterPasswordSet).mockReturnValue(true);
    vi.mocked(verifyMasterPassword).mockReturnValue({ verified: false, lockedOutSeconds: 30 });
    const result = await callHandler({ enabled: false, masterPassword: "wrong" });
    expect(result).toEqual({ ok: false, error: "Too many attempts. Try again in 30s.", lockedOutSeconds: 30 });
  });

  it("accepts correct password toggle", async () => {
    vi.mocked(isMasterPasswordSet).mockReturnValue(true);
    vi.mocked(verifyMasterPassword).mockReturnValue({ verified: true, lockedOutSeconds: 0 });
    const result = await callHandler({ enabled: true, masterPassword: "correct" });
    expect(result).toEqual({ ok: true, config: undefined });
    expect(writeSanitizedConfig).toHaveBeenCalledWith({ safety: { local_family_safe_mode_enabled: true } });
  });
});

describe("config:writeSanitized generic patch rejection", () => {
  let handlers: Record<string, Function> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    resetIpcRateLimitForTests();
    handlers = {};
    (ipcMain.handle as any).mockImplementation((channel: string, handler: Function) => {
      handlers[channel] = handler;
    });
    registerConfigIpcHandlers();
  });

  const callHandler = async (patch: any) => {
    return handlers["config:writeSanitized"]({} as any, patch);
  };

  it("rejects generic modification of Family Safe Mode", async () => {
    const result = await callHandler({ safety: { local_family_safe_mode_enabled: false } });
    expect(result).toEqual({ ok: false, redactedFields: [], error: "Family Safe Mode cannot be modified via generic config write." });
    expect(writeSanitizedConfig).not.toHaveBeenCalled();
  });

  it("allows generic modification of other config", async () => {
    await callHandler({ display: { theme: "dark" } });
    expect(writeSanitizedConfig).toHaveBeenCalledWith({ display: { theme: "dark" } });
  });
});
