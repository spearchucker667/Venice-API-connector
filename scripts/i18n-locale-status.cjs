#!/usr/bin/env node
/**
 * @fileoverview Derives `isProductionComplete` for every supported locale by
 * reading the latest truthful translation-status JSON emitted by
 * `scripts/verify-i18n.cjs` and writing a strongly-typed TS module
 * (`src/i18n/locale-completion-status.ts`) that the registry in
 * `src/i18n/locales.ts` can import.
 *
 * This keeps the renderer honest — the registry is no longer hard-coded to
 * `isProductionComplete: true` for non-source locales. It is derived from the
 * authoritative pipeline output on every `verify:i18n` pass.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const STATUS_PATH = path.join(ROOT, 'docs/i18n/translation-status.json');
const OUT_MODULE = path.join(ROOT, 'src/i18n/locale-completion-status.ts');

const SUPPORTED_LOCALES = [
  'en-US', 'es', 'fr', 'de', 'pt-BR', 'ru', 'zh-CN', 'ja', 'hi', 'ar', 'ko', 'sv-SE',
];

const LOCALE_NATIVE_NAME = {
  'en-US': 'English (US)',
  es: 'Español',
  fr: 'Français',
  de: 'Deutsch',
  'pt-BR': 'Português (Brasil)',
  ru: 'Русский',
  'zh-CN': '简体中文',
  ja: '日本語',
  hi: 'हिन्दी',
  ar: 'العربية',
  ko: '한국어',
  'sv-SE': 'Svenska',
};

function loadStatus() {
  if (!fs.existsSync(STATUS_PATH)) {
    throw new Error(
      `Missing ${path.relative(ROOT, STATUS_PATH)}. Run \`npm run verify:i18n\` first.`,
    );
  }
  return JSON.parse(fs.readFileSync(STATUS_PATH, 'utf8'));
}

function deriveCompletion(status) {
  const result = {};
  const stats = status.locales || {};
  for (const locale of SUPPORTED_LOCALES) {
    const row = stats[locale];
    const canonical = row?.canonicalKeyTotal ?? 0;
    const translated = row?.translatedKeyTotal ?? 0;
    const sentinels = row?.sentinelLeaves ?? 0;
    const missing = row?.missingMarkerLeaves ?? 0;
    const identicalUnapproved = row?.identicalUnapprovedLeaves ?? 0;
    const review = row?.reviewStatus ?? (locale === 'en-US' ? 'source-language' : 'first-pass-machine');
    const catalogStatus = row?.catalogStatus ?? 'unknown';
    const catalogStructuralCoverage = row?.catalogStructuralCoverage ?? row?.uiCoveragePercent ?? 0;
    const runtimeSurfaceCoverage = row?.runtimeSurfaceCoverage ?? 0;
    const linguisticReviewStatus = row?.linguisticReviewStatus ?? review;
    const pctComplete = canonical > 0 ? translated / canonical : 1;

    const isProductionComplete =
      (locale === 'en-US' || review === 'complete') &&
      (locale === 'en-US' || catalogStatus === 'complete') &&
      runtimeSurfaceCoverage === 100 &&
      sentinels === 0 &&
      missing === 0 &&
      identicalUnapproved === 0;

    result[locale] = {
      languageTag: locale,
      nativeName: LOCALE_NATIVE_NAME[locale] ?? locale,
      canonicalKeyTotal: canonical,
      translatedKeyTotal: translated,
      sentinelLeaves: sentinels,
      missingMarkerLeaves: missing,
      identicalUnapprovedLeaves: identicalUnapproved,
      reviewStatus: review,
      catalogStatus,
      catalogStructuralCoverage,
      runtimeSurfaceCoverage,
      linguisticReviewStatus,
      coveragePercent: Math.round(pctComplete * 1000) / 10,
      isProductionComplete,
    };
  }
  return result;
}

function renderModule(completion) {
  const lines = [];
  lines.push('/**');
  lines.push(' * @fileoverview Auto-generated locale completion status derived from');
  lines.push(' * `docs/i18n/translation-status.json`. Regenerate via');
  lines.push(' * `node scripts/i18n-locale-status.cjs --write` after every `verify:i18n`.');
  lines.push(' *');
  lines.push(' * Do NOT edit by hand — the verifier pipeline is the source of truth.');
  lines.push(' */');
  lines.push('');
  lines.push("import type { SupportedLocale } from './locale-types';");
  lines.push('');
  lines.push('export interface LocaleCompletionRow {');
  lines.push('  languageTag: SupportedLocale;');
  lines.push('  nativeName: string;');
  lines.push('  canonicalKeyTotal: number;');
  lines.push('  translatedKeyTotal: number;');
  lines.push('  sentinelLeaves: number;');
  lines.push('  missingMarkerLeaves: number;');
  lines.push('  identicalUnapprovedLeaves: number;');
  lines.push('  reviewStatus: \'source-language\' | \'complete\' | \'in-progress\' | \'first-pass-machine\' | \'not-started\' | \'unknown\';');
  lines.push('  catalogStatus: \'complete\' | \'in-progress\' | \'pending-translation\' | \'unknown\';');
  lines.push('  catalogStructuralCoverage: number;');
  lines.push('  runtimeSurfaceCoverage: number;');
  lines.push('  linguisticReviewStatus: LocaleCompletionRow[\'reviewStatus\'];');
  lines.push('  coveragePercent: number;');
  lines.push('  isProductionComplete: boolean;');
  lines.push('}');
  lines.push('');
  lines.push(
    'export const LOCALE_COMPLETION: Record<SupportedLocale, LocaleCompletionRow> = {',
  );
  for (const locale of SUPPORTED_LOCALES) {
    const row = completion[locale];
    lines.push(`  '${locale}': ${JSON.stringify(row, null, 2)},`);
  }
  lines.push('};');
  lines.push('');
  return lines.join('\n');
}

function cli() {
  const args = process.argv.slice(2);
  const write = args.includes('--write');

  const status = loadStatus();
  const completion = deriveCompletion(status);

  const moduleSource = renderModule(completion);

  if (!write) {
    process.stdout.write(moduleSource);
    return;
  }

  fs.writeFileSync(OUT_MODULE, moduleSource, 'utf8');
  console.log(
    `[i18n-locale-status] Wrote ${path.relative(ROOT, OUT_MODULE)} from ${path.relative(ROOT, STATUS_PATH)}.`,
  );
  for (const [locale, row] of Object.entries(completion)) {
    const flag = row.isProductionComplete ? 'complete' : 'incomplete';
    console.log(
      `  ${locale.padEnd(8)} coverage=${String(row.coveragePercent).padStart(5)}%  review=${row.reviewStatus.padEnd(20)}  isProductionComplete=${flag}`,
    );
  }
}

if (require.main === module) {
  try {
    cli();
  } catch (err) {
    console.error(`[i18n-locale-status] ${err.message}`);
    process.exit(2);
  }
}

module.exports = {
  deriveCompletion,
  loadStatus,
  renderModule,
  STATUS_PATH,
  OUT_MODULE,
  SUPPORTED_LOCALES,
};
