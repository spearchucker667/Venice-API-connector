/**
 * @fileoverview Locale registry and fallback resolution logic.
 */

import type { LocaleMetadata, LocaleSetting, SupportedLocale, TextDirection } from './locale-types';

export const DEFAULT_LOCALE: SupportedLocale = 'en-US';

export const SUPPORTED_LOCALES: Record<SupportedLocale, LocaleMetadata> = {
  'en-US': {
    code: 'en-US',
    nativeName: 'English (US)',
    englishName: 'English (US)',
    dir: 'ltr',
    isProductionComplete: true,
  },
  es: {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    dir: 'ltr',
    isProductionComplete: true,
  },
  fr: {
    code: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    dir: 'ltr',
    isProductionComplete: true,
  },
  de: {
    code: 'de',
    nativeName: 'Deutsch',
    englishName: 'German',
    dir: 'ltr',
    isProductionComplete: true,
  },
  'pt-BR': {
    code: 'pt-BR',
    nativeName: 'Português (Brasil)',
    englishName: 'Portuguese (Brazil)',
    dir: 'ltr',
    isProductionComplete: true,
  },
  ru: {
    code: 'ru',
    nativeName: 'Русский',
    englishName: 'Russian',
    dir: 'ltr',
    isProductionComplete: true,
  },
  'zh-CN': {
    code: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Simplified Chinese',
    dir: 'ltr',
    isProductionComplete: true,
  },
  ja: {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    dir: 'ltr',
    isProductionComplete: true,
  },
  hi: {
    code: 'hi',
    nativeName: 'हिन्दी',
    englishName: 'Hindi',
    dir: 'ltr',
    isProductionComplete: true,
  },
  ar: {
    code: 'ar',
    nativeName: 'العربية',
    englishName: 'Arabic',
    dir: 'rtl',
    isProductionComplete: true,
  },
  ko: {
    code: 'ko',
    nativeName: '한국어',
    englishName: 'Korean',
    dir: 'ltr',
    isProductionComplete: true,
  },
  'sv-SE': {
    code: 'sv-SE',
    nativeName: 'Svenska',
    englishName: 'Swedish',
    dir: 'ltr',
    isProductionComplete: true,
  },
};

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
