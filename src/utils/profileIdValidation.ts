/** @fileoverview Central profile identifier validation.
 *
 * Profile IDs are used as namespace segments in physical storage keys:
 *   - secure-prefs.json: `apiKey_<profileId>`, `cred_profile_password:<profileId>`
 *   - localStorage: `<storeName>_<profileId>`
 *   - IndexedDB physical ids: `<profileId>:<logicalId>`
 *
 * To avoid ambiguity or collision with these separators, profile IDs are
 * restricted to a small safe alphabet and a reasonable length. Imported or
 * persisted IDs that fail validation are rejected (or replaced with a fresh
 * UUID) rather than silently used.
 */

const MAX_PROFILE_ID_LENGTH = 64;

/** Safe profile id pattern: lower-case alphanumeric + hyphen, no leading/trailing hyphen. */
const SAFE_PROFILE_ID_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Reserved ids that cannot be used for user-created profiles. */
const RESERVED_PROFILE_IDS = new Set(["default"]);

/**
 * Returns true when the id is a valid profile identifier for storage and
 * system use — including the reserved "default" system profile.
 *
 * Use this for:
 *   - Active profile read/write (localStorage)
 *   - Persisted profile hydration and migration
 *   - Physical storage key construction (IndexedDB, secure-prefs)
 *   - Profile password IPC channels
 */
export function isValidProfileStorageId(id: unknown): id is string {
  if (typeof id !== "string") return false;
  if (id.length === 0 || id.length > MAX_PROFILE_ID_LENGTH) return false;
  return SAFE_PROFILE_ID_RE.test(id);
}

/** Throws when id is not valid for storage/system use (including "default"). */
export function assertValidProfileStorageId(id: unknown): asserts id is string {
  if (typeof id !== "string" || id.length === 0) {
    throw new Error("Profile id must be a non-empty string.");
  }
  if (id.length > MAX_PROFILE_ID_LENGTH) {
    throw new Error(`Profile id must be at most ${MAX_PROFILE_ID_LENGTH} characters.`);
  }
  if (!SAFE_PROFILE_ID_RE.test(id)) {
    throw new Error(
      `Invalid profile id "${id}". Profile ids may only contain lowercase letters, numbers, and hyphens, and cannot contain storage separators such as '_', ':', or '/'.`,
    );
  }
}

/**
 * Returns true when the id is valid for a user-created profile — excludes
 * reserved system ids such as "default".
 *
 * Use this for:
 *   - Creating or importing user profiles (addProfile / import)
 */
export function isUserCreatableProfileId(id: unknown): id is string {
  return isValidProfileStorageId(id) && !RESERVED_PROFILE_IDS.has(id as string);
}

/** Throws when id is not valid for a user-created profile. */
export function assertUserCreatableProfileId(id: unknown): asserts id is string {
  assertValidProfileStorageId(id);
  if (RESERVED_PROFILE_IDS.has(id)) {
    throw new Error(`Profile id "${id}" is reserved and cannot be used for user-created profiles.`);
  }
}

/**
 * @deprecated Use `isUserCreatableProfileId` for user-created profiles, or
 * `isValidProfileStorageId` for system/storage access. This alias preserves
 * backward compatibility and maps to the user-creatable check.
 */
export const isValidProfileId = isUserCreatableProfileId;

/**
 * @deprecated Use `assertUserCreatableProfileId` for user-created profiles, or
 * `assertValidProfileStorageId` for system/storage access.
 */
export const assertValidProfileId = assertUserCreatableProfileId;

function formatUuidV4(bytes: Uint8Array): string {
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

function generateSecureUuid(): string {
  const webCrypto = globalThis.crypto;
  if (webCrypto && typeof webCrypto.randomUUID === "function") {
    return webCrypto.randomUUID();
  }
  if (webCrypto && typeof webCrypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    webCrypto.getRandomValues(bytes);
    return formatUuidV4(bytes);
  }
  throw new Error("Secure random number generation is unavailable.");
}

/** Generates a fresh profile id using a CSPRNG. Hyphens and hex digits are in the safe alphabet. */
export function generateProfileId(): string {
  return generateSecureUuid();
}
