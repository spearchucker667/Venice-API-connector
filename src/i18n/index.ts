/**
 * @fileoverview Venice Forge i18n initialization and central language switcher.
 */

import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { applyDocumentDirection } from './direction';
import { setFormatterLocale } from './formatters';
import type { LocaleSetting, SupportedLocale, TranslationNamespace } from './locale-types';
import { DEFAULT_LOCALE, resolveEffectiveLocale } from './locales';

// Import all locale resources synchronously
import arAccessibility from './resources/ar/accessibility.json';
import arCharacters from './resources/ar/characters.json';
import arChat from './resources/ar/chat.json';
import arCommon from './resources/ar/common.json';
import arDocuments from './resources/ar/documents.json';
import arErrors from './resources/ar/errors.json';
import arMedia from './resources/ar/media.json';
import arOnboarding from './resources/ar/onboarding.json';
import arResearch from './resources/ar/research.json';
import arSettings from './resources/ar/settings.json';
import arWorkflows from './resources/ar/workflows.json';

import deAccessibility from './resources/de/accessibility.json';
import deCharacters from './resources/de/characters.json';
import deChat from './resources/de/chat.json';
import deCommon from './resources/de/common.json';
import deDocuments from './resources/de/documents.json';
import deErrors from './resources/de/errors.json';
import deMedia from './resources/de/media.json';
import deOnboarding from './resources/de/onboarding.json';
import deResearch from './resources/de/research.json';
import deSettings from './resources/de/settings.json';
import deWorkflows from './resources/de/workflows.json';

import enAccessibility from './resources/en-US/accessibility.json';
import enCharacters from './resources/en-US/characters.json';
import enChat from './resources/en-US/chat.json';
import enCommon from './resources/en-US/common.json';
import enDocuments from './resources/en-US/documents.json';
import enErrors from './resources/en-US/errors.json';
import enMedia from './resources/en-US/media.json';
import enOnboarding from './resources/en-US/onboarding.json';
import enResearch from './resources/en-US/research.json';
import enSettings from './resources/en-US/settings.json';
import enWorkflows from './resources/en-US/workflows.json';

import esAccessibility from './resources/es/accessibility.json';
import esCharacters from './resources/es/characters.json';
import esChat from './resources/es/chat.json';
import esCommon from './resources/es/common.json';
import esDocuments from './resources/es/documents.json';
import esErrors from './resources/es/errors.json';
import esMedia from './resources/es/media.json';
import esOnboarding from './resources/es/onboarding.json';
import esResearch from './resources/es/research.json';
import esSettings from './resources/es/settings.json';
import esWorkflows from './resources/es/workflows.json';

import frAccessibility from './resources/fr/accessibility.json';
import frCharacters from './resources/fr/characters.json';
import frChat from './resources/fr/chat.json';
import frCommon from './resources/fr/common.json';
import frDocuments from './resources/fr/documents.json';
import frErrors from './resources/fr/errors.json';
import frMedia from './resources/fr/media.json';
import frOnboarding from './resources/fr/onboarding.json';
import frResearch from './resources/fr/research.json';
import frSettings from './resources/fr/settings.json';
import frWorkflows from './resources/fr/workflows.json';

import hiAccessibility from './resources/hi/accessibility.json';
import hiCharacters from './resources/hi/characters.json';
import hiChat from './resources/hi/chat.json';
import hiCommon from './resources/hi/common.json';
import hiDocuments from './resources/hi/documents.json';
import hiErrors from './resources/hi/errors.json';
import hiMedia from './resources/hi/media.json';
import hiOnboarding from './resources/hi/onboarding.json';
import hiResearch from './resources/hi/research.json';
import hiSettings from './resources/hi/settings.json';
import hiWorkflows from './resources/hi/workflows.json';

import jaAccessibility from './resources/ja/accessibility.json';
import jaCharacters from './resources/ja/characters.json';
import jaChat from './resources/ja/chat.json';
import jaCommon from './resources/ja/common.json';
import jaDocuments from './resources/ja/documents.json';
import jaErrors from './resources/ja/errors.json';
import jaMedia from './resources/ja/media.json';
import jaOnboarding from './resources/ja/onboarding.json';
import jaResearch from './resources/ja/research.json';
import jaSettings from './resources/ja/settings.json';
import jaWorkflows from './resources/ja/workflows.json';

import ptAccessibility from './resources/pt-BR/accessibility.json';
import ptCharacters from './resources/pt-BR/characters.json';
import ptChat from './resources/pt-BR/chat.json';
import ptCommon from './resources/pt-BR/common.json';
import ptDocuments from './resources/pt-BR/documents.json';
import ptErrors from './resources/pt-BR/errors.json';
import ptMedia from './resources/pt-BR/media.json';
import ptOnboarding from './resources/pt-BR/onboarding.json';
import ptResearch from './resources/pt-BR/research.json';
import ptSettings from './resources/pt-BR/settings.json';
import ptWorkflows from './resources/pt-BR/workflows.json';

import ruAccessibility from './resources/ru/accessibility.json';
import ruCharacters from './resources/ru/characters.json';
import ruChat from './resources/ru/chat.json';
import ruCommon from './resources/ru/common.json';
import ruDocuments from './resources/ru/documents.json';
import ruErrors from './resources/ru/errors.json';
import ruMedia from './resources/ru/media.json';
import ruOnboarding from './resources/ru/onboarding.json';
import ruResearch from './resources/ru/research.json';
import ruSettings from './resources/ru/settings.json';
import ruWorkflows from './resources/ru/workflows.json';

import zhAccessibility from './resources/zh-CN/accessibility.json';
import zhCharacters from './resources/zh-CN/characters.json';
import zhChat from './resources/zh-CN/chat.json';
import zhCommon from './resources/zh-CN/common.json';
import zhDocuments from './resources/zh-CN/documents.json';
import zhErrors from './resources/zh-CN/errors.json';
import zhMedia from './resources/zh-CN/media.json';
import zhOnboarding from './resources/zh-CN/onboarding.json';
import zhResearch from './resources/zh-CN/research.json';
import zhSettings from './resources/zh-CN/settings.json';
import zhWorkflows from './resources/zh-CN/workflows.json';

export const NAMESPACES: TranslationNamespace[] = [
  'common',
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
  'en-US': {
    common: enCommon,
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
  es: {
    common: esCommon,
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
  fr: {
    common: frCommon,
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
  de: {
    common: deCommon,
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
  'pt-BR': {
    common: ptCommon,
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
  ru: {
    common: ruCommon,
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
  ja: {
    common: jaCommon,
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
  hi: {
    common: hiCommon,
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
  ar: {
    common: arCommon,
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
};

const initialLocale = resolveEffectiveLocale('system');

if (!i18n.isInitialized) {
  void i18n
    .use(initReactI18next)
    .init({
      resources,
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
