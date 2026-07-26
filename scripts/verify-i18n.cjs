/**
 * @fileoverview Comprehensive verification script for Venice Forge i18n system.
 * Validates resource completeness, interpolation variable parity, documentation parity, and locale registry agreement.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const RESOURCES_DIR = path.join(ROOT_DIR, 'src', 'i18n', 'resources');
const DOCS_I18N_DIR = path.join(ROOT_DIR, 'docs', 'i18n');
const STATUS_METADATA_PATH = path.join(DOCS_I18N_DIR, 'translation-status.json');

const EXPECTED_LOCALES = ['en-US', 'es', 'fr', 'de', 'pt-BR', 'ru', 'zh-CN', 'ja', 'hi', 'ar', 'ko', 'sv-SE'];
const EXPECTED_NAMESPACES = [
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
  'navigation',
];

const REQUIRED_DOCS = [
  'README.md',
  'ABOUT.md',
  'FAQ.md',
  'SUPPORT.md',
  'PRIVACY.md',
  'SECURITY.md',
  'CONTRIBUTING.md',
];

let errors = [];

function logError(msg) {
  errors.push(msg);
}

// 1. Verify resource directories exist
for (const locale of EXPECTED_LOCALES) {
  const dir = path.join(RESOURCES_DIR, locale);
  if (!fs.existsSync(dir)) {
    logError(`Missing resource directory for locale '${locale}' at ${dir}`);
  }
}

if (errors.length > 0) {
  console.error('❌ i18n Verification Failed:');
  errors.forEach((e) => console.error(` - ${e}`));
  process.exit(1);
}

// 2. Key parity and interpolation checking against en-US
const enUSResources = {};

for (const ns of EXPECTED_NAMESPACES) {
  const file = path.join(RESOURCES_DIR, 'en-US', `${ns}.json`);
  if (!fs.existsSync(file)) {
    logError(`Missing canonical en-US namespace file: ${file}`);
    continue;
  }
  try {
    enUSResources[ns] = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    logError(`Failed to parse en-US namespace file ${file}: ${err.message}`);
  }
}

function extractKeys(obj, prefix = '') {
  let keys = {};
  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      Object.assign(keys, extractKeys(v, keyPath));
    } else {
      keys[keyPath] = v;
    }
  }
  return keys;
}

function extractInterpolationVars(str) {
  if (typeof str !== 'string') return [];
  const matches = str.match(/\{\{([^}]+)\}\}/g) || [];
  return matches.map((m) => m.replace(/[{}]/g, '').trim()).sort();
}

for (const locale of EXPECTED_LOCALES) {
  if (locale === 'en-US') continue;

  for (const ns of EXPECTED_NAMESPACES) {
    const file = path.join(RESOURCES_DIR, locale, `${ns}.json`);
    if (!fs.existsSync(file)) {
      logError(`Missing namespace file for ${locale}: ${ns}.json`);
      continue;
    }

    let parsed;
    try {
      parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (err) {
      logError(`Invalid JSON in ${locale}/${ns}.json: ${err.message}`);
      continue;
    }

    const enKeys = extractKeys(enUSResources[ns] || {});
    const locKeys = extractKeys(parsed);

    // Missing keys
    for (const k of Object.keys(enKeys)) {
      if (!(k in locKeys)) {
        logError(`Locale '${locale}' missing key '${ns}:${k}'`);
      } else {
        // Check interpolation variables
        const enVars = extractInterpolationVars(enKeys[k]);
        const locVars = extractInterpolationVars(locKeys[k]);
        if (enVars.join(',') !== locVars.join(',')) {
          logError(`Locale '${locale}' key '${ns}:${k}' interpolation mismatch. Expected [${enVars.join(', ')}], got [${locVars.join(', ')}]`);
        }
      }
    }

    // Orphan keys
    for (const k of Object.keys(locKeys)) {
      if (!(k in enKeys)) {
        logError(`Locale '${locale}' has orphan key '${ns}:${k}' not found in en-US`);
      }
    }
  }
}

// 3. Verify documentation files
for (const locale of EXPECTED_LOCALES) {
  if (locale === 'en-US') continue;
  const locDocsDir = path.join(DOCS_I18N_DIR, locale);
  if (!fs.existsSync(locDocsDir)) {
    logError(`Missing documentation directory for locale '${locale}' at ${locDocsDir}`);
    continue;
  }

  for (const doc of REQUIRED_DOCS) {
    const docPath = path.join(locDocsDir, doc);
    if (!fs.existsSync(docPath)) {
      logError(`Missing localized doc '${doc}' for locale '${locale}' at ${docPath}`);
    }
  }
}

// 4. Verify translation status metadata
if (!fs.existsSync(STATUS_METADATA_PATH)) {
  logError(`Missing translation status metadata at ${STATUS_METADATA_PATH}`);
} else {
  try {
    const statusData = JSON.parse(fs.readFileSync(STATUS_METADATA_PATH, 'utf8'));
    if (!statusData.locales || typeof statusData.locales !== 'object') {
      logError(`Invalid translation status metadata structure in ${STATUS_METADATA_PATH}`);
    } else {
      for (const locale of EXPECTED_LOCALES) {
        if (!statusData.locales[locale]) {
          logError(`Translation status metadata missing entry for locale '${locale}'`);
        }
      }
    }
  } catch (err) {
    logError(`Failed to parse translation status metadata: ${err.message}`);
  }
}

if (errors.length > 0) {
  console.error(`❌ i18n Verification Failed (${errors.length} errors):`);
  errors.forEach((e) => console.error(` - ${e}`));
  process.exit(1);
} else {
  console.log(`✓ i18n Verification Passed (${EXPECTED_LOCALES.length} locales, ${EXPECTED_NAMESPACES.length} namespaces, documentation & metadata verified).`);
}
