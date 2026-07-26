/**
 * @fileoverview Safe, additive-only i18n catalog sync tool. Walks the canonical
 * `en-US` resource catalogs and ensures every other locale namespace has the
 * same shape. Missing keys are inserted with a `__MISSING__:` placeholder so
 * a verifier or a human translator can locate them. Existing translations are
 * never overwritten, and the tool never produces an `[XX]` sentinel prefix.
 *
 * Intended to fully replace the prior `scripts/generate-locales.cjs`, which
 * was the source of the false-green `100% complete` claim.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'src', 'i18n', 'resources');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts', 'i18n');

const DEFAULT_LOCALES = [
  'en-US',
  'es',
  'fr',
  'de',
  'pt-BR',
  'ru',
  'zh-CN',
  'ja',
  'hi',
  'ar',
  'ko',
  'sv-SE',
];

const DEFAULT_NAMESPACES = [
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

const MISSING_PLACEHOLDER_PREFIX = '__MISSING__:';
const SENTINEL_RE = /^\s*\[[A-Za-z-]{2,8}\]\s/;
const MISSING_MARKER_RE = /^__MISSING__:/;

function loadJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    throw new Error(`Failed to read JSON ${file}: ${err.message}`);
  }
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', 'utf8');
}

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function synthesizePlaceholder(keyPath) {
  return `${MISSING_PLACEHOLDER_PREFIX}${keyPath}`;
}

function mergeTreeAdditive(enTree, localeTree, prefix = '') {
  const out = localeTree ? deepClone(localeTree) : {};
  let added = 0;
  let skipped = 0;

  for (const [k, v] of Object.entries(enTree)) {
    const childPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      const [childOut, childStats] = mergeTreeAdditive(v, out[k], childPath);
      out[k] = childOut;
      added += childStats.added;
      skipped += childStats.skipped;
    } else {
      if (Object.prototype.hasOwnProperty.call(out, k)) {
        const existing = out[k];
        if (typeof existing === 'string' && existing.length > 0) {
          if (SENTINEL_RE.test(existing) || MISSING_MARKER_RE.test(existing)) {
            // Replace the sentinel/marker with a clean placeholder so the
            // leaf becomes self-evidently untranslated.
            out[k] = synthesizePlaceholder(childPath);
            added += 1;
          } else {
            skipped += 1;
          }
          continue;
        }
        // Existing value is empty/whitespace — overwrite with placeholder so
        // the leaf is at least flagged.
        out[k] = synthesizePlaceholder(childPath);
        added += 1;
        continue;
      }
      out[k] = synthesizePlaceholder(childPath);
      added += 1;
    }
  }
  return [out, { added, skipped }];
}

function syncCatalogs({ locales = DEFAULT_LOCALES, namespaces = DEFAULT_NAMESPACES, allowSeedOverride = false } = {}) {
  const report = {
    timestamp: new Date().toISOString(),
    locales,
    namespaces,
    perNamespace: {},
  };

  for (const ns of namespaces) {
    const seedFile = path.join(RESOURCES_DIR, 'en-US', `${ns}.json`);
    if (!fs.existsSync(seedFile)) {
      throw new Error(`Missing canonical seed file: ${seedFile}`);
    }
    const seed = loadJson(seedFile);

    for (const locale of locales) {
      if (locale === 'en-US') {
        // Validate the seed itself doesn't already carry sentinel/marker contamination.
        const flatEntries = flattenTree(seed);
        for (const [k, v] of flatEntries) {
          if (typeof v !== 'string') continue;
          if (SENTINEL_RE.test(v) || MISSING_MARKER_RE.test(v)) {
            throw new Error(
              `Refusing to sync: en-US canonical catalog ${ns}.json contains ${
                SENTINEL_RE.test(v) ? 'sentinel' : 'missing'
              } marker for key "${k}". Clean the en-US seed manually.`,
            );
          }
        }
        continue;
      }

      const targetFile = path.join(RESOURCES_DIR, locale, `${ns}.json`);
      const target = fs.existsSync(targetFile) ? loadJson(targetFile) : {};
      const [next, stats] = mergeTreeAdditive(seed, target);

      if (!allowSeedOverride) {
        // write only if changed
        const existingJson = fs.existsSync(targetFile) ? fs.readFileSync(targetFile, 'utf8') : '';
        const nextJson = JSON.stringify(next, null, 2) + '\n';
        if (existingJson !== nextJson) {
          writeJson(targetFile, next);
        }
      } else {
        writeJson(targetFile, next);
      }

      report.perNamespace[`${locale}:${ns}`] = stats;
    }
  }

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }
  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'catalog-sync-report.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  console.log(
    `Catalog sync complete. Per-namespace stats: ${Object.values(report.perNamespace)
      .map((s) => `+${s.added}/keep${s.skipped}`)
      .join(', ')}.`,
  );
  return report;
}

function flattenTree(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      flattenTree(v, keyPath, out);
    } else {
      out.push([keyPath, v]);
    }
  }
  return out;
}

if (require.main === module) {
  const args = process.argv.slice(2);
  const opts = { allowSeedOverride: args.includes('--allow-seed-override') };
  syncCatalogs(opts);
}

module.exports = {
  syncCatalogs,
  mergeTreeAdditive,
  flattenTree,
  synthesizePlaceholder,
  VISIBLE_LOCALES: DEFAULT_LOCALES,
  VISIBLE_NAMESPACES: DEFAULT_NAMESPACES,
  SENTINEL_PATTERENS: SENTINEL_RE,
  MISSING_MARKER: MISSING_MARKER_RE,
};
