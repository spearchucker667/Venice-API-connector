import { completeThemeTokens, type Theme, type ThemeFamily, type ThemeMode } from './themeTypes';
import { isValidColorValue } from './validateColor';

/**
 * Converts a validated YAML theme entry into a runtime Theme object.
 *
 * The YAML schema already validates that all required tokens are present
 * and that colors are safe, but we remain defensive here because the
 * renderer should never trust the main process blindly.
 *
 * @param id      The theme identifier (kebab-case from YAML key).
 * @param display_name The human-readable name from YAML.
 * @param mode    'dark' or 'light'.
 * @param tokens  Record of token values (snake_case or camelCase keys).
 */
export function yamlThemeToTheme(
  id: string,
  display_name: string,
  mode: 'dark' | 'light',
  tokens: Record<string, string>
): Theme {
  const normalized: Record<string, string> = {};

  for (const [rawKey, value] of Object.entries(tokens)) {
    if (typeof value !== 'string' || !isValidColorValue(value)) {
      continue; // Skip malformed tokens defensively
    }
    // Normalize snake_case to camelCase
    const key = rawKey.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    normalized[key] = value;
  }

  return {
    id,
    name: display_name,
    mode,
    tokens: completeThemeTokens(mode, normalized as unknown as Theme['tokens']),
  };
}

/**
 * Convert a single-mode YAML theme entry into a ThemeFamily. The authored
 * mode uses the provided tokens; the companion variant reuses the same
 * tokens so the theme remains usable regardless of appearance mode.
 *
 * Theme Engine V2 YAML files should ideally ship both variants; this helper
 * preserves backward compatibility with single-mode YAML themes.
 */
export function yamlThemeToFamily(
  id: string,
  display_name: string,
  mode: ThemeMode,
  tokens: Record<string, string>
): ThemeFamily {
  const theme = yamlThemeToTheme(id, display_name, mode, tokens);
  return {
    schemaVersion: 2,
    id: theme.id,
    name: theme.name,
    aliases: [],
    builtIn: false,
    variants: {
      light: { tokens: theme.tokens },
      dark: { tokens: theme.tokens },
    },
  };
}

/**
 * Resolves a theme id against a merged registry of built-in + YAML themes.
 * Returns null when the id is not found in either registry.
 *
 * @deprecated Use the canonical theme registry in `src/theme/registry.ts`.
 */
export function findMergedTheme(
  id: string | null | undefined,
  yamlThemes: Record<string, Theme>
): Theme | null {
  if (!id) return null;
  return yamlThemes[id] ?? null;
}
