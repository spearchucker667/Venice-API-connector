/** @fileoverview File-system and local-file IPC handlers (save/load dialogs,
 *  media import/export, character image cache, etc.). */

import { BrowserWindow, dialog, shell } from "electron";
import fs from "fs/promises";
import path from "path";
import { VENICE_MAX_BODY_BYTES } from "../../../src/shared/limits";
import { redactErrorMessage } from "../../../src/shared/redaction";
import {
  generateMediaThumb,
  importMediaFromPath,
  readMediaMeta,
  revealMediaInFolder,
} from "../../services/mediaService";
import {
  clearCharacterImageCache,
  getCachedCharacterImage,
  getCharacterImageCacheInventory,
} from "../../services/characterImageCache";
import { registerIpcChannel } from "./common";
import { getProfileSessionId } from "../../services/profileSession";
import {
  exportMediaBatchAs,
  saveDataUrlAs,
  saveGeneratedMediaAs,
  saveGeneratedMediaBytesAs,
  type BulkExportItem,
} from "../../services/generatedMediaExport";
import {
  classifyGeneratedMediaPersistenceError,
  persistGeneratedMedia,
} from "../../services/generatedMediaStore";
import {
  getGeneratedMediaRecovery,
  retainGeneratedMediaForRecovery,
  retryGeneratedMediaRecovery,
} from "../../services/generatedMediaRecoveryQueue";

/** Maximum size in bytes for JSON import and export files. */
const MAX_JSON_FILE_BYTES = VENICE_MAX_BODY_BYTES;

const ROUTED_IMAGE_EXTENSIONS_BY_MIME: Record<string, readonly string[]> = {
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
  "image/webp": [".webp"],
};

function parseRoutedImageDataUrl(value: string): { mime: string | null; rawBase64: string } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(value.trim());
  if (!match) return { mime: null, rawBase64: value };
  const mime = match[1].toLowerCase();
  if (!Object.hasOwn(ROUTED_IMAGE_EXTENSIONS_BY_MIME, mime)) return null;
  return { mime, rawBase64: match[2] };
}

function decodeStrictRoutedBase64(value: string): Buffer | null {
  const compact = value.replace(/\s+/g, "");
  if (!compact || compact.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(compact)) return null;
  const buffer = Buffer.from(compact, "base64");
  if (buffer.length === 0 || buffer.toString("base64") !== compact) return null;
  return buffer;
}

function sniffRoutedImageContentType(buffer: Buffer): string | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) return "image/png";
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return "image/jpeg";
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) return "image/webp";
  return null;
}

