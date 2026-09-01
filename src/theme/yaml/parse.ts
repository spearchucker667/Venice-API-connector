import { parse as parseYaml } from 'yaml';
import type { ThemeFamily } from '../themeTypes';
import { validateRawThemeYaml } from './validate';
import { normalizeThemeFamilyYaml } from './normalize';
import { parseFlatTheme, parseV1ThemesBlock } from './legacy';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export interface ParseThemeYamlOptions {
  /** IDs that cannot be used by a user-provided theme (e.g. built-ins). */
  protectedIds?: Set<string>;
}

/**
 * Parse a theme YAML string and return a canonical ThemeFamily.
 *
 * Supports:
 *   - Theme Engine V2 schema (`schemaVersion: 2`, variants, optional base)
 *   - Legacy V1 `themes:` block
 *   - Legacy flat terminal-color format
 *
 * Invalid YAML fails atomically with an actionable error message. Callers
 * should catch the error and leave the active theme unchanged.
 */
export function parseThemeYaml(
  yamlString: string,
  options: ParseThemeYamlOptions = {},
): ThemeFamily {
  let raw: unknown;
  try {
    raw = parseYaml(yamlString);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid theme yaml: ${message}`);
  }

  if (!isRecord(raw)) {
    throw new Error('Invalid theme yaml: root must be a mapping.');
  }

  if (raw.schemaVersion === 2) {
    const errors = validateRawThemeYaml(raw, { protectedIds: options.protectedIds });
    if (errors.length > 0) {
      throw new Error(`Invalid theme yaml:\n${errors.join('\n')}`);
    }
    return normalizeThemeFamilyYaml(raw);
  }

  if ('themes' in raw) {
    return parseV1ThemesBlock(raw);
  }

  return parseFlatTheme(raw);
}
