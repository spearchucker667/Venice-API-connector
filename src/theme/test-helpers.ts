import type { Theme, ThemeFamily, ThemeMode } from "./themeTypes";

/**
 * Convert a ThemeFamily to a single-mode Theme for component tests and previews.
 */
export function familyToTheme(
  family: ThemeFamily,
  mode: ThemeMode = "dark",
): Theme {
  return {
    id: family.id,
    name: family.name,
    mode,
    tokens: family.variants[mode].tokens,
    code: family.variants[mode].code,
  };
}
