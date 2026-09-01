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
 *  - Cleanup hooks (`revoke`, `revokeSession`, `revokeProfile`,
 *    `revokeRendererSession`) drop records and any associated buffers so
 *    memory does not leak across session/profile boundaries.
 *
 *  Hardening (P2-001):
 *  - Aggregate memory budgets are enforced before any allocation:
 *    total, per-profile, and per-session byte limits plus a global record
 *    count cap. Exceeding any budget rejects the registration.
 *  - TTL/age-based eviction removes stale records on register and metrics
 *    reads; explicit `evictExpired()` is also available for lifecycle hooks.
 *  - Content-free metrics (`recordCount`, `aggregateBytes`, `profileCount`,
 *    `oldestRecordAgeMs`) expose only safe shape/size information.
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
  createdAtMs: number;
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

/** Content-free metrics about the registry. No profile names or bodies. */
export interface AttachmentRegistryMetrics {
  /** Number of live records. */
  recordCount: number;
  /** Sum of live record bodies in bytes. */
  aggregateBytes: number;
  /** Number of distinct profiles owning live records. */
  profileCount: number;
  /** Age of the oldest live record in milliseconds, or null when empty. */
  oldestRecordAgeMs: number | null;
}

/** Optional runtime budget overrides. Defaults are production conservative. */
export interface AttachmentRegistryBudgets {
  maxTotalBytes?: number;
  maxBytesPerProfile?: number;
  maxBytesPerSession?: number;
  maxRecords?: number;
  defaultTtlMs?: number;
}

export class AttachmentRegistry {
  /** Maximum size for a single attachment in bytes (1 MiB). */
  static readonly MAX_BYTES = 1_048_576;

  /** Default total memory budget across all profiles/sessions (64 MiB). */
  static readonly MAX_TOTAL_BYTES = 64 * 1_048_576;

  /** Default per-profile memory budget (16 MiB). */
  static readonly MAX_BYTES_PER_PROFILE = 16 * 1_048_576;

  /** Default per-session memory budget (8 MiB). */
  static readonly MAX_BYTES_PER_SESSION = 8 * 1_048_576;

  /** Default maximum number of live records. */
  static readonly MAX_RECORDS = 10_000;

  /** Default TTL before a record is treated as expired (30 minutes). */
  static readonly DEFAULT_TTL_MS = 30 * 60 * 1000;

  private readonly records = new Map<string, InternalRecord>();
  private readonly maxTotalBytes: number;
  private readonly maxBytesPerProfile: number;
  private readonly maxBytesPerSession: number;
  private readonly maxRecords: number;
  private readonly defaultTtlMs: number;

  private totalBytes = 0;
  private totalRecords = 0;
  private readonly profileBytes = new Map<string, number>();
  private readonly sessionBytes = new Map<string, number>();

  constructor(budgets: AttachmentRegistryBudgets = {}) {
    this.maxTotalBytes = budgets.maxTotalBytes ?? AttachmentRegistry.MAX_TOTAL_BYTES;
    this.maxBytesPerProfile = budgets.maxBytesPerProfile ?? AttachmentRegistry.MAX_BYTES_PER_PROFILE;
    this.maxBytesPerSession = budgets.maxBytesPerSession ?? AttachmentRegistry.MAX_BYTES_PER_SESSION;
    this.maxRecords = budgets.maxRecords ?? AttachmentRegistry.MAX_RECORDS;
    this.defaultTtlMs = budgets.defaultTtlMs ?? AttachmentRegistry.DEFAULT_TTL_MS;
  }

