/**
 * @fileoverview Auto-generated locale completion status derived from
 * `docs/i18n/translation-status.json`. Regenerate via
 * `node scripts/i18n-locale-status.cjs --write` after every `verify:i18n`.
 *
 * Do NOT edit by hand — the verifier pipeline is the source of truth.
 */

import type { SupportedLocale } from './locale-types';

export interface LocaleCompletionRow {
  languageTag: SupportedLocale;
  nativeName: string;
  canonicalKeyTotal: number;
  translatedKeyTotal: number;
  sentinelLeaves: number;
  missingMarkerLeaves: number;
  identicalUnapprovedLeaves: number;
  reviewStatus: 'complete' | 'in-progress' | 'pending-translation' | 'unknown';
  coveragePercent: number;
  isProductionComplete: boolean;
}

export const LOCALE_COMPLETION: Record<SupportedLocale, LocaleCompletionRow> = {
  'en-US': {
  "languageTag": "en-US",
  "nativeName": "English (US)",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'es': {
  "languageTag": "es",
  "nativeName": "Español",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'fr': {
  "languageTag": "fr",
  "nativeName": "Français",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'de': {
  "languageTag": "de",
  "nativeName": "Deutsch",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'pt-BR': {
  "languageTag": "pt-BR",
  "nativeName": "Português (Brasil)",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'ru': {
  "languageTag": "ru",
  "nativeName": "Русский",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'zh-CN': {
  "languageTag": "zh-CN",
  "nativeName": "简体中文",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'ja': {
  "languageTag": "ja",
  "nativeName": "日本語",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'hi': {
  "languageTag": "hi",
  "nativeName": "हिन्दी",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'ar': {
  "languageTag": "ar",
  "nativeName": "العربية",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'ko': {
  "languageTag": "ko",
  "nativeName": "한국어",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
  'sv-SE': {
  "languageTag": "sv-SE",
  "nativeName": "Svenska",
  "canonicalKeyTotal": 795,
  "translatedKeyTotal": 795,
  "sentinelLeaves": 0,
  "missingMarkerLeaves": 0,
  "identicalUnapprovedLeaves": 0,
  "reviewStatus": "complete",
  "coveragePercent": 100,
  "isProductionComplete": true
},
};
