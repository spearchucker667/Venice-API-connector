/** @fileoverview Main-process, profile/session-scoped attachment registry.
 *
 *  Chat and Document Agent share this registry so attachments have a single
 *  durable identity. The model never receives base64 bodies or local paths;
 *  it only references opaque attachmentIds that main can resolve.
 *
 *  Architecture (P1-002):
 *  - The registry holds the raw bytes in a `Buffer` (typed array) in main
 *    process memory. Public reads return only metadata; the body is only
 *    exposed through the privileged main-internal accessor used by tool
 *    executors that operate entirely inside main.
 *  - The wire input shape accepts a `bodyBytes: Uint8Array` (preferred) or
 *    a `bodyB64: string` (legacy renderer-originated drag/drop transfer).
 *    Both are normalised to `Buffer` internally; the legacy field is kept
 *    only because the renderer still has to ferry drag/drop bytes through
 *    a structured-clone IPC, and base64 is the smallest portable wire
 *    encoding for that path.
 *  - Cleanup hooks (`revoke`, `revokeSession`, `revokeProfile`) drop
 *    records and any associated buffers so memory does not leak across
 *    session/profile boundaries.
 */

import { randomUUID } from "node:crypto";

const ID_RE = /^[a-zA-Z0-9_.-]{1,128}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_.:-]{1,512}$/;

/** Public, renderer-safe view of an attachment. Never includes the body. */
export interface AttachmentRecord {
  id: string;
  profileId: string;
  sessionId: string;
  conversationId?: string;
  mimeType: string;
  displayName: string;
  sizeBytes: number;
  createdAt: string;
}

/** Main-internal record that also carries the raw body buffer. */
interface InternalRecord extends AttachmentRecord {
  body: Buffer;
}

/** Wire shape accepted by `register`. */
export interface RegisterAttachmentInput {
  profileId: string;
  sessionId: string;
  conversationId?: string;
  mimeType: string;
  displayName: string;
  /**
   * Preferred: raw bytes via structured clone. Used by main-internal call
   * sites (e.g. drag-and-drop in the renderer's `File` path) where the
   * renderer can ship a `Uint8Array` directly.
   */
  bodyBytes?: Uint8Array;
  /**
   * Legacy: base64-encoded body. Kept for the renderer-originated
   * drag/drop path because it is the smallest portable structured-clone
   * encoding. The registry will reject empty / non-base64 / non-canonical
   * strings and validate the decoded byte length.
   *
   * Prefer `bodyBytes` for new call sites.
   */
  bodyB64?: string;
}

export class AttachmentRegistry {
  /** Maximum size for a single attachment in bytes (1 MiB). */
  static readonly MAX_BYTES = 1_048_576;

  private readonly records = new Map<string, InternalRecord>();

  /**
   * Registers an attachment and returns the public record (no body).
   * The body is held in-process and only exposed to main-internal callers
   * via `resolveWithBody()`.
   *
   * Validates every input field; never throws on missing optional fields,
   * but rejects empty / oversized / malformed bodies.
   */
  register(input: RegisterAttachmentInput): AttachmentRecord {
    if (!ID_RE.test(input.profileId)) throw new Error("Invalid profile id.");
    if (!SESSION_ID_RE.test(input.sessionId)) throw new Error("Invalid session id.");
    if (typeof input.mimeType !== "string" || input.mimeType.length === 0 || input.mimeType.length > 255) {
      throw new Error("Invalid mimeType.");
    }
    if (typeof input.displayName !== "string" || input.displayName.length === 0 || input.displayName.length > 255) {
      throw new Error("Invalid displayName.");
    }
    const body = this.normaliseBody(input);
    if (body.byteLength === 0) throw new Error("Attachment body is empty.");
    if (body.byteLength > AttachmentRegistry.MAX_BYTES) {
      throw new Error(`Attachment exceeds ${AttachmentRegistry.MAX_BYTES}-byte limit.`);
    }
    const record: InternalRecord = {
      id: `att_${randomUUID()}`,
      profileId: input.profileId,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      mimeType: input.mimeType,
      displayName: input.displayName,
      sizeBytes: body.byteLength,
      body,
      createdAt: new Date().toISOString(),
    };
    this.records.set(record.id, record);
    return this.toPublic(record);
  }

  /**
   * Resolves an attachment by id, scoped to (profileId, sessionId). Returns
   * the public record without the body. Use `resolveWithBody()` only from
   * main-internal code paths that legitimately need the bytes.
   */
  resolve(profileId: string, attachmentId: string, sessionId: string): AttachmentRecord | null {
    const internal = this.records.get(attachmentId);
    if (!internal) return null;
    if (internal.profileId !== profileId || internal.sessionId !== sessionId) return null;
    return this.toPublic(internal);
  }

  /**
   * Main-internal accessor: returns the full internal record including
   * the body buffer. Callers MUST be inside the main process and MUST
   * treat the body as privileged material.
   */
  resolveWithBody(profileId: string, attachmentId: string, sessionId: string): InternalRecord | null {
    const internal = this.records.get(attachmentId);
    if (!internal) return null;
    if (internal.profileId !== profileId || internal.sessionId !== sessionId) return null;
    return { ...internal, body: Buffer.from(internal.body) };
  }

  revoke(profileId: string, attachmentId: string, sessionId: string): boolean {
    const internal = this.records.get(attachmentId);
    if (!internal) return false;
    if (internal.profileId !== profileId || internal.sessionId !== sessionId) return false;
    return this.records.delete(attachmentId);
  }

  /** Drops every record owned by a given session. Used during session teardown. */
  revokeSession(profileId: string, sessionId: string): number {
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.profileId === profileId && record.sessionId === sessionId) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  /** Drops every record owned by a given profile. Used during profile deletion. */
  revokeProfile(profileId: string): number {
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.profileId === profileId) {
        this.records.delete(id);
        removed += 1;
      }
    }
    return removed;
  }

  listForSession(profileId: string, sessionId: string): AttachmentRecord[] {
    return [...this.records.values()]
      .filter((record) => record.profileId === profileId && record.sessionId === sessionId)
      .map((record) => this.toPublic(record));
  }

  /** Decodes the wire body into a Buffer. Accepts `bodyBytes` first, then
   *  the legacy `bodyB64`. Exactly one is required. */
  private normaliseBody(input: RegisterAttachmentInput): Buffer {
    if (input.bodyBytes && input.bodyB64) {
      throw new Error("Provide either bodyBytes or bodyB64, not both.");
    }
    if (input.bodyBytes) {
      return Buffer.from(input.bodyBytes);
    }
    if (typeof input.bodyB64 === "string") {
      if (input.bodyB64.length === 0) return Buffer.alloc(0);
      // Reject non-canonical base64 before Buffer.from silently drops
      // invalid characters — anything outside [A-Za-z0-9+/=] is treated
      // as malformed.
      if (!/^[A-Za-z0-9+/]*={0,2}$/.test(input.bodyB64)) {
        return Buffer.alloc(0);
      }
      return Buffer.from(input.bodyB64, "base64");
    }
    return Buffer.alloc(0);
  }

  /** Produces a renderer-safe public view by stripping the body buffer. */
  private toPublic(internal: InternalRecord): AttachmentRecord {
    return {
      id: internal.id,
      profileId: internal.profileId,
      sessionId: internal.sessionId,
      conversationId: internal.conversationId,
      mimeType: internal.mimeType,
      displayName: internal.displayName,
      sizeBytes: internal.sizeBytes,
      createdAt: internal.createdAt,
    };
  }
}

/** Re-export the internal record type for main-internal code only. */
export type { InternalRecord as InternalAttachmentRecord };
