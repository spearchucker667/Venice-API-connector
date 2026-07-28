export interface ThemeOption {
  id: string;
  label: string;
}

const themeNameCollator = new Intl.Collator(undefined, {
  sensitivity: "base",
  numeric: true,
});

export function sortThemeOptions<T extends ThemeOption>(options: readonly T[]): T[] {
  return [...options].sort((a, b) => themeNameCollator.compare(a.label, b.label));
}
