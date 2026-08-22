/**
 * @fileoverview Deterministic canonicalization helper for Venice request objects.
 * Produces a stable, reproducible serialization for payload hashing.
 */

export function canonicalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalizeValue);
  }
  if (typeof value === 'object') {
    const sortedKeys = Object.keys(value as Record<string, unknown>).sort();
    const result: Record<string, unknown> = {};
    for (const key of sortedKeys) {
      const val = (value as Record<string, unknown>)[key];
      if (val !== undefined) {
        result[key] = canonicalizeValue(val);
      }
    }
    return result;
  }
  return String(value);
}

export function canonicalizeJson(value: unknown): string {
  const canonical = canonicalizeValue(value);
  return JSON.stringify(canonical);
}
