/** @fileoverview Main-process, profile/session-scoped attachment registry.
 *
 *  Chat and Document Agent share this registry so attachments have a single
 *  durable identity. The model never receives base64 bodies or local paths;
 *  it only references opaque attachmentIds that main can resolve.
 */

import { randomUUID } from "node:crypto";

const ID_RE = /^[a-zA-Z0-9_.-]{1,128}$/;
const SESSION_ID_RE = /^[a-zA-Z0-9_.:-]{1,512}$/;

export interface AttachmentRecord {
  id: string;
  profileId: string;
  sessionId: string;
  conversationId?: string;
  mimeType: string;
  displayName: string;
  sizeBytes: number;
  bodyB64: string;
  createdAt: string;
}

export interface RegisterAttachmentInput {
  profileId: string;
  sessionId: string;
  conversationId?: string;
  mimeType: string;
  displayName: string;
  bodyB64: string;
}

export class AttachmentRegistry {
  /** Maximum size for a single attachment in bytes (1 MiB). */
  static readonly MAX_BYTES = 1_048_576;

  private readonly records = new Map<string, AttachmentRecord>();

  register(input: RegisterAttachmentInput): AttachmentRecord {
    if (!ID_RE.test(input.profileId)) throw new Error("Invalid profile id.");
    if (!SESSION_ID_RE.test(input.sessionId)) throw new Error("Invalid session id.");
    if (typeof input.mimeType !== "string" || input.mimeType.length === 0 || input.mimeType.length > 255) {
      throw new Error("Invalid mimeType.");
    }
    if (typeof input.displayName !== "string" || input.displayName.length === 0 || input.displayName.length > 255) {
      throw new Error("Invalid displayName.");
    }
    const body = Buffer.from(input.bodyB64.replace(/[\r\n]/g, ""), "base64");
    if (body.byteLength === 0) throw new Error("Attachment body is empty.");
    if (body.byteLength > AttachmentRegistry.MAX_BYTES) {
      throw new Error(`Attachment exceeds ${AttachmentRegistry.MAX_BYTES}-byte limit.`);
    }
    const record: AttachmentRecord = {
      id: `att_${randomUUID()}`,
      profileId: input.profileId,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      mimeType: input.mimeType,
      displayName: input.displayName,
      sizeBytes: body.byteLength,
      bodyB64: input.bodyB64,
      createdAt: new Date().toISOString(),
    };
    this.records.set(record.id, record);
    return { ...record };
  }

  resolve(profileId: string, attachmentId: string, sessionId: string): AttachmentRecord | null {
    if (!ID_RE.test(attachmentId)) return null;
    const record = this.records.get(attachmentId);
    if (!record) return null;
    if (record.profileId !== profileId || record.sessionId !== sessionId) return null;
    return { ...record };
  }

  revoke(profileId: string, attachmentId: string, sessionId: string): boolean {
    const record = this.resolve(profileId, attachmentId, sessionId);
    if (!record) return false;
    return this.records.delete(attachmentId);
  }

  listForSession(profileId: string, sessionId: string): AttachmentRecord[] {
    return [...this.records.values()]
      .filter((record) => record.profileId === profileId && record.sessionId === sessionId)
      .map((record) => ({ ...record }));
  }
}
