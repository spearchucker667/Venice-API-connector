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
  listDrafts: "characterCreator:listDrafts",
  getDraft: "characterCreator:getDraft",
  saveDraft: "characterCreator:saveDraft",
  deleteDraft: "characterCreator:deleteDraft",
  createCharacter: "characterCreator:createCharacter",
  updateCharacter: "characterCreator:updateCharacter",
  duplicateCharacter: "characterCreator:duplicateCharacter",
  importCard: "characterCreator:importCard",
  exportCard: "characterCreator:exportCard",
  validateCard: "characterCreator:validateCard",
} as const;

function sanitizeFilename(name: string): string {
  const clean = name.replace(/[<>:"/\\|?*]/g, "-").replace(/[. ]+$/g, "").trim();
  return (clean || "character-card").slice(0, 100);
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
      if (!payload || typeof payload !== "object") {
        return { ok: false, error: "Invalid card payload." };
      }
      const raw = payload as Record<string, unknown>;
      const card = raw.card as CharacterCardV2Dto | undefined;
      if (!card || card.spec !== "chara_card_v2" || !card.data?.name) {
        return { ok: true, valid: false, errors: ["Invalid Character Card V2 structure or missing name."] };
      }
      return { ok: true, valid: true, errors: [], warnings: [] };
    }),
  );

  ipcMain.handle(
    characterCreatorIpcChannels.exportCard,
    rateLimitIpcHandler(characterCreatorIpcChannels.exportCard, async (_event, payload: unknown) => {
      if (!payload || typeof payload !== "object") {
        return { ok: false, error: "Invalid export parameters." };
      }
      const raw = payload as Record<string, unknown>;
      const cardDto = raw.card as CharacterCardV2Dto | undefined;
      const format = raw.format === "png" ? "png" : "json";
      const avatarDataUrl = typeof raw.avatarDataUrl === "string" ? raw.avatarDataUrl : undefined;

      if (!cardDto || !cardDto.data?.name) {
        return { ok: false, error: "Invalid character card for export." };
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
        // PNG export with JPEG/WebP avatar normalization to PNG
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
        } catch (err) {
          return { ok: false, error: `Avatar image normalization failed: ${err instanceof Error ? err.message : String(err)}` };
        }

        const pngBuffer = embedCharacterCardInPng(imageBuffer, cardDto);
        await atomicWriteFile(targetPath, pngBuffer);
        return { ok: true, canceled: false, filename: path.basename(targetPath) };
      }
    }),
  );
}
