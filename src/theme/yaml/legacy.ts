import {
  completeThemeTokens,
  type Theme,
  type ThemeFamily,
  type ThemeMode,
  type ThemeTokenInput,
} from '../themeTypes';
import { completeCodeThemeConfig } from '../codeSyntax';
import { isValidColorValue } from '../validateColor';
import { luminance } from '../contrast';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeTokenKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function validateAndNormalizeTokens(
  mode: ThemeMode,
  raw: unknown,
  fallback: Record<string, string>,
): Record<string, string> {
  if (!isRecord(raw)) {
    throw new Error('Invalid theme yaml: tokens must be a mapping.');
  }
  const merged: Record<string, string> = { ...fallback };
  for (const [rawKey, value] of Object.entries(raw)) {
    const key = normalizeTokenKey(rawKey);
    if (typeof value !== 'string' || !isValidColorValue(value)) {
      throw new Error(`Invalid color value for theme token ${rawKey}.`);
    }
    merged[key] = value;
  }
  return merged;
}

function legacyFallbackTokens(mode: ThemeMode): Record<string, string> {
  // These are only used when a legacy V1 themes block omits tokens; the
  // caller normally provides a full fallback theme from the registry.
  return mode === 'light'
    ? {
        background: '#ffffff',
        surface: '#f6f8fa',
        surfaceElevated: '#fcfcfc',
        border: '#d0d7de',
        textPrimary: '#1f2328',
        textSecondary: '#57606a',
        textMuted: '#656d76',
        accent: '#0969da',
        accentHover: '#0860ca',
        accentForeground: '#ffffff',
        success: '#1a7f37',
        warning: '#7a5200',
        danger: '#cf222e',
        info: '#0969da',
        focusRing: '#0969da',
        overlay: 'rgba(0, 0, 0, 0.4)',
        glow: 'rgba(9, 105, 218, 0.18)',
      }
    : {
        background: '#0a0a0a',
        surface: '#141414',
        surfaceElevated: '#1e1e1e',
        border: '#2a2a2a',
        textPrimary: '#f0f0f0',
        textSecondary: '#b0b0b0',
        textMuted: '#808080',
        accent: '#5c7cfa',
        accentHover: '#748ffc',
        accentForeground: '#0a0a0a',
        success: '#51cf66',
        warning: '#ffd43b',
        danger: '#ff6b6b',
        info: '#74c0fc',
        focusRing: '#5c7cfa',
        overlay: 'rgba(0, 0, 0, 0.6)',
        glow: 'rgba(92, 124, 250, 0.25)',
      };
}

function themeToFamily(theme: Theme): ThemeFamily {
  const code = theme.code ?? completeCodeThemeConfig(theme.mode, undefined, { mode: theme.mode, tokens: theme.tokens });
  return {
    schemaVersion: 2,
    id: theme.id,
    name: theme.name,
    aliases: [],
    builtIn: false,
    variants: {
      light: { tokens: theme.tokens, code },
      dark: { tokens: theme.tokens, code },
    },
  };
}

/**
 * Convert a legacy V1 `themes.<name>` entry into a ThemeFamily.
 * The authored mode is preserved; the companion variant reuses the same tokens
 * so the theme remains usable regardless of appearance mode.
 */
export function parseV1ThemeEntry(
  id: string,
  entry: unknown,
  _fallbackMode: ThemeMode = 'dark',
): ThemeFamily {
  if (!isRecord(entry)) {
    throw new Error(`Invalid theme yaml: theme entry "${id}" must be an object.`);
  }
  const mode: ThemeMode = entry.mode === 'light' ? 'light' : 'dark';
  const displayName =
    typeof entry.display_name === 'string' && entry.display_name.trim()
      ? entry.display_name.trim()
      : id;
  const fallback = legacyFallbackTokens(mode);
  const normalized = validateAndNormalizeTokens(mode, entry.tokens, fallback);
  const tokens = completeThemeTokens(mode, normalized as unknown as ThemeTokenInput);
  const theme: Theme = {
    id,
    name: displayName,
    mode,
    tokens,
    code: completeCodeThemeConfig(mode, undefined, { mode, tokens }),
  };
  return themeToFamily(theme);
}

