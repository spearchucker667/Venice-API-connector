/**
 * @fileoverview Venice Forge i18n initialization and central language switcher.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { applyDocumentDirection } from './direction';
import { setFormatterLocale } from './formatters';
import { normalizeResources, warnMissingEntries } from './resourceNormalizer';
import type { LocaleSetting, SupportedLocale, TranslationNamespace } from './locale-types';
import { DEFAULT_LOCALE, resolveEffectiveLocale } from './locales';

// Import all locale resources synchronously
import arCommon from './resources/ar/common.json';
import arNavigation from './resources/ar/navigation.json';
import arOnboarding from './resources/ar/onboarding.json';
import arSettings from './resources/ar/settings.json';
import arChat from './resources/ar/chat.json';
import arMedia from './resources/ar/media.json';
import arDocuments from './resources/ar/documents.json';
import arResearch from './resources/ar/research.json';
import arCharacters from './resources/ar/characters.json';
import arWorkflows from './resources/ar/workflows.json';
import arErrors from './resources/ar/errors.json';
import arAccessibility from './resources/ar/accessibility.json';

import deCommon from './resources/de/common.json';
import deNavigation from './resources/de/navigation.json';
import deOnboarding from './resources/de/onboarding.json';
import deSettings from './resources/de/settings.json';
import deChat from './resources/de/chat.json';
import deMedia from './resources/de/media.json';
import deDocuments from './resources/de/documents.json';
import deResearch from './resources/de/research.json';
import deCharacters from './resources/de/characters.json';
import deWorkflows from './resources/de/workflows.json';
import deErrors from './resources/de/errors.json';
import deAccessibility from './resources/de/accessibility.json';

import enCommon from './resources/en-US/common.json';
import enNavigation from './resources/en-US/navigation.json';
import enOnboarding from './resources/en-US/onboarding.json';
import enSettings from './resources/en-US/settings.json';
import enChat from './resources/en-US/chat.json';
import enMedia from './resources/en-US/media.json';
import enDocuments from './resources/en-US/documents.json';
import enResearch from './resources/en-US/research.json';
import enCharacters from './resources/en-US/characters.json';
import enWorkflows from './resources/en-US/workflows.json';
import enErrors from './resources/en-US/errors.json';
import enAccessibility from './resources/en-US/accessibility.json';

import esCommon from './resources/es/common.json';
import esNavigation from './resources/es/navigation.json';
import esOnboarding from './resources/es/onboarding.json';
import esSettings from './resources/es/settings.json';
import esChat from './resources/es/chat.json';
import esMedia from './resources/es/media.json';
import esDocuments from './resources/es/documents.json';
import esResearch from './resources/es/research.json';
import esCharacters from './resources/es/characters.json';
import esWorkflows from './resources/es/workflows.json';
import esErrors from './resources/es/errors.json';
import esAccessibility from './resources/es/accessibility.json';

import frCommon from './resources/fr/common.json';
import frNavigation from './resources/fr/navigation.json';
import frOnboarding from './resources/fr/onboarding.json';
import frSettings from './resources/fr/settings.json';
import frChat from './resources/fr/chat.json';
import frMedia from './resources/fr/media.json';
import frDocuments from './resources/fr/documents.json';
import frResearch from './resources/fr/research.json';
import frCharacters from './resources/fr/characters.json';
import frWorkflows from './resources/fr/workflows.json';
import frErrors from './resources/fr/errors.json';
import frAccessibility from './resources/fr/accessibility.json';

import hiCommon from './resources/hi/common.json';
import hiNavigation from './resources/hi/navigation.json';
import hiOnboarding from './resources/hi/onboarding.json';
import hiSettings from './resources/hi/settings.json';
import hiChat from './resources/hi/chat.json';
import hiMedia from './resources/hi/media.json';
import hiDocuments from './resources/hi/documents.json';
import hiResearch from './resources/hi/research.json';
import hiCharacters from './resources/hi/characters.json';
import hiWorkflows from './resources/hi/workflows.json';
import hiErrors from './resources/hi/errors.json';
import hiAccessibility from './resources/hi/accessibility.json';

import jaCommon from './resources/ja/common.json';
import jaNavigation from './resources/ja/navigation.json';
import jaOnboarding from './resources/ja/onboarding.json';
import jaSettings from './resources/ja/settings.json';
import jaChat from './resources/ja/chat.json';
import jaMedia from './resources/ja/media.json';
import jaDocuments from './resources/ja/documents.json';
import jaResearch from './resources/ja/research.json';
import jaCharacters from './resources/ja/characters.json';
import jaWorkflows from './resources/ja/workflows.json';
import jaErrors from './resources/ja/errors.json';
import jaAccessibility from './resources/ja/accessibility.json';

import ptCommon from './resources/pt-BR/common.json';
import ptNavigation from './resources/pt-BR/navigation.json';
import ptOnboarding from './resources/pt-BR/onboarding.json';
import ptSettings from './resources/pt-BR/settings.json';
import ptChat from './resources/pt-BR/chat.json';
import ptMedia from './resources/pt-BR/media.json';
import ptDocuments from './resources/pt-BR/documents.json';
import ptResearch from './resources/pt-BR/research.json';
import ptCharacters from './resources/pt-BR/characters.json';
import ptWorkflows from './resources/pt-BR/workflows.json';
import ptErrors from './resources/pt-BR/errors.json';
import ptAccessibility from './resources/pt-BR/accessibility.json';

import ruCommon from './resources/ru/common.json';
import ruNavigation from './resources/ru/navigation.json';
import ruOnboarding from './resources/ru/onboarding.json';
import ruSettings from './resources/ru/settings.json';
import ruChat from './resources/ru/chat.json';
import ruMedia from './resources/ru/media.json';
import ruDocuments from './resources/ru/documents.json';
import ruResearch from './resources/ru/research.json';
import ruCharacters from './resources/ru/characters.json';
import ruWorkflows from './resources/ru/workflows.json';
import ruErrors from './resources/ru/errors.json';
import ruAccessibility from './resources/ru/accessibility.json';

import zhCommon from './resources/zh-CN/common.json';
import zhNavigation from './resources/zh-CN/navigation.json';
import zhOnboarding from './resources/zh-CN/onboarding.json';
import zhSettings from './resources/zh-CN/settings.json';
import zhChat from './resources/zh-CN/chat.json';
import zhMedia from './resources/zh-CN/media.json';
import zhDocuments from './resources/zh-CN/documents.json';
import zhResearch from './resources/zh-CN/research.json';
import zhCharacters from './resources/zh-CN/characters.json';
import zhWorkflows from './resources/zh-CN/workflows.json';
import zhErrors from './resources/zh-CN/errors.json';
import zhAccessibility from './resources/zh-CN/accessibility.json';

import koCommon from './resources/ko/common.json';
import koNavigation from './resources/ko/navigation.json';
import koOnboarding from './resources/ko/onboarding.json';
import koSettings from './resources/ko/settings.json';
import koChat from './resources/ko/chat.json';
import koMedia from './resources/ko/media.json';
import koDocuments from './resources/ko/documents.json';
import koResearch from './resources/ko/research.json';
import koCharacters from './resources/ko/characters.json';
import koWorkflows from './resources/ko/workflows.json';
import koErrors from './resources/ko/errors.json';
import koAccessibility from './resources/ko/accessibility.json';

import svCommon from './resources/sv-SE/common.json';
import svNavigation from './resources/sv-SE/navigation.json';
import svOnboarding from './resources/sv-SE/onboarding.json';
import svSettings from './resources/sv-SE/settings.json';
import svChat from './resources/sv-SE/chat.json';
import svMedia from './resources/sv-SE/media.json';
import svDocuments from './resources/sv-SE/documents.json';
import svResearch from './resources/sv-SE/research.json';
import svCharacters from './resources/sv-SE/characters.json';
import svWorkflows from './resources/sv-SE/workflows.json';
import svErrors from './resources/sv-SE/errors.json';
import svAccessibility from './resources/sv-SE/accessibility.json';

export const NAMESPACES: TranslationNamespace[] = [
  'common',
  'navigation',
  'onboarding',
  'settings',
  'chat',
  'media',
  'documents',
  'research',
  'characters',
  'workflows',
  'errors',
  'accessibility',
];

export const resources = {
  'ar': {
    common: arCommon,
    navigation: arNavigation,
    onboarding: arOnboarding,
    settings: arSettings,
    chat: arChat,
    media: arMedia,
    documents: arDocuments,
    research: arResearch,
    characters: arCharacters,
    workflows: arWorkflows,
    errors: arErrors,
    accessibility: arAccessibility,
  },
  'de': {
    common: deCommon,
    navigation: deNavigation,
    onboarding: deOnboarding,
    settings: deSettings,
    chat: deChat,
    media: deMedia,
    documents: deDocuments,
    research: deResearch,
    characters: deCharacters,
    workflows: deWorkflows,
    errors: deErrors,
    accessibility: deAccessibility,
  },
  'en-US': {
    common: enCommon,
    navigation: enNavigation,
    onboarding: enOnboarding,
    settings: enSettings,
    chat: enChat,
    media: enMedia,
    documents: enDocuments,
    research: enResearch,
    characters: enCharacters,
    workflows: enWorkflows,
    errors: enErrors,
    accessibility: enAccessibility,
  },
  'es': {
    common: esCommon,
    navigation: esNavigation,
    onboarding: esOnboarding,
    settings: esSettings,
    chat: esChat,
    media: esMedia,
    documents: esDocuments,
    research: esResearch,
    characters: esCharacters,
    workflows: esWorkflows,
    errors: esErrors,
    accessibility: esAccessibility,
  },
  'fr': {
    common: frCommon,
    navigation: frNavigation,
    onboarding: frOnboarding,
    settings: frSettings,
    chat: frChat,
    media: frMedia,
    documents: frDocuments,
    research: frResearch,
    characters: frCharacters,
    workflows: frWorkflows,
    errors: frErrors,
    accessibility: frAccessibility,
  },
  'hi': {
    common: hiCommon,
    navigation: hiNavigation,
    onboarding: hiOnboarding,
    settings: hiSettings,
    chat: hiChat,
    media: hiMedia,
    documents: hiDocuments,
    research: hiResearch,
    characters: hiCharacters,
    workflows: hiWorkflows,
    errors: hiErrors,
    accessibility: hiAccessibility,
  },
  'ja': {
    common: jaCommon,
    navigation: jaNavigation,
    onboarding: jaOnboarding,
    settings: jaSettings,
    chat: jaChat,
    media: jaMedia,
    documents: jaDocuments,
    research: jaResearch,
    characters: jaCharacters,
    workflows: jaWorkflows,
    errors: jaErrors,
    accessibility: jaAccessibility,
  },
  'pt-BR': {
    common: ptCommon,
    navigation: ptNavigation,
    onboarding: ptOnboarding,
    settings: ptSettings,
    chat: ptChat,
    media: ptMedia,
    documents: ptDocuments,
    research: ptResearch,
    characters: ptCharacters,
    workflows: ptWorkflows,
    errors: ptErrors,
    accessibility: ptAccessibility,
  },
  'ru': {
    common: ruCommon,
    navigation: ruNavigation,
    onboarding: ruOnboarding,
    settings: ruSettings,
    chat: ruChat,
    media: ruMedia,
    documents: ruDocuments,
    research: ruResearch,
    characters: ruCharacters,
    workflows: ruWorkflows,
    errors: ruErrors,
    accessibility: ruAccessibility,
  },
  'zh-CN': {
    common: zhCommon,
    navigation: zhNavigation,
    onboarding: zhOnboarding,
    settings: zhSettings,
    chat: zhChat,
    media: zhMedia,
    documents: zhDocuments,
    research: zhResearch,
    characters: zhCharacters,
    workflows: zhWorkflows,
    errors: zhErrors,
    accessibility: zhAccessibility,
  },
  'ko': {
    common: koCommon,
    navigation: koNavigation,
    onboarding: koOnboarding,
    settings: koSettings,
    chat: koChat,
    media: koMedia,
    documents: koDocuments,
    research: koResearch,
    characters: koCharacters,
    workflows: koWorkflows,
    errors: koErrors,
    accessibility: koAccessibility,
  },
  'sv-SE': {
    common: svCommon,
    navigation: svNavigation,
    onboarding: svOnboarding,
    settings: svSettings,
    chat: svChat,
    media: svMedia,
    documents: svDocuments,
    research: svResearch,
    characters: svCharacters,
    workflows: svWorkflows,
    errors: svErrors,
    accessibility: svAccessibility,
  },
};

const normalizedBundle = normalizeResources(resources);
warnMissingEntries(normalizedBundle.missingEntries);

export const initialMissingCatalogEntries = normalizedBundle.missingEntries;
const scrubbedResources = normalizedBundle.resources;

const initialLocale = resolveEffectiveLocale('system');

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources: scrubbedResources,
      lng: initialLocale,
      fallbackLng: DEFAULT_LOCALE,
      defaultNS: 'common',
      ns: NAMESPACES,
      interpolation: {
        escapeValue: false,
      },
      returnNull: false,
      returnEmptyString: false,
    });

  applyDocumentDirection(initialLocale);
  setFormatterLocale(initialLocale);
}

/**
 * Re-runs the marker/fallback normalisation after a dynamic language pack is
 * reloaded (e.g. user language change with deferred catalogs).
 */
export function reapplyResourceNormalization(
  bundled: Record<string, Record<string, unknown>>,
  locale: SupportedLocale,
): void {
  const next = normalizeResources(
    bundled as Record<string, Record<string, Record<string, unknown>>>,
  );
  warnMissingEntries(next.missingEntries);
  void i18n.addResources(locale, 'common', next.resources[locale]?.common ?? {});
}

/**
 * Changes active application language synchronously and updates DOM direction and formatters.
 */
export function changeLanguage(setting: LocaleSetting): SupportedLocale {
  const effective = resolveEffectiveLocale(setting);
  if (i18n.language !== effective) {
    void i18n.changeLanguage(effective);
  }
  applyDocumentDirection(effective);
  setFormatterLocale(effective);
  return effective;
}

export { i18n };
export * from './direction';
export * from './formatters';
export * from './locale-types';
export * from './locales';