export function registerFileHandlers(): void {
  registerIpcChannel("app:media:persist-generated-image", async (event, input: unknown) => {
    let validatedBytes: Buffer | undefined;
    let validatedMime: string | undefined;
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || event.senderFrame !== event.sender.mainFrame) {
        return { ok: false, error: "Generated image persistence sender was rejected." };
      }
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Generated image persistence payload was invalid." };
      }
      const dataUrl = (input as Record<string, unknown>).dataUrl;
      if (typeof dataUrl !== "string") {
        return { ok: false, error: "Generated image data must be a base64 data URL." };
      }
      if (dataUrl.length > 50 * 1024 * 1024 * 1.37) {
        return { ok: false, error: "Generated image data is too large." };
      }
      const parsed = parseRoutedImageDataUrl(dataUrl);
      if (!parsed?.mime) {
        return { ok: false, error: "Generated image data URL was invalid or unsupported." };
      }
      const bytes = decodeStrictRoutedBase64(parsed.rawBase64);
      if (!bytes || sniffRoutedImageContentType(bytes) !== parsed.mime) {
        return { ok: false, error: "Generated image bytes did not match the declared content type." };
      }
      validatedBytes = bytes;
      validatedMime = parsed.mime;
      const media = await persistGeneratedMedia(bytes, parsed.mime);
      return { ok: true, media };
    } catch (error) {
      const failure = classifyGeneratedMediaPersistenceError(error);
      const retained = validatedBytes && validatedMime && failure.kind !== "invalid-media"
        ? retainGeneratedMediaForRecovery(validatedBytes, validatedMime)
        : null;
      return {
        ok: false,
        error: failure.message,
        errorKind: failure.kind,
        retryable: failure.retryable,
        recoveryId: retained?.recoveryId,
      };
    }
  });

  registerIpcChannel("app:media:retry-generated-image", async (event, input: unknown) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || event.senderFrame !== event.sender.mainFrame) {
        return { ok: false, error: "Generated image recovery sender was rejected." };
      }
      const recoveryId = input && typeof input === "object"
        ? (input as Record<string, unknown>).recoveryId
        : undefined;
      if (typeof recoveryId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recoveryId)) {
        return { ok: false, error: "Generated image recovery ID was invalid." };
      }
      const media = await retryGeneratedMediaRecovery(recoveryId);
      return { ok: true, media };
    } catch (error) {
      const failure = classifyGeneratedMediaPersistenceError(error);
      return { ok: false, error: failure.message, errorKind: failure.kind, retryable: failure.retryable };
    }
  });

  registerIpcChannel("app:media:save-generated-recovery", async (event, input: unknown) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || event.senderFrame !== event.sender.mainFrame) {
        return { ok: false, canceled: false, error: "Generated image recovery export sender was rejected." };
      }
      const record = input && typeof input === "object" ? input as Record<string, unknown> : {};
      const recoveryId = typeof record.recoveryId === "string" ? record.recoveryId : "";
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(recoveryId)) {
        return { ok: false, canceled: false, error: "Generated image recovery ID was invalid." };
      }
      const recovery = getGeneratedMediaRecovery(recoveryId);
      if (!recovery) return { ok: false, canceled: false, error: "Generated image recovery data expired or is unavailable." };
      return await saveGeneratedMediaBytesAs({
        bytes: recovery.bytes,
        mimeType: recovery.mimeType,
        suggestedName: typeof record.suggestedName === "string" ? record.suggestedName : undefined,
      });
    } catch (error) {
      return { ok: false, canceled: false, error: redactErrorMessage(error) };
    }
  });

  registerIpcChannel("app:media:save-generated", async (event, input: unknown) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || event.senderFrame !== event.sender.mainFrame) {
        return { ok: false, canceled: false, error: "Generated media export sender was rejected." };
      }
      if (!input || typeof input !== "object") {
        return { ok: false, canceled: false, error: "Generated media export payload was invalid." };
      }
      const record = input as Record<string, unknown>;
      const result = await saveGeneratedMediaAs({
        mediaId: typeof record.mediaId === "string" ? record.mediaId : "",
        suggestedName: typeof record.suggestedName === "string" ? record.suggestedName : undefined,
      });
      return result;
    } catch (err) {
      return { ok: false, canceled: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:media:save-data-url", async (event, input: unknown) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || event.senderFrame !== event.sender.mainFrame) {
        return { ok: false, canceled: false, error: "Save Data URL sender was rejected." };
      }
      if (!input || typeof input !== "object") {
        return { ok: false, canceled: false, error: "Save Data URL payload was invalid." };
      }
      const record = input as Record<string, unknown>;
      return await saveDataUrlAs({
        dataUrl: typeof record.dataUrl === "string" ? record.dataUrl : "",
        suggestedName: typeof record.suggestedName === "string" ? record.suggestedName : undefined,
      });
    } catch (err) {
      return { ok: false, canceled: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:media:export-files", async (event, input: unknown) => {
    try {
      const owner = BrowserWindow.fromWebContents(event.sender);
      if (!owner || event.senderFrame !== event.sender.mainFrame) {
        return { ok: false, canceled: false, succeeded: [], failed: [], error: "Export files sender was rejected." };
      }
      if (!input || typeof input !== "object") {
        return { ok: false, canceled: false, succeeded: [], failed: [], error: "Export files payload was invalid." };
      }
      const record = input as Record<string, unknown>;
      const rawItems = record.items;
      if (!Array.isArray(rawItems) || rawItems.length === 0) {
        return { ok: true, canceled: false, succeeded: [], failed: [] };
      }
      const items: BulkExportItem[] = rawItems.map((raw: unknown) => {
        const it = (raw ?? {}) as Record<string, unknown>;
        return {
          itemId: typeof it.itemId === "string" ? it.itemId : "",
          mediaId: typeof it.mediaId === "string" ? it.mediaId : undefined,
          dataUrl: typeof it.dataUrl === "string" ? it.dataUrl : undefined,
          mimeType: typeof it.mimeType === "string" ? it.mimeType : undefined,
          suggestedName: typeof it.suggestedName === "string" ? it.suggestedName : "venice-forge-export",
        };
      });
      return await exportMediaBatchAs({ items, ownerWindow: owner });
    } catch (err) {
      return { ok: false, canceled: false, succeeded: [], failed: [], error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:saveJsonFile", async (_event, data: unknown, defaultPath: unknown) => {
    try {
      if (typeof data !== "string") throw new Error("Export data must be a string.");
      if (Buffer.byteLength(data, "utf-8") > MAX_JSON_FILE_BYTES) {
        throw new Error("Export data is too large.");
      }
      const sanitizedFilename = path.basename(
        typeof defaultPath === "string" ? defaultPath : "venice-forge-export.json"
      );
      // verify-no-native-dialogs: allow — intentional save dialog for export
      const result = await dialog.showSaveDialog({
        title: "Export Venice Forge data",
        defaultPath: sanitizedFilename,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      await fs.writeFile(result.filePath, data, { encoding: "utf-8", mode: 0o600 });
      return { ok: true, canceled: false };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:saveYamlFile", async (_event, data: unknown, defaultPath: unknown) => {
    try {
      if (typeof data !== "string") throw new Error("Export data must be a string.");
      if (Buffer.byteLength(data, "utf-8") > MAX_JSON_FILE_BYTES) {
        throw new Error("Export data is too large.");
      }
      const sanitizedFilename = path.basename(
        typeof defaultPath === "string" ? defaultPath : "theme.yaml"
      );
      // verify-no-native-dialogs: allow — intentional save dialog for theme export
      const result = await dialog.showSaveDialog({
        title: "Export Venice Forge theme",
        defaultPath: sanitizedFilename,
        filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
      });
      if (result.canceled || !result.filePath) return { ok: false, canceled: true };
      await fs.writeFile(result.filePath, data, { encoding: "utf-8", mode: 0o600 });
      return { ok: true, canceled: false };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:loadYamlFile", async () => {
    try {
      // verify-no-native-dialogs: allow — intentional open dialog for theme import
      const result = await dialog.showOpenDialog({
        title: "Import Venice Forge theme",
        filters: [{ name: "YAML", extensions: ["yaml", "yml"] }],
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true };
      const fd = await fs.open(result.filePaths[0], "r");
      try {
        const fstat = await fd.stat();
        if (fstat.size > MAX_JSON_FILE_BYTES) {
          throw new Error("Import file is too large.");
        }
        const data = await fd.readFile({ encoding: "utf-8" });
        return { ok: true, canceled: false, data };
      } finally {
        await fd.close();
      }
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:loadJsonFile", async () => {
    try {
      // verify-no-native-dialogs: allow — intentional open dialog for data import
      const result = await dialog.showOpenDialog({
        title: "Import Venice Forge data",
        filters: [{ name: "JSON", extensions: ["json"] }],
        properties: ["openFile"],
      });
      if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true };
      const fd = await fs.open(result.filePaths[0], "r");
      try {
        const fstat = await fd.stat();
        if (fstat.size > MAX_JSON_FILE_BYTES) {
          throw new Error("Import file is too large.");
        }
        const data = await fd.readFile({ encoding: "utf-8" });
        return { ok: true, canceled: false, data };
      } finally {
        await fd.close();
      }
    } catch (err) {
      return { ok: false, canceled: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:readLocalFile", async () => {
    try {
      // verify-no-native-dialogs: allow — intentional open dialog for text attachment
      const result = await dialog.showOpenDialog({
        title: "Import text attachment",
        properties: ["openFile"],
        filters: [
          { name: "Text attachments", extensions: ["txt", "md", "json", "csv", "yaml", "yml"] },
        ],
      });
      if (result.canceled || !result.filePaths[0]) return { ok: true, canceled: true };

      const selected = result.filePaths[0];
      const base = path.basename(selected);
      if (base.startsWith(".")) return { ok: false, error: "Hidden files are not importable." };

      const ext = path.extname(base).toLowerCase();
      if (!new Set([".txt", ".md", ".json", ".csv", ".yaml", ".yml"]).has(ext)) {
        return { ok: false, error: "Unsupported attachment type." };
      }

      // Open first, then fstat the same file descriptor to prevent TOCTOU between
      // the stat and read calls (a symlink or file swap between those steps is blocked).
      const MAX_TEXT_ATTACHMENT_BYTES = 256 * 1024;
      let fh: Awaited<ReturnType<typeof fs.open>> | null = null;
      try {
        fh = await fs.open(selected, "r");
        const stat = await fh.stat();
        if (!stat.isFile()) {
          return { ok: false, error: "Not a regular file." };
        }
        if (stat.size > MAX_TEXT_ATTACHMENT_BYTES) {
          return { ok: false, error: `File too large (${stat.size} bytes). Max: ${MAX_TEXT_ATTACHMENT_BYTES} bytes.` };
        }
        const content = await fh.readFile({ encoding: "utf-8" });
        return { ok: true, content, filename: base };
      } finally {
        await fh?.close().catch(() => undefined);
      }
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  // Media Studio: read a file from an allowlisted directory (Downloads,
  // Documents, Desktop, or Pictures/Venice Forge) and return it as a
  // data URL plus metadata. The renderer uses this to import a previously
  // generated image that was not saved to IDB.
  registerIpcChannel("app:media:import", async (_event, input: unknown) => {
    try {
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Import payload must be an object." };
      }
      const record = input as Record<string, unknown>;
      const result = await importMediaFromPath({
        filePath: typeof record.filePath === "string" ? record.filePath : "",
      });
      if (!result.ok) return { ok: false, error: redactErrorMessage(result.error) };
      return {
        ok: true,
        canceled: result.canceled ?? false,
        dataUrl: result.dataUrl,
        filePath: result.filePath,
        filename: result.filename,
        bytes: result.bytes,
        contentType: result.contentType,
      };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  // Media Studio: reveal a file in the OS file manager. The path must be
  // inside one of the reveal-safe base directories (Pictures/Venice Forge,
  // Desktop, Downloads, Documents, or the userData thumb cache).
  registerIpcChannel("app:media:reveal", async (_event, input: unknown) => {
    try {
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Reveal payload must be an object." };
      }
      const record = input as Record<string, unknown>;
      const result = await revealMediaInFolder({
        filePath: typeof record.filePath === "string" ? record.filePath : "",
      });
      if (!result.ok) return { ok: false, error: redactErrorMessage(result.error) };
      return { ok: true };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  // Media Studio: filesystem metadata for a reveal-safe path. The renderer
  // uses this to display the on-disk file size / modification time and to
  // confirm the file is still present after an export.
  registerIpcChannel("app:media:meta", async (_event, input: unknown) => {
    try {
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Meta payload must be an object." };
      }
      const record = input as Record<string, unknown>;
      const result = await readMediaMeta({
        filePath: typeof record.filePath === "string" ? record.filePath : "",
      });
      if (!result.ok) return { ok: false, error: redactErrorMessage(result.error) };
      return {
        ok: true,
        filePath: result.filePath,
        bytes: result.bytes,
        mtime: result.mtime,
        isFile: result.isFile,
      };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  // Media Studio: generate (or return cached) thumbnail for a sha256-keyed
  // image. Returns a file:// URL the renderer can drop into an <img> src.
  registerIpcChannel("app:media:thumb", async (_event, input: unknown) => {
    try {
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Thumb payload must be an object." };
      }
      const record = input as Record<string, unknown>;
      const result = await generateMediaThumb({
        sha256: typeof record.sha256 === "string" ? record.sha256 : "",
        source: typeof record.source === "string" ? record.source : "",
        maxDimension: typeof record.maxDimension === "number" ? record.maxDimension : undefined,
      });
      if (!result.ok) return { ok: false, error: redactErrorMessage(result.error) };
      return { ok: true, filePath: result.filePath, url: result.url };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  // Character avatar image cache: fetch and cache a Venice character photo
  // and return a file:// URL. The renderer never loads remote URLs directly.
  registerIpcChannel("app:characterImage:get", async (_event, input: unknown) => {
    try {
      let url = "";
      if (typeof input === "string") {
        url = input;
      } else if (input && typeof input === "object") {
        const record = input as Record<string, unknown>;
        if (typeof record.url === "string") {
          url = record.url;
        }
      }
      if (!url) return { ok: false, error: "Missing image URL." };
      const result = await getCachedCharacterImage(url);
      if (!result.ok) return { ok: false, error: redactErrorMessage(result.error) };
      return { ok: true, url: result.url, contentType: result.contentType, bytes: result.bytes };
    } catch (err) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:characterImage:clearCache", async () => {
    try {
      const result = await clearCharacterImageCache();
      if (!result.ok) return { ok: false, error: redactErrorMessage(result.error) };
      return { ok: true, deletedCount: result.deletedCount };
    } catch (err) {
      return { ok: false, deletedCount: 0, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:characterImage:inventory", async () => {
    try {
      const inventory = await getCharacterImageCacheInventory();
      return { ok: true, ...inventory };
    } catch (err) {
      return { ok: false, count: 0, totalBytes: 0, error: redactErrorMessage(err) };
    }
  });

  registerIpcChannel("app:openConversationsFolder", async (event) => {
    const { getProfileConversationsDir } = await import("../../services/conversationVault");
    await shell.openPath(getProfileConversationsDir(getProfileSessionId(event.sender)));
    return { ok: true };
  });
}
