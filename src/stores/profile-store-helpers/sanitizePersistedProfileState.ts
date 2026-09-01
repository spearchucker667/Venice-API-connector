/** @fileoverview Pure sanitizer for persisted profile state.
 *
 * The persisted profile store reads untrusted JSON from localStorage through
 * Zustand's `persist` middleware. The `merge` option runs after storage has
 * been read, so this sanitizer is the right place to validate, normalize, and
 * reject malformed persisted fields before they can become authoritative in
 * the live store.
 *
 * This module is intentionally pure (no DOM, no zustand, no module-level
 * state) so it can be unit-tested in isolation and reused by anything that
 * needs to consume a `ProfileState` payload from untrusted input.
 *
 * Replaces the older `onRehydrateStorage` sanitizer, which Zustand invokes
 * BEFORE storage hydration with the *current* state — meaning any edits the
 * callback made to the "persisted" object were operating on the wrong
 * snapshot and never established a reliable validation boundary.
 */

import {
  DEFAULT_PROFILE_ID,
} from "../../services/activeProfile";
import { isValidProfileStorageId } from "../../utils/profileIdValidation";
import type { ProfileState, UserProfile } from "../profile-store";

/** Field-by-field view of a persisted profile record. Only the keys we want
 *  to accept from untrusted storage. Anything else is dropped. */
interface PersistedUserProfile {
  id: unknown;
  name: unknown;
  avatarUrl?: unknown;
  onboardingCompleted?: unknown;
  hasPassword?: unknown;
}

/** Maximum name length we accept from persisted storage. Longer values are
 *  truncated to keep renderer + main consumers in sync with createProfile. */
const MAX_NAME_LENGTH = 200;

/** Maximum avatarUrl length we accept. URLs longer than this are dropped. */
const MAX_AVATAR_URL_LENGTH = 4096;

/** Coerces a persisted value into a valid `UserProfile`, or returns null
 *  if the value cannot be made safe. Never throws. */
function coerceUserProfile(input: unknown): UserProfile | null {
  if (!input || typeof input !== "object") return null;
  const candidate = input as PersistedUserProfile;
  if (typeof candidate.id !== "string" || !isValidProfileStorageId(candidate.id)) {
    return null;
  }
  // Treat persisted functions / class instances / arrays as non-profiles
  // even when their `id` is valid (e.g. someone replaced the field with an
  // object literal that happens to satisfy the shape).
  if (Array.isArray(input)) return null;
  const name = typeof candidate.name === "string" && candidate.name.length > 0
    ? candidate.name.slice(0, MAX_NAME_LENGTH)
    : "Profile";
  const avatarUrl = typeof candidate.avatarUrl === "string" && candidate.avatarUrl.length > 0
      && candidate.avatarUrl.length <= MAX_AVATAR_URL_LENGTH
    ? candidate.avatarUrl
    : undefined;
  return {
    id: candidate.id,
    name,
    avatarUrl,
    onboardingCompleted: candidate.onboardingCompleted === true,
    hasPassword: candidate.hasPassword === true,
  };
}

/** Returns the sanitized `profiles` array. Drops malformed entries, dedupes
 *  by id (first occurrence wins), and guarantees the reserved `default`
 *  profile is present. */
function sanitizeProfiles(input: unknown): UserProfile[] {
  const source = Array.isArray(input) ? input : [];
  const seen = new Set<string>();
  const sanitized: UserProfile[] = [];
  for (const entry of source) {
    const profile = coerceUserProfile(entry);
    if (!profile) continue;
    if (seen.has(profile.id)) continue;
    seen.add(profile.id);
    sanitized.push(profile);
  }
  const hasDefault = sanitized.some((p) => p.id === DEFAULT_PROFILE_ID);
  if (!hasDefault) {
    sanitized.unshift({
      id: DEFAULT_PROFILE_ID,
      name: "Default Profile",
      onboardingCompleted: false,
    });
  }
  return sanitized;
}

/** Returns the sanitized active profile id. Falls back to `default` when
 *  the persisted value is missing, malformed, or refers to a profile that
 *  does not exist in the sanitized profiles list. */
function sanitizeActiveProfileId(
  input: unknown,
  profiles: UserProfile[],
): string {
  if (typeof input !== "string" || !isValidProfileStorageId(input)) {
    return DEFAULT_PROFILE_ID;
  }
  return profiles.some((p) => p.id === input) ? input : DEFAULT_PROFILE_ID;
}

/** Public, pure sanitizer. Accepts the unknown value from
 *  `stateFromStorage` (the second argument to Zustand's `merge` option) and
 *  returns a partial `ProfileState` containing only the safe fields.
 *
 *  Callers must merge this into the *current* in-memory state, NOT spread
 *  the persisted object on top of the store, because this object only
 *  contains the fields we are willing to accept from untrusted input.
 *
 *  Never mutates the input. Never throws. */
export function sanitizePersistedProfileState(
  persisted: unknown,
): Pick<ProfileState, "profiles" | "activeProfileId" | "globalOnboardingCompleted"> {
  if (!persisted || typeof persisted !== "object" || Array.isArray(persisted)) {
    return {
      profiles: sanitizeProfiles(undefined),
      activeProfileId: DEFAULT_PROFILE_ID,
      globalOnboardingCompleted: false,
    };
  }
  const candidate = persisted as {
    profiles?: unknown;
    activeProfileId?: unknown;
    globalOnboardingCompleted?: unknown;
  };
  const profiles = sanitizeProfiles(candidate.profiles);
  return {
    profiles,
    activeProfileId: sanitizeActiveProfileId(candidate.activeProfileId, profiles),
    globalOnboardingCompleted: candidate.globalOnboardingCompleted === true,
  };
}

/** Convenience export for tests that want the per-field sanitizers without
 *  re-implementing them. */
export const __testing = {
  coerceUserProfile,
  sanitizeProfiles,
  sanitizeActiveProfileId,
};
