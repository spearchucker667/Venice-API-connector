export type ThemeMode = 'dark' | 'light';
export type AppearanceMode = 'dark' | 'light' | 'system';

export const THEME_FAMILY_SCHEMA_VERSION = 2 as const;

export interface LegacyThemeTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentHover: string;
  accentForeground: string;
  success: string;
  warning: string;
  danger: string;
  info: string;
  focusRing: string;
  overlay: string;
  glow: string;
}

export interface SemanticThemeTokens {
  background: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  foreground: string;
  foregroundMuted: string;
  foregroundSubtle: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentForeground: string;
  danger: string;
  dangerForeground: string;
  warning: string;
  warningForeground: string;
  success: string;
  successForeground: string;
  inputBackground: string;
  inputForeground: string;
  placeholder: string;
  disabledForeground: string;
  buttonPrimaryBackground: string;
  buttonPrimaryForeground: string;
  buttonSecondaryBackground: string;
  buttonSecondaryForeground: string;
  link: string;
  focusRing: string;
  selectionBackground: string;
  selectionForeground: string;
}

export interface ThemeTokens extends LegacyThemeTokens, SemanticThemeTokens {}

export type ThemeTokenInput = LegacyThemeTokens & Partial<SemanticThemeTokens>;

export function completeThemeTokens(mode: ThemeMode, input: ThemeTokenInput): ThemeTokens {
  const statusForeground = mode === 'light' ? '#ffffff' : input.background;
  const foreground = input.foreground ?? input.textPrimary;
  const foregroundMuted = input.foregroundMuted ?? input.textSecondary;
  const foregroundSubtle = input.foregroundSubtle ?? input.textMuted;
  return {
    ...input,
    surfaceMuted: input.surfaceMuted ?? input.surface,
    foreground,
    foregroundMuted,
    foregroundSubtle,
    borderStrong: input.borderStrong ?? input.textMuted,
    dangerForeground: input.dangerForeground ?? statusForeground,
    warningForeground: input.warningForeground ?? statusForeground,
    successForeground: input.successForeground ?? statusForeground,
    inputBackground: input.inputBackground ?? input.surfaceElevated,
    inputForeground: input.inputForeground ?? foreground,
    placeholder: input.placeholder ?? foregroundSubtle,
    disabledForeground: input.disabledForeground ?? foregroundSubtle,
    buttonPrimaryBackground: input.buttonPrimaryBackground ?? input.accent,
    buttonPrimaryForeground: input.buttonPrimaryForeground ?? input.accentForeground,
    buttonSecondaryBackground: input.buttonSecondaryBackground ?? input.surfaceElevated,
    buttonSecondaryForeground: input.buttonSecondaryForeground ?? foreground,
    link: input.link ?? input.info,
    selectionBackground: input.selectionBackground ?? input.accent,
    selectionForeground: input.selectionForeground ?? input.accentForeground,
  };
}

/**
 * Legacy single-mode runtime theme. Kept for backward compatibility with
 * existing components and persisted custom themes.
 */
export interface Theme {
  id: string;
  name: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
}

export interface ThemeState {
  selectedThemeId: string;
  appearanceMode: ThemeMode;
  customTheme: Theme | null;
  customThemes?: Theme[];
}

/**
 * A single variant (light or dark) inside a ThemeFamily.
 */
export interface ThemeVariant {
  tokens: ThemeTokens;
}

/**
 * Versioned theme family: one identity with intentional light and dark
 * variants. This is the durable, shareable unit for built-ins, custom
 * themes, and YAML themes.
 */
export interface ThemeFamily {
  schemaVersion: 2;
  id: string;
  name: string;
  variants: Record<ThemeMode, ThemeVariant>;
  aliases?: string[];
  description?: string;
  author?: string;
  builtIn?: boolean;
}

/**
 * Fully resolved runtime theme: a family + effective mode + flattened tokens.
 * This is what applyTheme consumes.
 */
export interface ResolvedTheme {
  id: string;
  name: string;
  mode: ThemeMode;
  tokens: ThemeTokens;
}