  /**
   * Registers an attachment and returns the public record (no body).
   * The body is held in-process and only exposed to main-internal callers
   * via `resolveWithBody()`.
   *
   * Validates every input field; never throws on missing optional fields,
   * but rejects empty / oversized / malformed bodies. Rejects before
   * allocation when aggregate budgets would be exceeded.
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

    // Evict expired records before considering the new allocation so stale
    // data does not block legitimate new attachments.
    this.evictExpired(this.defaultTtlMs);

    if (this.totalRecords >= this.maxRecords) {
      throw new Error("Attachment registry record limit reached.");
    }

    const profileKey = input.profileId;
    const sessionKey = input.sessionId;
    const profileTotal = (this.profileBytes.get(profileKey) ?? 0) + body.byteLength;
    const sessionTotal = (this.sessionBytes.get(sessionKey) ?? 0) + body.byteLength;
    const aggregateTotal = this.totalBytes + body.byteLength;

    if (aggregateTotal > this.maxTotalBytes) {
      throw new Error("Attachment registry total byte budget exceeded.");
    }
    if (profileTotal > this.maxBytesPerProfile) {
      throw new Error("Attachment registry profile byte budget exceeded.");
    }
    if (sessionTotal > this.maxBytesPerSession) {
      throw new Error("Attachment registry session byte budget exceeded.");
    }

    const createdAtMs = Date.now();
    const record: InternalRecord = {
      id: `att_${randomUUID()}`,
      profileId: input.profileId,
      sessionId: input.sessionId,
      conversationId: input.conversationId,
      mimeType: input.mimeType,
      displayName: input.displayName,
      sizeBytes: body.byteLength,
      body,
      createdAt: new Date(createdAtMs).toISOString(),
      createdAtMs,
    };
    this.records.set(record.id, record);
    this.increment(record);
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
    this.records.delete(attachmentId);
    this.decrement(internal);
    return true;
  }

  /** Drops every record owned by a given session. Used during session teardown. */
  revokeSession(profileId: string, sessionId: string): number {
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.profileId === profileId && record.sessionId === sessionId) {
        this.records.delete(id);
        this.decrement(record);
        removed += 1;
      }
    }
    return removed;
  }

  /**
   * Drops every record for a renderer sender, scoped to a profile. This is
   * the lifecycle hook for renderer reload/crash/close and profile switch,
   * where the exact agent-session suffix may not be known.
   */
  revokeRendererSession(runtimeSessionId: string, profileId: string, senderId: number): number {
    const prefix = `${runtimeSessionId}:renderer_${senderId}`;
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.profileId === profileId && record.sessionId.startsWith(prefix)) {
        this.records.delete(id);
        this.decrement(record);
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
        this.decrement(record);
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

  /** Removes records older than `maxAgeMs`. Returns the number evicted. */
  evictExpired(maxAgeMs = this.defaultTtlMs): number {
    const cutoff = Date.now() - maxAgeMs;
    let removed = 0;
    for (const [id, record] of this.records) {
      if (record.createdAtMs <= cutoff) {
        this.records.delete(id);
        this.decrement(record);
        removed += 1;
      }
    }
    return removed;
  }

  /** Returns content-free metrics about the registry. */
  getMetrics(): AttachmentRegistryMetrics {
    // Ensure metrics reflect only live records.
    this.evictExpired(this.defaultTtlMs);
    let oldestRecordAgeMs: number | null = null;
    const now = Date.now();
    for (const record of this.records.values()) {
      const age = now - record.createdAtMs;
      if (oldestRecordAgeMs === null || age > oldestRecordAgeMs) {
        oldestRecordAgeMs = age;
      }
    }
    return {
      recordCount: this.totalRecords,
      aggregateBytes: this.totalBytes,
      profileCount: this.profileBytes.size,
      oldestRecordAgeMs,
    };
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
    const { body: _body, createdAtMs: _createdAtMs, ...publicRecord } = internal;
    return publicRecord;
  }

  private increment(record: InternalRecord): void {
    this.totalBytes += record.sizeBytes;
    this.totalRecords += 1;
    this.profileBytes.set(record.profileId, (this.profileBytes.get(record.profileId) ?? 0) + record.sizeBytes);
    this.sessionBytes.set(record.sessionId, (this.sessionBytes.get(record.sessionId) ?? 0) + record.sizeBytes);
  }

  private decrement(record: InternalRecord): void {
    this.totalBytes = Math.max(0, this.totalBytes - record.sizeBytes);
    this.totalRecords = Math.max(0, this.totalRecords - 1);
    const profileTotal = (this.profileBytes.get(record.profileId) ?? 0) - record.sizeBytes;
    if (profileTotal <= 0) {
      this.profileBytes.delete(record.profileId);
    } else {
      this.profileBytes.set(record.profileId, profileTotal);
    }
    const sessionTotal = (this.sessionBytes.get(record.sessionId) ?? 0) - record.sizeBytes;
    if (sessionTotal <= 0) {
      this.sessionBytes.delete(record.sessionId);
    } else {
      this.sessionBytes.set(record.sessionId, sessionTotal);
    }
  }
}

/** Re-export the internal record type for main-internal code only. */
export type { InternalRecord as InternalAttachmentRecord };
