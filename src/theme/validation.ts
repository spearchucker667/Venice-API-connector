import { REQUIRED_THEME_TOKEN_KEYS } from '../config/configSchema';
import { isValidColorValue } from './validateColor';
import type { ThemeFamily, ThemeMode } from './themeTypes';

export const DANGEROUS_THEME_KEYS = new Set<string>(['__proto__', 'prototype', 'constructor']);
export const THEME_TOKEN_ALLOWLIST = new Set<string>(REQUIRED_THEME_TOKEN_KEYS);

function hasDangerousKey(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    if (DANGEROUS_THEME_KEYS.has(key)) return true;
  }
  return false;
}

function collectDangerousKeys(obj: Record<string, unknown>, prefix = ''): string[] {
  const out: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (DANGEROUS_THEME_KEYS.has(key)) {
      out.push(path);
    }
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      out.push(...collectDangerousKeys(value as Record<string, unknown>, path));
    }
  }
  return out;
}

function validateVariant(
  mode: ThemeMode,
  variant: unknown,
  path: string,
): string[] {
  const errors: string[] = [];
  if (!variant || typeof variant !== 'object' || Array.isArray(variant)) {
    return [`${path} must be an object.`];
  }
  const v = variant as Record<string, unknown>;
  if (hasDangerousKey(v)) {
    errors.push(...collectDangerousKeys(v, path));
  }
  if (!v.tokens || typeof v.tokens !== 'object' || Array.isArray(v.tokens)) {
    return [`${path}.tokens must be a mapping.`];
  }
  const tokens = v.tokens as Record<string, unknown>;
  if (hasDangerousKey(tokens)) {
    errors.push(...collectDangerousKeys(tokens, `${path}.tokens`));
  }

  for (const key of Object.keys(tokens)) {
    const normalizedKey = key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    if (!THEME_TOKEN_ALLOWLIST.has(normalizedKey)) {
      errors.push(`${path}.tokens.${key}: unknown token.`);
      continue;
    }
    const value = tokens[key];
    if (typeof value !== 'string' || !isValidColorValue(value)) {
      errors.push(`${path}.tokens.${key}: invalid color value.`);
    }
  }

  for (const req of REQUIRED_THEME_TOKEN_KEYS) {
    const found = Object.keys(tokens).some(
      (k) => k.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()) === req,
    );
    if (!found) {
      errors.push(`${path}.tokens.${req}: missing required token.`);
    }
  }

  return errors;
}

/**
 * Strictly validate a ThemeFamily-shaped object. Returns an array of human-readable
 * error messages. An empty array means the object is structurally valid.
 */
export function validateThemeFamily(value: unknown): string[] {
  const errors: string[] = [];
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return ['Theme family must be an object.'];
  }
  const family = value as Record<string, unknown>;

  if (hasDangerousKey(family)) {
    errors.push(...collectDangerousKeys(family));
  }

  if (family.schemaVersion !== 2) {
    errors.push(`schemaVersion must be 2, got ${String(family.schemaVersion)}.`);
  }

  if (typeof family.id !== 'string' || family.id.length === 0 || family.id.length > 128) {
    errors.push('id must be a non-empty string <= 128 chars.');
  } else if (!/^[A-Za-z0-9_-]+$/.test(family.id)) {
    errors.push('id must contain only letters, numbers, hyphens, and underscores.');
  }

  if (typeof family.name !== 'string' || family.name.length === 0 || family.name.length > 128) {
    errors.push('name must be a non-empty string <= 128 chars.');
  }

  if (!family.variants || typeof family.variants !== 'object' || Array.isArray(family.variants)) {
    return [...errors, 'variants must be an object with light and dark entries.'];
  }
  const variants = family.variants as Record<string, unknown>;
  if (hasDangerousKey(variants)) {
    errors.push(...collectDangerousKeys(variants, 'variants'));
  }

  errors.push(...validateVariant('light', variants.light, 'variants.light'));
  errors.push(...validateVariant('dark', variants.dark, 'variants.dark'));

  if (family.aliases !== undefined) {
    if (!Array.isArray(family.aliases)) {
      errors.push('aliases must be an array.');
    } else {
      for (let i = 0; i < family.aliases.length; i++) {
        const alias = family.aliases[i];
        if (typeof alias !== 'string' || alias.length === 0 || alias.length > 128) {
          errors.push(`aliases[${i}] must be a non-empty string <= 128 chars.`);
        } else if (!/^[A-Za-z0-9_-]+$/.test(alias)) {
          errors.push(`aliases[${i}] contains invalid characters.`);
        }
      }
    }
  }

  return errors;
}

/**
 * Type guard for a complete ThemeFamily after validation.
 */
export function isValidThemeFamily(value: unknown): value is ThemeFamily {
  return validateThemeFamily(value).length === 0;
}
