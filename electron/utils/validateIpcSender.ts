/** @fileoverview Central IPC sender-validation primitive.
 *
 *  Privileged IPC handlers must reject invocations from frames that are not
 *  part of the trusted Venice Forge renderer. In development the only trusted
 *  origin is the Vite dev server. In packaged production only file:// URLs
 *  inside the packaged renderer root are trusted.
 */

import { app, type IpcMainInvokeEvent } from "electron";
import path from "path";
import { fileURLToPath } from "url";
import { checkPathContained } from "./navigation";

/** Vite dev-server origin used by the main process in development. */
const DEV_TRUSTED_ORIGIN = "http://localhost:5173";

let additionalTrustedOrigins: string[] = [];

/** Optional renderer root override for unit tests. Not exposed to the renderer. */
let rendererRootForTesting: string | undefined;

/** Adds trusted origins for unit tests. This does not mutate the internal
 *  validation rules; it only expands the allowlist for the current process.
 *  It is not exposed to the renderer. */
export function setTrustedIpcOriginsForTesting(origins: string[]): void {
  additionalTrustedOrigins = [...origins];
}

/** Overrides the packaged renderer root for unit tests. Not exposed to the
 *  renderer. Pass `undefined` to restore the production default. */
export function setRendererRootForTesting(root: string | undefined): void {
  rendererRootForTesting = root;
}

/** Returns the sender URL, preferring the specific frame that emitted the
 *  invoke and falling back to the top-level WebContents URL. */
function getSenderUrl(event: IpcMainInvokeEvent | null | undefined): string | undefined {
  if (!event) return undefined;
  const frameUrl = event.senderFrame?.url;
  if (typeof frameUrl === "string" && frameUrl.length > 0) {
    return frameUrl;
  }
  try {
    return event.sender?.getURL();
  } catch {
    return undefined;
  }
}

/** True if the hostname belongs to a loopback, link-local, or RFC1918 address. */
function isPrivateHostname(hostname: string): boolean {
  const lower = hostname.toLowerCase();
  if (lower === "localhost" || lower === "127.0.0.1" || lower === "::1") {
    return true;
  }

  const parts = lower.split(".");
  if (parts.length === 4 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1])) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (a === 10) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }

  // IPv6 unique-local / link-local
  if (lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:")) {
    return true;
  }

  return false;
}

/** True when the IPC event was emitted by a trusted renderer frame. */
export function isTrustedIpcSender(event: IpcMainInvokeEvent | null | undefined): boolean {
  const senderUrl = getSenderUrl(event);
  if (!senderUrl) return false;

  // Testing hook: exact-origin allowlist. Not reachable from the renderer.
  if (additionalTrustedOrigins.includes(senderUrl)) return true;

  let parsed: URL;
  try {
    parsed = new URL(senderUrl);
  } catch {
    return false;
  }

  if (app.isPackaged === false) {
    // Development: only the Vite dev server is trusted. Reject file://,
    // data:, other http/https origins, and loopback aliases.
    return parsed.origin === DEV_TRUSTED_ORIGIN;
  }

  // Production: only packaged renderer file:// URLs are trusted.
  if (parsed.protocol !== "file:") return false;

  // Reject file://localhost and any non-empty private hostname.
  if (parsed.hostname && isPrivateHostname(parsed.hostname)) return false;

  const rendererRoot = rendererRootForTesting ?? path.resolve(__dirname, "../../dist");
  try {
    const filePath = fileURLToPath(parsed);
    return checkPathContained(filePath, rendererRoot);
  } catch {
    return false;
  }
}

/** Throws a clear error when the sender is not trusted. */
export function validateIpcSender(event: IpcMainInvokeEvent | null | undefined): void {
  if (!isTrustedIpcSender(event)) {
    throw new Error("Untrusted IPC sender rejected.");
  }
}
