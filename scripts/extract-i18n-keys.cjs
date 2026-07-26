/**
 * @fileoverview AST-based i18n key extractor driven by the TypeScript Compiler
 * API. Replaces the original regex-only extractor with one that understands
 * `t('ns:key', 'default')` (including multi-line), template-literal argument
 * forms, `useTranslation(['ns'], { keyPrefix: 'foo' })` / `useTranslation('ns')`,
 * `i18next.t(...)` / `i18n.t(...)`, and the `<Trans i18nKey="ns:key" />` JSX
 * component. Exposes the same module surface (`extractKeysFromSource`,
 * `runAudit`) so the existing verifier import is preserved.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const ts = require('typescript');

const ROOT_DIR = path.join(__dirname, '..');
const SRC_DIR = path.join(ROOT_DIR, 'src');
const EN_US_DIR = path.join(SRC_DIR, 'i18n', 'resources', 'en-US');
const ARTIFACTS_DIR = path.join(ROOT_DIR, 'artifacts', 'i18n');

const VALID_NAMESPACES = new Set([
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
]);

const NAMESPACES = Array.from(VALID_NAMESPACES);

const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', 'release']);
const SOURCE_EXTS = ['.ts', '.tsx'];
const TEST_FILE_RE = /\.(test|spec)\.[jt]sx?$/;
const DECL_FILE_RE = /\.d\.ts$/;

function walk(dir, results) {
  let entries = [];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    if (SKIP_DIRS.has(entry.name)) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, results);
    } else if (
      SOURCE_EXTS.includes(path.extname(entry.name))
      && !TEST_FILE_RE.test(entry.name)
      && !DECL_FILE_RE.test(entry.name)
    ) {
      results.push(p);
    }
  }
  return results;
}

function getAllSourceFiles() {
  return walk(SRC_DIR, []);
}

function isStaticStringLiteral(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return node.text;
  }
  if (ts.isTemplateLiteral(node) && node.templateSpans.length === 0 && typeof node.head?.text === 'string') {
    return node.head.text;
  }
  return null;
}

function isKnownI18nCalleeType(node) {
  if (!ts.isIdentifier(node)) return false;
  if (node.text === 't' || node.text === 'useTranslation') return true;
  return false;
}

function isI18nPropertyAccess(expr) {
  if (!ts.isPropertyAccessExpression(expr)) return null;
  const name = expr.name.text;
  const obj = expr.expression;
  if (name !== 't') return null;
  if (ts.isIdentifier(obj) && (obj.text === 'i18n' || obj.text === 'i18next')) return true;
  return false;
}

function matchCall(node) {
  if (!ts.isCallExpression(node)) return null;
  const expr = node.expression;
  if (isKnownI18nCalleeType(expr) && expr.text === 't') return 't';
  if (isKnownI18nCalleeType(expr) && expr.text === 'useTranslation') return 'useTranslation';
  if (isI18nPropertyAccess(expr)) return 't';
  return null;
}

function extractNsString(arg) {
  const text = isStaticStringLiteral(arg);
  return text || null;
}

function resolveScopeFromUseTranslationCall(call, parentScope) {
  const next = {
    ns: parentScope?.ns ?? null,
    keyPrefix: parentScope?.keyPrefix ?? null,
  };

  const first = call.arguments[0];
  if (first) {
    if (ts.isArrayLiteralExpression(first)) {
      const head = first.elements[0];
      const value = extractNsString(head);
      if (value) next.ns = value;
    } else {
      const value = extractNsString(first);
      if (value) next.ns = value;
    }
  }

  const second = call.arguments[1];
  if (second && ts.isObjectLiteralExpression(second)) {
    for (const prop of second.properties) {
      if (
        ts.isPropertyAssignment(prop)
        && ts.isIdentifier(prop.name)
        && prop.name.text === 'keyPrefix'
      ) {
        const value = extractNsString(prop.initializer);
        if (value !== null) next.keyPrefix = value;
      }
    }
  }

  if (!next.ns) {
    next.ns = 'common';
  }
  return next;
}

function applyKeyPrefix(prefix, key) {
  if (!prefix) return key;
  if (!key) return prefix;
  return `${prefix}.${key}`;
}

function splitKeyByColon(raw, scope) {
  let ns = scope.ns;
  let key;
  let explicitNs = false;
  if (raw.includes(':')) {
    const idx = raw.indexOf(':');
    const prefix = raw.slice(0, idx);
    if (VALID_NAMESPACES.has(prefix)) {
      ns = prefix;
      key = raw.slice(idx + 1);
      explicitNs = true;
    } else {
      key = raw;
    }
  } else if (raw.includes('.')) {
    const idx = raw.indexOf('.');
    const prefix = raw.slice(0, idx);
    const prefixMatchesScope = scope.ns && prefix === scope.ns;
    const noScopeSet = !scope.ns;
    if ((prefixMatchesScope || noScopeSet) && VALID_NAMESPACES.has(prefix)) {
      ns = prefix;
      key = raw.slice(idx + 1);
      explicitNs = true;
    } else {
      key = raw;
    }
  } else {
    key = raw;
  }
  if (!explicitNs) {
    key = applyKeyPrefix(scope.keyPrefix, key);
  }
  if (!VALID_NAMESPACES.has(ns)) return null;
  return { ns, key, fullKey: `${ns}:${key}` };
}

function extractStaticTemplateSegments(node) {
  if (!node) return null;
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
    return { text: node.text, dynamic: false };
  }
  if (ts.isTemplateLiteral(node) && node.templateSpans.length === 0) {
    return { text: node.head.text || '', dynamic: false };
  }
  if (ts.isTemplateLiteral(node)) {
    return { text: null, dynamic: true };
  }
  return null;
}

function recordTCall(call, scope, sf, relPath, occurrences) {
  const keyArg = call.arguments[0];
  const defaultArg = call.arguments[1];

  const keyFragment = extractStaticTemplateSegments(keyArg);
  if (!keyFragment) return;
  if (keyFragment.dynamic) return;

  const split = splitKeyByColon(keyFragment.text, scope);
  if (!split) return;

  let defaultValue = null;
  if (defaultArg) {
    const def = extractStaticTemplateSegments(defaultArg);
    if (def && !def.dynamic) {
      defaultValue = def.text || null;
    }
  }

  const line = sf.getLineAndCharacterOfPosition(call.getStart()).line + 1;
  occurrences.push({
    file: relPath,
    line,
    ns: split.ns,
    key: split.key,
    fullKey: split.fullKey,
    defaultValue,
  });
}

function recordJsxTrans(node, scope, sf, relPath, occurrences) {
  if (!node.tagName) return;
  if (!ts.isIdentifier(node.tagName) || node.tagName.text !== 'Trans') return;

  for (const attr of node.attributes.properties) {
    if (!ts.isJsxAttribute(attr)) continue;
    if (!ts.isIdentifier(attr.name) || attr.name.text !== 'i18nKey') continue;
    if (!attr.initializer) continue;
    const value = extractStaticTemplateSegments(attr.initializer);
    if (!value || value.dynamic) continue;
    const split = splitKeyByColon(value.text || '', scope);
    if (!split) continue;
    const line = sf.getLineAndCharacterOfPosition(node.getStart()).line + 1;
    occurrences.push({
      file: relPath,
      line,
      ns: split.ns,
      key: split.key,
      fullKey: split.fullKey,
      defaultValue: null,
    });
    return;
  }
}

function findUseTranslationScopeAtStatement(stmt, parentScope) {
  if (!stmt) return null;
  let initializer = null;
  if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) {
      if (decl.initializer && ts.isCallExpression(decl.initializer)) {
        if (matchCall(decl.initializer) === 'useTranslation') {
          initializer = decl.initializer;
          break;
        }
      }
    }
  } else if (ts.isExpressionStatement(stmt) && ts.isCallExpression(stmt.expression)) {
    if (matchCall(stmt.expression) === 'useTranslation') {
      initializer = stmt.expression;
    }
  }
  if (!initializer) return null;
  return resolveScopeFromUseTranslationCall(initializer, parentScope);
}

function visitBlock(block, parentScope, sf, relPath, occurrences) {
  let scope = parentScope;
  for (const stmt of block.statements) {
    const ut = findUseTranslationScopeAtStatement(stmt, scope);
    if (ut) scope = ut;
    visit(stmt, scope, sf, relPath, occurrences);
  }
}

function visit(node, parentScope, sf, relPath, occurrences) {
  let scope = parentScope;
  if (ts.isBlock(node)) {
    visitBlock(node, parentScope, sf, relPath, occurrences);
    return;
  }
  if (ts.isCallExpression(node)) {
    const sig = matchCall(node);
    if (sig === 'useTranslation') {
      scope = resolveScopeFromUseTranslationCall(node, parentScope);
      ts.forEachChild(node, (child) => visit(child, scope, sf, relPath, occurrences));
      return;
    }
    if (sig === 't') {
      recordTCall(node, scope, sf, relPath, occurrences);
    }
  }
  if (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) {
    recordJsxTrans(node, scope, sf, relPath, occurrences);
  }
  ts.forEachChild(node, (child) => visit(child, scope, sf, relPath, occurrences));
}

function extractKeysFromAst(filePath) {
  const relPath = path.relative(ROOT_DIR, filePath);
  const source = fs.readFileSync(filePath, 'utf8');
  const sf = ts.createSourceFile(filePath, source, ts.ScriptTarget.ES2022, true);
  const occurrences = [];
  visit(sf, { ns: null, keyPrefix: null }, sf, relPath, occurrences);
  return occurrences;
}

function extractKeysFromSource() {
  const files = getAllSourceFiles();
  const all = [];
  for (const f of files) {
    try {
      all.push(...extractKeysFromAst(f));
    } catch (err) {
      console.error(`[extract-i18n-keys] Failed to parse ${f}: ${err.message}`);
    }
  }
  return all;
}

function loadEnUSResource(ns) {
  const file = path.join(EN_US_DIR, `${ns}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {
    return {};
  }
}

function getLeafKeys(obj, prefix = '', out = new Set()) {
  for (const [k, v] of Object.entries(obj)) {
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      getLeafKeys(v, keyPath, out);
    } else {
      out.add(keyPath);
    }
  }
  return out;
}

function runAudit() {
  const canonicalKeysByNs = {};
  for (const ns of NAMESPACES) {
    canonicalKeysByNs[ns] = getLeafKeys(loadEnUSResource(ns));
  }

  const sourceKeys = extractKeysFromSource();
  const usedKeysSet = new Set();
  const seenMissing = new Set();
  const missingKeys = [];

  for (const item of sourceKeys) {
    usedKeysSet.add(item.fullKey);
    const nsKeys = canonicalKeysByNs[item.ns];
    if (!nsKeys || !nsKeys.has(item.key)) {
      if (!seenMissing.has(item.fullKey)) {
        seenMissing.add(item.fullKey);
        missingKeys.push(item);
      }
    }
  }

  const unusedKeys = [];
  for (const ns of NAMESPACES) {
    const keys = canonicalKeysByNs[ns];
    for (const key of keys) {
      const fullKey = `${ns}:${key}`;
      if (!usedKeysSet.has(fullKey)) unusedKeys.push(fullKey);
    }
  }

  if (!fs.existsSync(ARTIFACTS_DIR)) {
    fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
  }

  const report = {
    timestamp: new Date().toISOString(),
    extractor: 'typescript-compiler-api',
    skipDirs: Array.from(SKIP_DIRS).sort(),
    totalSourceKeyUsages: sourceKeys.length,
    uniqueSourceKeys: usedKeysSet.size,
    missingKeysCount: missingKeys.length,
    unusedKeysCount: unusedKeys.length,
    canonicalKeyCounts: Object.fromEntries(
      NAMESPACES.map((ns) => [ns, canonicalKeysByNs[ns].size]),
    ),
    missingKeys,
    unusedKeys,
  };

  fs.writeFileSync(
    path.join(ARTIFACTS_DIR, 'source-key-inventory.json'),
    JSON.stringify(report, null, 2),
    'utf8',
  );

  let md = `# i18n Source Key Inventory Audit Report\n\n`;
  md += `**Generated At:** ${report.timestamp}\n`;
  md += `**Extractor:** \`${report.extractor}\` (TS Compiler API; captures multi-line calls, template literals, \`useTranslation\` \`keyPrefix\`, \`Trans\` \`i18nKey\`, and \`i18n.t\`/\`i18next.t\`).\n`;
  md += `**Total Source Key Usages:** ${report.totalSourceKeyUsages}\n`;
  md += `**Unique Source Keys:** ${report.uniqueSourceKeys}\n`;
  md += `**Missing Canonical Keys:** ${report.missingKeysCount}\n`;
  md += `**Unused Canonical Keys:** ${report.unusedKeysCount}\n\n`;
  md += `## Canonical Key Counts per Namespace\n\n`;
  md += `| Namespace | Keys |\n| --- | --- |\n`;
  for (const ns of NAMESPACES) {
    md += `| \`${ns}\` | ${report.canonicalKeyCounts[ns]} |\n`;
  }
  if (missingKeys.length > 0) {
    md += `\n## Missing Canonical Keys (${missingKeys.length})\n\n`;
    md += `| File:Line | Namespace | Key | Default Value |\n| --- | --- | --- | --- |\n`;
    for (const m of missingKeys) {
      md += `| \`${m.file}:${m.line}\` | \`${m.ns}\` | \`${m.key}\` | ${m.defaultValue ? `"${m.defaultValue.replace(/\|/g, '\\|')}"` : '_None_'} |\n`;
    }
  } else {
    md += `\n## Missing Canonical Keys\n\nAll keys used in source code exist in canonical \`en-US\` catalogs.\n`;
  }
  if (unusedKeys.length > 0) {
    md += `\n## Canonical Keys With No Source Usage (${unusedKeys.length})\n\n`;
    md += unusedKeys.map((k) => `- \`${k}\``).join('\n');
    md += `\n`;
  }

  fs.writeFileSync(path.join(ARTIFACTS_DIR, 'source-key-inventory.md'), md, 'utf8');

  console.log(
    `i18n Key Extraction Audit Completed. Total source usages: ${sourceKeys.length}, unique: ${usedKeysSet.size}, missing: ${missingKeys.length}, unused: ${unusedKeys.length}.`,
  );
  return report;
}

if (require.main === module) {
  runAudit();
}

module.exports = { extractKeysFromSource, runAudit, extractKeysFromAst, VISIBLE_NAMESPACES: NAMESPACES };
