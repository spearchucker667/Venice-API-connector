// @vitest-environment node
import { describe, it, expect } from "vitest";
import { sanitizePersistedProfileState } from "./sanitizePersistedProfileState";
import { isValidProfileStorageId } from "../../utils/profileIdValidation";

describe("sanitizePersistedProfileState", () => {
  it("returns a single default profile for non-object input", () => {
    for (const input of [undefined, null, 0, "string", true, [], 42]) {
      const safe = sanitizePersistedProfileState(input);
      expect(safe.profiles).toHaveLength(1);
      expect(safe.profiles[0].id).toBe("default");
      expect(safe.activeProfileId).toBe("default");
      expect(safe.globalOnboardingCompleted).toBe(false);
    }
  });

  it("preserves the reserved default profile when missing from a valid list", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [{ id: "work", name: "Work" }],
      activeProfileId: "work",
    });
    expect(safe.profiles.map((p) => p.id)).toEqual(["default", "work"]);
    expect(safe.activeProfileId).toBe("work");
  });

  it("drops profile entries with invalid ids", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [
        { id: "default", name: "Default" },
        { id: "bad_id", name: "BadUnderscore" },
        { id: "../etc/passwd", name: "PathTraversal" },
        { id: "Default", name: "WrongCase" }, // uppercase not in safe alphabet
        { id: "a".repeat(80), name: "TooLong" },
        { id: "", name: "Empty" },
        { id: 123, name: "Numeric" },
        { id: null, name: "Null" },
      ],
      activeProfileId: "bad_id",
    });
    expect(safe.profiles).toHaveLength(1);
    expect(safe.profiles[0].id).toBe("default");
    expect(safe.activeProfileId).toBe("default");
  });

  it("deduplicates profile entries deterministically (first wins)", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [
        { id: "work", name: "First" },
        { id: "work", name: "Second" },
        { id: "work", name: "Third" },
      ],
      activeProfileId: "work",
    });
    expect(safe.profiles).toHaveLength(2);
    expect(safe.profiles.find((p) => p.id === "work")?.name).toBe("First");
  });

  it("falls back to default when active profile id refers to a non-existent profile", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [{ id: "work", name: "Work" }],
      activeProfileId: "ghost",
    });
    expect(safe.activeProfileId).toBe("default");
  });

  it("falls back to default when active profile id is malformed", () => {
    for (const malformed of [null, undefined, 42, "", "bad_id", "../etc", true, false, [], {}]) {
      const safe = sanitizePersistedProfileState({
        profiles: [{ id: "default", name: "Default" }],
        activeProfileId: malformed,
      });
      expect(safe.activeProfileId).toBe("default");
    }
  });

  it("does not mutate the input object", () => {
    const input = {
      profiles: [
        { id: "default", name: "Default" },
        { id: "evil", name: "Evil" },
      ],
      activeProfileId: "evil",
      profilesShouldStayIntact: true,
      attackerSuppliedField: "innocuous",
    };
    const snapshot = JSON.stringify(input);
    sanitizePersistedProfileState(input);
    expect(JSON.stringify(input)).toBe(snapshot);
    expect(input.profiles).toHaveLength(2);
    expect(input.activeProfileId).toBe("evil");
  });

  it("ignores non-primitive metadata on profile entries (no name, wrong types, etc.)", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [
        { id: "default" }, // no name
        { id: "work", name: 42 }, // wrong type for name
        { id: "play", avatarUrl: "https://example.com/a.png", hasPassword: 1 },
        { id: "extra", name: "OK", onboardingCompleted: "yes" },
      ],
    });
    expect(safe.profiles.length).toBeGreaterThanOrEqual(3);
    const work = safe.profiles.find((p) => p.id === "work");
    expect(work).toBeDefined();
    expect(work?.name).toBe("Profile");
    const play = safe.profiles.find((p) => p.id === "play");
    expect(play).toBeDefined();
    // Empty name is replaced with the default "Profile" placeholder; a
    // non-empty avatarUrl still survives; hasPassword coerces truthy to
    // false unless literally `true` (a defensive default for a value that
    // could be tampered with).
    expect(play?.name).toBe("Profile");
    expect(play?.avatarUrl).toBe("https://example.com/a.png");
    expect(play?.hasPassword).toBe(false);
    const extra = safe.profiles.find((p) => p.id === "extra");
    expect(extra?.onboardingCompleted).toBe(false);
  });

  it("truncates absurdly long name and avatarUrl values", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [
        { id: "default", name: "Default" },
        {
          id: "work",
          name: "x".repeat(5000),
          avatarUrl: "https://example.com/" + "y".repeat(5000),
        },
      ],
    });
    const work = safe.profiles.find((p) => p.id === "work");
    expect(work?.name.length).toBeLessThanOrEqual(200);
    expect(work?.avatarUrl).toBeUndefined();
  });

  it("treats arrays-as-profile as non-objects and drops them", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [["default"], ["work"]],
      activeProfileId: "default",
    });
    expect(safe.profiles.map((p) => p.id)).toEqual(["default"]);
  });

  it("valid multi-profile state survives intact", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [
        { id: "default", name: "Default", onboardingCompleted: true },
        { id: "work", name: "Work", hasPassword: true, avatarUrl: "https://example.com/a.png" },
        { id: "play", name: "Play" },
      ],
      activeProfileId: "work",
      globalOnboardingCompleted: true,
    });
    expect(safe.profiles).toHaveLength(3);
    expect(safe.activeProfileId).toBe("work");
    const work = safe.profiles.find((p) => p.id === "work");
    expect(work?.hasPassword).toBe(true);
    expect(work?.avatarUrl).toBe("https://example.com/a.png");
    expect(safe.globalOnboardingCompleted).toBe(true);
  });

  it("accepts only a literal true onboarding-completion flag", () => {
    expect(sanitizePersistedProfileState({ globalOnboardingCompleted: true }).globalOnboardingCompleted).toBe(true);
    for (const value of [false, "true", 1, {}, [], null, undefined]) {
      expect(
        sanitizePersistedProfileState({ globalOnboardingCompleted: value }).globalOnboardingCompleted,
      ).toBe(false);
    }
  });

  it("every returned profile id is itself a valid storage id", () => {
    const safe = sanitizePersistedProfileState({
      profiles: [
        { id: "default", name: "Default" },
        { id: "work-2026", name: "Work" },
        { id: "play 2026", name: "Spaces" },
        { id: "ok", name: "ok" },
      ],
    });
    for (const profile of safe.profiles) {
      expect(isValidProfileStorageId(profile.id)).toBe(true);
    }
  });
});