/**
 * Convert a legacy flat terminal-color theme document into a ThemeFamily.
 * This preserves the historical import path for terminal-color YAML files.
 */
export function parseFlatTheme(raw: Record<string, unknown>): ThemeFamily {
  const background =
    typeof raw.background === 'string' ? raw.background : null;
  const foreground =
    typeof raw.foreground === 'string' ? raw.foreground : null;
  const accent = typeof raw.accent === 'string' ? raw.accent : null;
  const details = typeof raw.details === 'string' ? raw.details : null;

  if (!background || !foreground || !accent) {
    throw new Error(
      'Invalid theme yaml: expected a themes block or legacy background/foreground/accent fields.',
    );
  }
  if (![background, foreground, accent].every(isValidColorValue)) {
    throw new Error('Invalid theme yaml: legacy color fields contain an unsafe value.');
  }

  const detailsIsColor = details !== null && isValidColorValue(details);
  const rawName =
    typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : null;
  const name =
    rawName ||
    (detailsIsColor || !details ? 'Imported Theme' : (details as string));

  const inferredMode: ThemeMode = luminance(background) > 0.5 ? 'light' : 'dark';
  const mode: ThemeMode =
    raw.mode === 'light' || raw.mode === 'dark' ? raw.mode : inferredMode;

  const terminal = isRecord(raw.terminal_colors) ? raw.terminal_colors : {};
  const bright = isRecord(terminal.bright) ? terminal.bright : {};
  const normal = isRecord(terminal.normal) ? terminal.normal : {};
  const color = (
    record: Record<string, unknown>,
    key: string,
    fallback: string,
  ): string =>
    typeof record[key] === 'string' && isValidColorValue(record[key])
      ? (record[key] as string)
      : fallback;

  const surfaceFallback =
    detailsIsColor && details ? details : color(normal, 'black', background);
  const surfaceElevatedFallback =
    detailsIsColor && details ? details : color(bright, 'black', background);
  const borderFallback =
    detailsIsColor && details ? details : color(normal, 'white', foreground);
  const accentForeground = luminance(accent) > 0.5 ? foreground : background;

  const legacy: ThemeTokenInput = {
    background,
    surface: surfaceFallback,
    surfaceElevated: surfaceElevatedFallback,
    border: borderFallback,
    textPrimary: foreground,
    textSecondary: color(normal, 'white', foreground),
    textMuted: color(bright, 'black', foreground),
    accent,
    accentHover: color(bright, 'blue', accent),
    accentForeground,
    success: color(bright, 'green', '#74d66a'),
    warning: color(bright, 'yellow', '#d6a84f'),
    danger: color(bright, 'red', '#ef4444'),
    info: color(bright, 'cyan', '#7da7ff'),
    focusRing: accent,
    overlay: mode === 'light' ? 'rgba(0, 0, 0, 0.25)' : 'rgba(0, 0, 0, 0.6)',
    glow: `${accent}25`,
  };

  const tokens = completeThemeTokens(mode, legacy);
  const theme: Theme = {
    id: `custom-${Date.now()}`,
    name,
    mode,
    tokens,
    code: completeCodeThemeConfig(mode, undefined, { mode, tokens }),
  };
  return themeToFamily(theme);
}

/** Convert a legacy V1 `themes:` mapping into a single ThemeFamily. */
export function parseV1ThemesBlock(raw: Record<string, unknown>): ThemeFamily {
  if (!isRecord(raw.themes)) {
    throw new Error('Invalid theme yaml: themes must be a mapping.');
  }
  const entries = Object.entries(raw.themes);
  if (entries.length === 0) {
    throw new Error('Invalid theme yaml: themes block is empty.');
  }
  const [id, entry] = entries[0];
  return parseV1ThemeEntry(id, entry);
}
