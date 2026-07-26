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
};

export const SUPPORTED_LOCALE_CODES: SupportedLocale[] = Object.keys(
  SUPPORTED_LOCALES,
) as SupportedLocale[];

/**
 * Resolves system browser language against supported application locales.
 */
export function resolveSystemLocale(navLanguages?: readonly string[]): SupportedLocale {
  const languages = navLanguages ?? (typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : ['en-US']);

  for (const lang of languages) {
    if (!lang) continue;
    const normalized = lang.trim();

    // Exact match (e.g. 'en-US', 'pt-BR', 'zh-CN')
    if (normalized in SUPPORTED_LOCALES) {
      return normalized as SupportedLocale;
    }

    // Case-insensitive exact match
    const lower = normalized.toLowerCase();
    for (const code of SUPPORTED_LOCALE_CODES) {
      if (code.toLowerCase() === lower) {
        return code;
      }
    }

    // Language prefix match (e.g. 'es-ES' -> 'es', 'fr-FR' -> 'fr', 'zh-TW' -> 'zh-CN', 'pt-PT' -> 'pt-BR')
    const prefix = lower.split('-')[0];
    for (const code of SUPPORTED_LOCALE_CODES) {
      if (code.toLowerCase().split('-')[0] === prefix) {
        return code;
      }
    }
  }

  return DEFAULT_LOCALE;
}

/**
 * Resolves the effective SupportedLocale given a user setting (either an explicit locale or 'system').
 */
export function resolveEffectiveLocale(setting: LocaleSetting, navLanguages?: readonly string[]): SupportedLocale {
  if (setting !== 'system' && setting in SUPPORTED_LOCALES) {
    return setting as SupportedLocale;
  }
  return resolveSystemLocale(navLanguages);
}

/**
 * Returns text direction ('ltr' | 'rtl') for a given locale.
 */
export function getTextDirection(locale: SupportedLocale): TextDirection {
  return SUPPORTED_LOCALES[locale]?.dir ?? 'ltr';
}
