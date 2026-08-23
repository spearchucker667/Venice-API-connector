/**
 * @fileoverview OBSOLETE — DO NOT RUN BY DEFAULT.
 *
 * This script auto-populates en-US catalogs by harvesting the runtime default
 * string from `t(key, 'default')` calls. That practice collapsed the
 * source-of-truth for English text into developer comments and made every
 * subsequent locale inherit the same value, so locale parity was enforced by
 * aliasing rather than by translation. The remediation is to author
 * en-US catalog entries by hand from the canonical English product copy and
 * let `scripts/sync-catalogs.cjs` add `__MISSING__:` placeholders for any key
 * not yet shipped in non-English catalogs.
 *
 * If an emergency one-shot seed pass is required (e.g. moving off the legacy
 * artefact), call this file directly with `--legacy-seed`. The flag is
 * intentionally not present in `package.json` so a plain `node scripts/populate-
 * en-us-catalogs.cjs` always fails fast.
 */

'use strict';

if (require.main === module && !process.argv.includes('--legacy-seed')) {
  console.error(
    [
      'scripts/populate-en-us-catalogs.cjs is OBSOLETE and refuses to execute by default.',
      'Its `t(key, "default")` harvester collapsed the en-US source-of-truth into',
      'developer defaults. Author en-US entries by hand, then run',
      '`node scripts/sync-catalogs.cjs` to add missing keys across every locale.',
      'For emergency migrations only, invoke with `--legacy-seed`.',
    ].join('\n'),
  );
  process.exit(2);
}

/**
 * @fileoverview Auto-populates en-US resource catalogs with missing keys found in source code.
 */

const fs = require('fs');
const path = require('path');
const { extractKeysFromSource } = require('./extract-i18n-keys.cjs');

const ROOT_DIR = path.join(__dirname, '..');
const EN_US_DIR = path.join(ROOT_DIR, 'src', 'i18n', 'resources', 'en-US');

const NAMESPACES = [
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

function setNestedKey(obj, keyPath, value) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const p = parts[i];
    if (p === '__proto__' || p === 'constructor' || p === 'prototype') {
      throw new Error(`Forbidden key segment: ${p}`);
    }
    // Create branches with a null prototype so inherited properties (including
    // Object.prototype members) can never be walked or overwritten.
    if (!Object.prototype.hasOwnProperty.call(current, p) || !current[p] || typeof current[p] !== 'object') {
      current[p] = Object.create(null);
    }
    current = current[p];
  }
  const lastPart = parts[parts.length - 1];
  if (lastPart === '__proto__' || lastPart === 'constructor' || lastPart === 'prototype') {
    throw new Error(`Forbidden key segment: ${lastPart}`);
  }
  // Only set if not already set
  if (current[lastPart] === undefined) {
    current[lastPart] = value;
  }
}

function getNestedKey(obj, keyPath) {
  const parts = keyPath.split('.');
  let current = obj;
  for (let i = 0; i < parts.length; i++) {
    if (!current || typeof current !== 'object') return undefined;
    current = current[parts[i]];
  }
  return current;
}

function populateEnUS() {
  const sourceKeys = extractKeysFromSource();
  const catalogs = {};

  for (const ns of NAMESPACES) {
    const file = path.join(EN_US_DIR, `${ns}.json`);
    if (fs.existsSync(file)) {
      try {
        catalogs[ns] = JSON.parse(fs.readFileSync(file, 'utf8'));
      } catch {
        catalogs[ns] = {};
      }
    } else {
      catalogs[ns] = {};
    }
  }

  let addedCount = 0;

  for (const item of sourceKeys) {
    if (!item.defaultValue) continue; // Skip test/literal keys without explicit default string
    // Skip single letter keys or code symbols from tests
    if (item.key.length <= 2 && !item.key.includes('.')) continue;

    const ns = item.ns;
    if (!NAMESPACES.includes(ns)) continue;

    const existing = getNestedKey(catalogs[ns], item.key);
    if (existing === undefined) {
      setNestedKey(catalogs[ns], item.key, item.defaultValue);
      addedCount++;
    }
  }

  for (const ns of NAMESPACES) {
    const file = path.join(EN_US_DIR, `${ns}.json`);
    fs.writeFileSync(file, JSON.stringify(catalogs[ns], null, 2) + '\n', 'utf8');
  }

  console.log(`Populated en-US catalogs with ${addedCount} new keys.`);
}

if (require.main === module) {
  populateEnUS();
}

module.exports = { populateEnUS };
