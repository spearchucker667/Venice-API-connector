/**
 * @fileoverview Type definitions for Venice Forge localization and internationalization system.
 */

export type SupportedLocale =
  | 'en-US'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt-BR'
  | 'ru'
  | 'zh-CN'
  | 'ja'
  | 'hi'
  | 'ar';

export type TextDirection = 'ltr' | 'rtl';

export type LocaleSetting = SupportedLocale | 'system';

export interface LocaleMetadata {
  code: SupportedLocale;
  nativeName: string;
  englishName: string;
  dir: TextDirection;
  isProductionComplete: boolean;
}

export type TranslationNamespace =
  | 'common'
  | 'onboarding'
  | 'settings'
  | 'chat'
  | 'media'
  | 'documents'
  | 'research'
  | 'characters'
  | 'workflows'
  | 'errors'
  | 'accessibility';

export interface LocaleSettings {
  uiLocale: LocaleSetting;
}
