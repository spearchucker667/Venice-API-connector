// @vitest-environment node

import { describe, it, expect, beforeEach } from "vitest";
import { AttachmentRegistry } from "./attachment-registry";

const VALID_PROFILE_ID = "profile_1";
const VALID_SESSION_ID = "session_abc";
const VALID_MIME_TYPE = "text/plain";
const VALID_DISPLAY_NAME = "notes.txt";
const VALID_BODY_B64 = Buffer.from("hello world").toString("base64");

describe("AttachmentRegistry", () => {
  let registry: AttachmentRegistry;

  beforeEach(() => {
    registry = new AttachmentRegistry();
  });

  describe("register", () => {
    it("returns a record with id, profileId, sessionId, sizeBytes, mimeType, displayName", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });

      expect(record).toMatchObject({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        sizeBytes: 11,
      });
      expect(typeof record.id).toBe("string");
      expect(record.id.startsWith("att_")).toBe(true);
      expect(typeof record.createdAt).toBe("string");
    });

    it("rejects an invalid profileId", () => {
      expect(() =>
        registry.register({
          profileId: "",
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid profile id.");

      expect(() =>
        registry.register({
          profileId: "profile with spaces",
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid profile id.");
    });

    it("rejects an invalid sessionId", () => {
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: "",
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid session id.");

      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: "session/with/slashes",
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid session id.");
    });

    it("rejects empty or invalid mimeType", () => {
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: "",
          displayName: VALID_DISPLAY_NAME,
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid mimeType.");

      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: 123 as unknown as string,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid mimeType.");
    });

    it("rejects an empty displayName", () => {
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: "",
          bodyB64: VALID_BODY_B64,
        }),
      ).toThrow("Invalid displayName.");
    });

    it("rejects an empty body", () => {
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: "",
        }),
      ).toThrow("Attachment body is empty.");
    });

    it("rejects a body larger than 1 MiB", () => {
      const oversized = Buffer.alloc(AttachmentRegistry.MAX_BYTES + 1).toString("base64");
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: oversized,
        }),
      ).toThrow(`Attachment exceeds ${AttachmentRegistry.MAX_BYTES}-byte limit.`);
    });

    it("rejects malformed base64", () => {
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyB64: "!@#$%^&*()",
        }),
      ).toThrow("Attachment body is empty.");
    });

    it("accepts bodyBytes (Uint8Array) directly", () => {
      const bytes = new Uint8Array(Buffer.from("hello bytes"));
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyBytes: bytes,
      });
      expect(record.sizeBytes).toBe(11);
    });

    it("rejects when both bodyBytes and bodyB64 are provided", () => {
      expect(() =>
        registry.register({
          profileId: VALID_PROFILE_ID,
          sessionId: VALID_SESSION_ID,
          mimeType: VALID_MIME_TYPE,
          displayName: VALID_DISPLAY_NAME,
          bodyBytes: new Uint8Array(Buffer.from("a")),
          bodyB64: Buffer.from("a").toString("base64"),
        }),
      ).toThrow(/not both/);
    });
  });

  describe("resolve (public record)", () => {
    it("never returns the body in the public record", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });
      const resolved = registry.resolve(VALID_PROFILE_ID, record.id, VALID_SESSION_ID);
      expect(resolved).not.toBeNull();
      // The public record must not contain any body field. This is the
      // P1-002 invariant: the renderer never receives the raw bytes.
      expect(Object.keys(resolved!)).not.toContain("body");
      expect(Object.keys(resolved!)).not.toContain("bodyB64");
      expect(Object.keys(resolved!)).not.toContain("bodyBytes");
    });
  });

  describe("resolveWithBody (main-internal accessor)", () => {
    it("returns the body buffer for main-internal callers", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });
      const internal = registry.resolveWithBody(VALID_PROFILE_ID, record.id, VALID_SESSION_ID);
      expect(internal).not.toBeNull();
      expect(internal?.body.toString("utf8")).toBe("hello world");
    });

    it("returns null for the wrong profile", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });
      expect(registry.resolveWithBody("other_profile", record.id, VALID_SESSION_ID)).toBeNull();
    });

    it("returns null for the wrong session", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });
      expect(registry.resolveWithBody(VALID_PROFILE_ID, record.id, "other_session")).toBeNull();
    });
  });

  describe("cleanup hooks", () => {
    it("revokeSession drops every record for a session", () => {
      const a = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "a.txt",
        bodyB64: VALID_BODY_B64,
      });
      const b = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "b.txt",
        bodyB64: VALID_BODY_B64,
      });
      const otherSession = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: "other_session",
        mimeType: VALID_MIME_TYPE,
        displayName: "c.txt",
        bodyB64: VALID_BODY_B64,
      });
      const removed = registry.revokeSession(VALID_PROFILE_ID, VALID_SESSION_ID);
      expect(removed).toBe(2);
      expect(registry.resolve(VALID_PROFILE_ID, a.id, VALID_SESSION_ID)).toBeNull();
      expect(registry.resolve(VALID_PROFILE_ID, b.id, VALID_SESSION_ID)).toBeNull();
      // Different session survives
      expect(registry.resolve(VALID_PROFILE_ID, otherSession.id, "other_session")).not.toBeNull();
    });

    it("revokeProfile drops every record for a profile", () => {
      registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "a.txt",
        bodyB64: VALID_BODY_B64,
      });
      registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: "other_session",
        mimeType: VALID_MIME_TYPE,
        displayName: "b.txt",
        bodyB64: VALID_BODY_B64,
      });
      const otherProfile = registry.register({
        profileId: "other_profile",
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "c.txt",
        bodyB64: VALID_BODY_B64,
      });
      const removed = registry.revokeProfile(VALID_PROFILE_ID);
      expect(removed).toBe(2);
      // Other profile survives
      expect(registry.resolve("other_profile", otherProfile.id, VALID_SESSION_ID)).not.toBeNull();
    });
  });

  describe("resolve", () => {
    it("returns the record only for exact profileId + sessionId", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });

      const resolved = registry.resolve(VALID_PROFILE_ID, record.id, VALID_SESSION_ID);
      expect(resolved).toEqual(record);
    });

    it("returns null for wrong profile", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });

      expect(registry.resolve("other_profile", record.id, VALID_SESSION_ID)).toBeNull();
    });

    it("returns null for wrong session", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });

      expect(registry.resolve(VALID_PROFILE_ID, record.id, "other_session")).toBeNull();
    });

    it("returns null for unknown id", () => {
      expect(registry.resolve(VALID_PROFILE_ID, "att_unknown", VALID_SESSION_ID)).toBeNull();
    });
  });

  describe("listForSession", () => {
    it("returns only records for the given session", () => {
      const recordA = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "a.txt",
        bodyB64: VALID_BODY_B64,
      });

      const recordB = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "b.txt",
        bodyB64: Buffer.from("b").toString("base64"),
      });

      registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: "other_session",
        mimeType: VALID_MIME_TYPE,
        displayName: "c.txt",
        bodyB64: Buffer.from("c").toString("base64"),
      });

      registry.register({
        profileId: "other_profile",
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: "d.txt",
        bodyB64: Buffer.from("d").toString("base64"),
      });

      const list = registry.listForSession(VALID_PROFILE_ID, VALID_SESSION_ID);
      expect(list).toHaveLength(2);
      expect(list.map((r) => r.id).sort()).toEqual([recordA.id, recordB.id].sort());
    });
  });

  describe("revoke", () => {
    it("deletes the record and returns true", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });

      expect(registry.revoke(VALID_PROFILE_ID, record.id, VALID_SESSION_ID)).toBe(true);
      expect(registry.resolve(VALID_PROFILE_ID, record.id, VALID_SESSION_ID)).toBeNull();
    });

    it("returns false for unknown id", () => {
      expect(registry.revoke(VALID_PROFILE_ID, "att_unknown", VALID_SESSION_ID)).toBe(false);
    });

    it("returns false for already-revoked id", () => {
      const record = registry.register({
        profileId: VALID_PROFILE_ID,
        sessionId: VALID_SESSION_ID,
        mimeType: VALID_MIME_TYPE,
        displayName: VALID_DISPLAY_NAME,
        bodyB64: VALID_BODY_B64,
      });

      registry.revoke(VALID_PROFILE_ID, record.id, VALID_SESSION_ID);
      expect(registry.revoke(VALID_PROFILE_ID, record.id, VALID_SESSION_ID)).toBe(false);
    });
  });
});
