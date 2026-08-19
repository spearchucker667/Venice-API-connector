import { ipcMain, dialog } from "electron";
import path from "node:path";
import { redactErrorMessage } from "../../src/shared/redaction";
import { rateLimitIpcHandler } from "../utils/rateLimit";
import {
  exportConfigTemplate,
  getPaths,
  getSanitizedConfig,
  getStatus as getConfigStatus,
  initializeConfig,
  loadMergedThemes,
  openConfigFolder,
  reloadConfig,
  resetSecureStoreKeys,
  writeSanitizedConfig,
} from "../services/configService";
import { verifyMasterPassword, isMasterPasswordSet } from "../services/secureStore";

export function redactConfigPaths(paths: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = { configDirLabel: "user config directory" };
  for (const [key, value] of Object.entries(paths)) {
    if (typeof value === "string") redacted[key] = path.basename(value);
    else redacted[key] = value;
  }
  return redacted;
}

/**
 * Registers all IPC handlers related to local master YAML config
 * and theming.
 */
export function registerConfigIpcHandlers() {
  const handleIpc = (channel: string, handler: Parameters<typeof ipcMain.handle>[1]) => {
    ipcMain.handle(channel, rateLimitIpcHandler(channel, handler));
  };

  handleIpc("config:get", () => {
    try {
      return { ok: true, payload: getSanitizedConfig() };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:getStatus", () => {
    try {
      return { ok: true, status: getConfigStatus(), paths: redactConfigPaths(getPaths() as unknown as Record<string, unknown>) };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:reload", async () => {
    try {
      const status = await reloadConfig();
      return { ok: true, status };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:initialize", async () => {
    try {
      const status = await initializeConfig();
      return { ok: true, status };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:openFolder", async () => {
    try {
      return await openConfigFolder();
    } catch (err) {
      return { ok: false, path: "", error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:writeSanitized", async (_event, patch: unknown) => {
    try {
      if (typeof patch === "object" && patch !== null) {
        const p = patch as Record<string, unknown>;
        if (typeof p.safety === "object" && p.safety !== null) {
          if ("local_family_safe_mode_enabled" in p.safety) {
            return { ok: false, redactedFields: [], error: "Family Safe Mode cannot be modified via generic config write." };
          }
        }
      }
      return await writeSanitizedConfig(patch);
    } catch (err) {
      return { ok: false, redactedFields: [], error: redactErrorMessage(err) };
    }
  });

  handleIpc("safety:setFamilySafeMode", async (_event, payload: unknown) => {
    try {
      if (!payload || typeof payload !== "object") {
        throw new Error("Invalid payload.");
      }
      const { enabled, masterPassword } = payload as { enabled?: boolean; masterPassword?: string };
      if (typeof enabled !== "boolean") {
        throw new Error("Enabled state must be boolean.");
      }
      if (isMasterPasswordSet()) {
        if (typeof masterPassword !== "string") {
          return { ok: false, error: "Master password required to change Family Safe Mode." };
        }
        const { verified, lockedOutSeconds } = verifyMasterPassword(masterPassword);
        if (!verified) {
          if (lockedOutSeconds > 0) {
            return { ok: false, error: `Too many attempts. Try again in ${lockedOutSeconds}s.`, lockedOutSeconds };
          }
          return { ok: false, error: "Incorrect master password." };
        }
      }
      const result = await writeSanitizedConfig({ safety: { local_family_safe_mode_enabled: enabled } });
      if (!result.ok) {
        return result;
      }
      return { ok: true, config: getSanitizedConfig() };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:exportTemplate", async () => {
    try {
      // verify-no-native-dialogs: allow — intentional save dialog for config template export
      const result = await dialog.showSaveDialog({
        title: "Export Venice Forge config template",
        defaultPath: "venice-forge.config.example.yaml",
        filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
        properties: ["showOverwriteConfirmation", "createDirectory"],
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      return await exportConfigTemplate(result.filePath);
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:loadMergedThemes", async () => {
    try {
      return { ok: true, ...(await loadMergedThemes()) };
    } catch (err) {
      return { ok: false, themes: {}, warnings: [], error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:saveTheme", async (_event, theme: unknown) => {
    try {
      const { saveTheme } = await import("../services/themeService");
      // Use cast to YamlTheme & { id: string }
      await saveTheme(theme as import("../../src/config/configSchema").YamlTheme & { id: string });
      return { ok: true };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:deleteTheme", async (_event, id: string) => {
    try {
      const { deleteTheme } = await import("../services/themeService");
      await deleteTheme(id);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  handleIpc("config:resetSecureStoreKeys", () => {
    try {
      const removed = resetSecureStoreKeys();
      return { ok: true, removed };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });
}
