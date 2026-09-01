import type { AppearanceMode, ThemeMode } from './themeTypes';

export interface MigratedThemeId {
  themeId: string;
  preferredMode?: ThemeMode;
}

/**
 * Map legacy per-mode theme IDs to the V2 family model.
 * Returns the family id and, when the legacy id encoded a mode, the preferred
 * mode to use for that family.
 */
export function migrateLegacyThemeId(id: string): MigratedThemeId {
  // Obsolete generic single-mode IDs map to the matching generic family.
  if (id === 'builtin-light') return { themeId: 'light', preferredMode: 'light' };
  if (id === 'builtin-dark') return { themeId: 'dark', preferredMode: 'dark' };

  // Solarized was split into two files; consolidate into the solarized family.
  if (id === 'builtin-solarized-dark') return { themeId: 'solarized', preferredMode: 'dark' };
  if (id === 'builtin-solarized-light') return { themeId: 'solarized', preferredMode: 'light' };

  // Many legacy IDs already used the family id with a "builtin-" prefix.
  if (id.startsWith('builtin-')) {
    const familyId = id.slice('builtin-'.length);
    return { themeId: familyId };
  }

  // New V2 family ids pass through unchanged.
  return { themeId: id };
}

/**
 * Coerce a persisted appearance mode value into the V2 AppearanceMode union.
 */
export function migrateAppearanceMode(value: unknown): AppearanceMode {
  if (value === 'light' || value === 'dark' || value === 'system') return value;
  return 'system';
}
