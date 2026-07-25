/**
 * @fileoverview Main-process IPC handlers for Character Creator operations.
 */

import { dialog, ipcMain, nativeImage } from "electron";
import fs from "fs/promises";
import path from "path";
import crypto from "crypto";
import { rateLimitIpcHandler } from "../utils/rateLimit";
import { embedCharacterCardInPng } from "../services/characterCardPngCodec";
import type { CharacterCardV2Dto } from "../../src/types/character-card-spec";

export const characterCreatorIpcChannels = {
  exportCard: "characterCreator:exportCard",
  validateCard: "characterCreator:validateCard",
} as const;

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "").trim();
  return (clean || "character-card").slice(0, 100);
}

function hasForbiddenKeys(obj: unknown, depth = 0): boolean {
  if (!obj || typeof obj !== "object" || depth > 20) return false;
  const keys = Object.keys(obj as object);
  for (const k of keys) {
    if (k === "__proto__" || k === "constructor" || k === "prototype") return true;
    if (hasForbiddenKeys((obj as Record<string, unknown>)[k], depth + 1)) return true;
  }
  return false;
}

async function atomicWriteFile(destinationPath: string, data: Buffer | string): Promise<void> {
  const temporaryPath = `${destinationPath}.tmp-${crypto.randomUUID()}`;
  const handle = await fs.open(temporaryPath, "wx", 0o600);
  try {
    await handle.writeFile(data);
    await handle.sync();
  } catch (error) {
    await handle.close().catch(() => undefined);
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
  await handle.close();
  try {
    await fs.rename(temporaryPath, destinationPath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function registerCharacterCreatorHandlers(): void {
  ipcMain.handle(
    characterCreatorIpcChannels.validateCard,
    rateLimitIpcHandler(characterCreatorIpcChannels.validateCard, async (_event, payload: unknown) => {
      if (!payload || typeof payload !== "object" || hasForbiddenKeys(payload)) {
        return { ok: false, error: "Invalid card payload." };
      }
      const raw = payload as Record<string, unknown>;
      const card = raw.card as CharacterCardV2Dto | undefined;
      if (!card || card.spec !== "chara_card_v2" || !card.data?.name || typeof card.data.name !== "string" || !card.data.name.trim()) {
        return { ok: true, valid: false, errors: ["Invalid Character Card V2 structure or missing name."] };
      }
      return { ok: true, valid: true, errors: [], warnings: [] };
    }),
  );

  ipcMain.handle(
    characterCreatorIpcChannels.exportCard,
    rateLimitIpcHandler(characterCreatorIpcChannels.exportCard, async (_event, payload: unknown) => {
      if (!payload || typeof payload !== "object" || hasForbiddenKeys(payload)) {
        return { ok: false, error: "Invalid export parameters." };
      }
      const raw = payload as Record<string, unknown>;
      const cardDto = raw.card as CharacterCardV2Dto | undefined;
      const format = raw.format === "png" ? "png" : "json";
      const avatarDataUrl = typeof raw.avatarDataUrl === "string" ? raw.avatarDataUrl : undefined;

      if (!cardDto || cardDto.spec !== "chara_card_v2" || !cardDto.data?.name || typeof cardDto.data.name !== "string" || !cardDto.data.name.trim()) {
        return { ok: false, error: "Invalid character card for export." };
      }

      if (avatarDataUrl && avatarDataUrl.length > 10 * 1024 * 1024) {
        return { ok: false, error: "Avatar data exceeds 10 MiB limit." };
      }

      const defaultName = `${sanitizeFilename(cardDto.data.name)}-character-card-v2.${format}`;

      // verify-no-native-dialogs: allow
      const saveDialogResult = await dialog.showSaveDialog({
        title: "Export Character Card",
        defaultPath: defaultName,
        filters: format === "png"
          ? [{ name: "PNG Character Card", extensions: ["png"] }]
          : [{ name: "JSON Character Card", extensions: ["json"] }],
      });

      if (saveDialogResult.canceled || !saveDialogResult.filePath) {
        return { ok: true, canceled: true };
      }

      const targetPath = saveDialogResult.filePath;

      if (format === "json") {
        const jsonContent = JSON.stringify(cardDto, null, 2);
        await atomicWriteFile(targetPath, jsonContent);
        return { ok: true, canceled: false, filename: path.basename(targetPath) };
      } else {
        if (!avatarDataUrl || !avatarDataUrl.startsWith("data:image/")) {
          return { ok: false, error: "Avatar image is required for PNG export." };
        }
        let imageBuffer: Buffer;
        try {
          const img = nativeImage.createFromDataURL(avatarDataUrl);
          if (img.isEmpty()) {
            throw new Error("Invalid or empty image data URL.");
          }
          imageBuffer = img.toPNG();
        } catch {
          return { ok: false, error: "Avatar image normalization failed." };
        }

        const pngBuffer = embedCharacterCardInPng(imageBuffer, cardDto);
        await atomicWriteFile(targetPath, pngBuffer);
        return { ok: true, canceled: false, filename: path.basename(targetPath) };
      }
    }),
  );
}
