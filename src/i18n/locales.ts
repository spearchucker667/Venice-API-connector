/**
 * @fileoverview Locale registry and fallback resolution logic.
 */

import { LOCALE_COMPLETION } from './locale-completion-status';
import type { LocaleMetadata, LocaleSetting, SupportedLocale, TextDirection } from './locale-types';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

const LOCALE_REGISTRY_BASE = {
  'en-US': { englishName: 'English (US)', dir: 'ltr' as TextDirection },
  es: { englishName: 'Spanish', dir: 'ltr' as TextDirection },
  fr: { englishName: 'French', dir: 'ltr' as TextDirection },
  de: { englishName: 'German', dir: 'ltr' as TextDirection },
  'pt-BR': { englishName: 'Portuguese (Brazil)', dir: 'ltr' as TextDirection },
  ru: { englishName: 'Russian', dir: 'ltr' as TextDirection },
  'zh-CN': { englishName: 'Simplified Chinese', dir: 'ltr' as TextDirection },
  ja: { englishName: 'Japanese', dir: 'ltr' as TextDirection },
  hi: { englishName: 'Hindi', dir: 'ltr' as TextDirection },
  ar: { englishName: 'Arabic', dir: 'rtl' as TextDirection },
  ko: { englishName: 'Korean', dir: 'ltr' as TextDirection },
  'sv-SE': { englishName: 'Swedish', dir: 'ltr' as TextDirection },
};

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleMetadata> =
  Object.fromEntries(
    (Object.entries(LOCALE_REGISTRY_BASE) as Array<
      [SupportedLocale, { englishName: string; dir: TextDirection }]
    >).map(([code, base]) => [
      code,
      {
        code,
        nativeName: LOCALE_COMPLETION[code].nativeName,
        englishName: base.englishName,
        dir: base.dir,
        isProductionComplete: LOCALE_COMPLETION[code].isProductionComplete,
      },
    ]),
  ) as Record<SupportedLocale, LocaleMetadata>;

export const SUPPORTED_LOCALE_CODES: SupportedLocale[] = Object.keys(
  SUPPORTED_LOCALES,
) as SupportedLocale[];

/**
 * Normalizes alias and legacy locale codes to canonical BCP 47 supported locale codes.
 */
export function normalizeLocaleCode(input?: string): SupportedLocale | undefined {
  if (!input) return undefined;
  const trimmed = input.trim();
  if (trimmed in SUPPORTED_LOCALES) return trimmed as SupportedLocale;

  const lower = trimmed.toLowerCase();
  const aliasMap: Record<string, SupportedLocale> = {
    en: 'en-US',
    'en-us': 'en-US',
    zh: 'zh-CN',
    'zh-cn': 'zh-CN',
    'zh-hans': 'zh-CN',
    sv: 'sv-SE',
    se: 'sv-SE',
    'sv-se': 'sv-SE',
    pt: 'pt-BR',
    'pt-br': 'pt-BR',
    es: 'es',
    fr: 'fr',
    de: 'de',
    ru: 'ru',
    ja: 'ja',
    hi: 'hi',
    ar: 'ar',
    ko: 'ko',
  };

  if (aliasMap[lower]) return aliasMap[lower];

  const prefix = lower.split('-')[0];
  if (aliasMap[prefix]) return aliasMap[prefix];

  return undefined;
}

/**
 * Resolves system browser language against supported application locales.
 */
export function resolveSystemLocale(navLanguages?: readonly string[]): SupportedLocale {
  const languages = navLanguages ?? (typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : ['en-US']);

  for (const lang of languages) {
    if (!lang) continue;
    const normalized = normalizeLocaleCode(lang);
    if (normalized) return normalized;
  }

  return DEFAULT_LOCALE;
}

/**
 * Resolves the effective SupportedLocale given a user setting (either an explicit locale or 'system').
 */
export function resolveEffectiveLocale(setting: LocaleSetting, navLanguages?: readonly string[]): SupportedLocale {
  if (setting !== 'system') {
    const normalized = normalizeLocaleCode(setting);
    if (normalized) return normalized;
  }
  return resolveSystemLocale(navLanguages);
}

/**
 * Returns text direction ('ltr' | 'rtl') for a given locale.
 */
export function getTextDirection(locale: SupportedLocale): TextDirection {
  return SUPPORTED_LOCALES[locale]?.dir ?? 'ltr';
}
