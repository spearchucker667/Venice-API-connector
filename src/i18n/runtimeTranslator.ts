/**
 * Locale-aware translation boundary for renderer services and stores.
 *
 * This module deliberately imports only the i18next singleton. It remains safe
 * for shared modules compiled by the Electron TypeScript project and returns
 * the supplied English fallback when i18next has not been initialized.
 */
import i18n from 'i18next';

export type RuntimeTranslationValues = Record<string, unknown>;

export function translateRuntime(
  key: string,
  defaultValue: string,
  values: RuntimeTranslationValues = {},
): string {
  return i18n.t(key, {
    ns: 'common',
    defaultValue,
    ...values,
  });
}
