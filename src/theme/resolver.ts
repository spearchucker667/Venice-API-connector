import { completeThemeTokens } from './themeTypes';
import { completeCodeThemeConfig } from './codeSyntax';
import type { AppearanceMode, ResolvedTheme, ThemeFamily, ThemeMode } from './themeTypes';

export function getSystemThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

/**
 * Resolve a ThemeFamily + appearance preference into a concrete runtime theme.
 * The returned `id` is the family id; mode is the effective variant.
 */
export function resolveTheme(
  family: ThemeFamily,
  appearanceMode: AppearanceMode,
  systemAppearance?: ThemeMode,
): ResolvedTheme {
  const effectiveMode: ThemeMode =
    appearanceMode === 'system' ? (systemAppearance ?? getSystemThemeMode()) : appearanceMode;
  const variant = family.variants[effectiveMode];
  const tokens = completeThemeTokens(effectiveMode, variant.tokens);
  const code = completeCodeThemeConfig(
    effectiveMode,
    variant.code,
    { mode: effectiveMode, tokens },
  );
  return {
    id: family.id,
    name: family.name,
    mode: effectiveMode,
    tokens,
    code,
  };
}
