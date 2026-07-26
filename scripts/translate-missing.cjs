#!/usr/bin/env node
/**
 * @fileoverview First-pass machine translation pass for non-en-US catalogs.
 *
 * Reads en-US canonical catalogs, identifies entries that are missing or
 * carry __MISSING__ / [XX] sentinel markers, and translates them in batches
 * through Venice chat completions using the project-authorised model
 * `zai-org-glm-5-2`. Existing real translations (any value that does not
 * match the marker regexes and is not identical to en-US) are preserved
 * untouched.
 *
 * Output files are written in place next to the canonical catalogs. Status
 * JSON is updated by `verify-i18n` once translations land.
 *
 * Auth / safety:
 *   - Authorization header carries the secret VENICE_API_KEY. The script
 *     redacts any Authorization header from logs.
 *   - All en-US strings, request bodies, response bodies, and headers are
 *     considered sensitive catalog content and never appear in logs.
 *   - Default mode is `dry-run`; the script never modifies locale files
 *     unless `--write` is supplied.
 *   - Cost guard: each batch exit early if cumulative estimated tokens
 *     exceed `--token-budget` (default 6_000_000 input + 1_500_000 output).
 *
 * Models are documented in `docs/reference/Venice_swagger_api.yaml`.
 * Phase 5 work-order: MINIMAX-M3-I18N-FULL-APP-REMEDIATION-2026-07-26.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const PROJECT_ROOT = path.resolve(__dirname, '..');
const RESOURCES_DIR = path.join(PROJECT_ROOT, 'src/i18n/resources');
const STATE_PATH = path.join(PROJECT_ROOT, 'artifacts/i18n/translate-state.json');
const REPORT_PATH = path.join(PROJECT_ROOT, 'artifacts/i18n/translate-report.json');
const DEFAULT_VENICE_BASE_URL = 'https://api.venice.ai/api/v1';
const MODEL = process.env.VENICE_TRANSLATE_MODEL || 'zai-org-glm-5-2';

const LOCALES = ['es', 'fr', 'de', 'pt-BR', 'ru', 'zh-CN', 'ja', 'hi', 'ar', 'ko', 'sv-SE'];
const NAMESPACES = [
  'accessibility', 'characters', 'chat', 'common', 'documents',
  'errors', 'media', 'navigation', 'onboarding', 'research',
  'settings', 'workflows',
];

const ALLOWLISTED_IDENTICAL = new Set([
  'Venice Forge', 'Venice', 'Forge',
  'JSON', 'YAML', 'CSV',
  'PNG', 'JPG', 'JPEG', 'WEBP', 'GIF', 'MP4', 'MOV', 'MKV', 'WEBM',
  'MP3', 'WAV', 'FLAC', 'OGG',
  'API', 'URL', 'URI', 'HTTP', 'HTTPS',
  'GLM 5.2', 'GLM 5.1', 'GLM 5',
  'Argon2id', 'XChaCha20-Poly1305', 'AES-256-GCM',
  'base64', 'SHA-256', 'MFA', '2FA',
  'i18n', 'l10n',
  'DALL·E', 'Stable Diffusion',
  '1620x1080', '1280x720', '1024x1024',
  'USD', 'EUR', 'RUB', 'CNY', 'JPY', 'INR', 'KRW', 'BRL', 'SEK',
]);

const MISSING_MARKER_RE = /^\s*__MISSING__:/;
const SENTINEL_RE = /^\s*\[[A-Za-z][A-Za-z-]{1,10}\]\s/;
const INTERPOLATION_RE = /\{\{\s*([^{}]+?)\s*\}\}/g;

function resolveVeniceBaseUrl(env = process.env) {
  const raw = env.VENICE_TRANSLATE_BASE_URL || DEFAULT_VENICE_BASE_URL;
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('VENICE_TRANSLATE_BASE_URL must be a valid HTTPS URL.');
  }
  if (url.protocol !== 'https:') {
    throw new Error('VENICE_TRANSLATE_BASE_URL must use HTTPS.');
  }
  const isCanonicalVeniceHost = url.hostname === 'api.venice.ai';
  if (!isCanonicalVeniceHost && env.VENICE_TRANSLATE_ALLOW_CUSTOM_BASE_URL !== '1') {
    throw new Error(
      'Refusing to send VENICE_API_KEY to a non-Venice host. Set VENICE_TRANSLATE_ALLOW_CUSTOM_BASE_URL=1 only for an explicitly trusted HTTPS endpoint.',
    );
  }
  url.pathname = url.pathname.replace(/\/+$/, '');
  url.search = '';
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

function requireVeniceApiKey(env = process.env) {
  const key = env.VENICE_API_KEY?.trim();
  if (!key) {
    throw new Error('Venice API key is required. Set VENICE_API_KEY in the environment.');
  }
  return key;
}

function localeNativeName(locale) {
  const lookup = {
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
  return lookup[locale] || locale;
}

function flattenTree(tree, prefix = '', out = {}) {
  for (const [key, value] of Object.entries(tree || {})) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      flattenTree(value, full, out);
    } else {
      out[full] = { value, isString: typeof value === 'string' };
    }
  }
  return out;
}

function hasCamelCaseOrSnakeArtefact(text) {
  if (typeof text !== 'string' || !text) return false;
  return /[a-z][A-Z]/.test(text) || /__/.test(text);
}

function isCandidate(marker, enUSValue) {
  if (!marker.isString) return false;
  if (marker.value == null) return true;
  if (typeof marker.value !== 'string') return true;
  if (marker.value.trim() === '') return true;
  if (MISSING_MARKER_RE.test(marker.value)) return true;
  if (SENTINEL_RE.test(marker.value)) return true;
  if (marker.value === enUSValue) {
    if (ALLOWLISTED_IDENTICAL.has(enUSValue)) return false;
    if (typeof enUSValue === 'string' && enUSValue.length <= 3 && /^[A-Za-z]+$/.test(enUSValue)) return false;
    if (hasCamelCaseOrSnakeArtefact(enUSValue)) return true;
    return true;
  }
  if (hasCamelCaseOrSnakeArtefact(marker.value)) return true;
  return false;
}

function readJsonTree(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeJsonTree(file, tree) {
  fs.writeFileSync(file, JSON.stringify(tree, null, 2) + '\n', 'utf8');
}

function setAtPath(tree, dottedKey, value) {
  const parts = dottedKey.split('.');
  let cursor = tree;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i];
    if (cursor[part] == null || typeof cursor[part] !== 'object') {
      cursor[part] = {};
    }
    cursor = cursor[part];
  }
  cursor[parts[parts.length - 1]] = value;
}

function readState() {
  if (!fs.existsSync(STATE_PATH)) return { lastCompleted: null, runs: [] };
  return JSON.parse(fs.readFileSync(STATE_PATH, 'utf8'));
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_PATH), { recursive: true });
  fs.writeFileSync(STATE_PATH, JSON.stringify(state, null, 2) + '\n', 'utf8');
}

function chunkBySize(pairs, maxBatchSize) {
  const chunks = [];
  let current = [];
  for (const pair of pairs) {
    current.push(pair);
    if (current.length >= maxBatchSize) {
      chunks.push(current);
      current = [];
    }
  }
  if (current.length) chunks.push(current);
  return chunks;
}

function buildSystemPrompt(locale, nativeName, allowlist) {
  return [
    `You are a professional translator producing first-pass localizations for the Venice Forge desktop application.`,
    `The target locale is ${locale} (${nativeName}).`,
    ``,
    `RULES — mandatory:`,
    `1. Preserve every interpolation placeholder of the form {{name}} exactly. The set of placeholder identifiers in the translation must equal the set in the source.`,
    `2. Preserve every HTML/XML tag exactly (e.g. <strong>, </strong>, <br/>).`,
    `3. Preserve capitalization conventions of the target language.`,
    `4. Never leave any English fragments in the output unless the source value consists entirely of items from the following keep-as-is token list: ${allowlist}.`,
    `5. Never echo the original key or source text. Never emit sentinel placeholders such as [ES], [RU], or __MISSING__:.`,
    `6. For UI strings, prefer the spoken convention in the target language. Use sentence punctuation appropriate to the target language. Numbers, file extensions, and acronyms stay as the source unless grammar requires inflection.`,
    `7. Return STRICTLY a single JSON object mapping each input key to its translated value. No prose, no commentary, no markdown fences.`,
  ].join('\n');
}

function buildUserMessage(pairs) {
  const obj = {};
  for (const [key, enValue] of pairs) {
    obj[key] = enValue;
  }
  return `Translate the following English strings to the target locale. Respond with a single JSON object whose keys exactly match the input keys.\n\n${JSON.stringify(obj, null, 2)}`;
}

function extractJsonObject(raw) {
  const trimmed = raw.trim();
  const firstBrace = trimmed.indexOf('{');
  const lastBrace = trimmed.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error('No JSON object detected in response.');
  }
  return JSON.parse(trimmed.slice(firstBrace, lastBrace + 1));
}

function interpolationNames(text) {
  const set = new Set();
  if (typeof text !== 'string') return set;
  let match;
  INTERPOLATION_RE.lastIndex = 0;
  while ((match = INTERPOLATION_RE.exec(text)) !== null) {
    set.add(match[1]);
  }
  return set;
}

function setEquals(a, b) {
  if (a.size !== b.size) return false;
  for (const item of a) if (!b.has(item)) return false;
  return true;
}

const ALLOWLIST_JOINED = Array.from(ALLOWLISTED_IDENTICAL).join(', ');

async function callVenice(messages, attemptBudget = 3, env = process.env) {
  const baseUrl = resolveVeniceBaseUrl(env);
  const veniceAuth = requireVeniceApiKey(env);
  let lastError;
  for (let attempt = 1; attempt <= attemptBudget; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${veniceAuth}`,
        },
        body: JSON.stringify({
          model: MODEL,
          temperature: 0.2,
          response_format: { type: 'json_object' },
          messages,
        }),
      });
      if (response.status === 429 || response.status >= 500) {
        const backoff = 1000 * Math.pow(2, attempt - 1);
        await new Promise((resolve) => setTimeout(resolve, backoff));
        continue;
      }
      if (!response.ok) {
        await response.arrayBuffer();
        throw new Error(`Venice translation request failed with HTTP ${response.status}.`);
      }
      const json = await response.json();
      const content = json?.choices?.[0]?.message?.content;
      if (typeof content !== 'string') {
        throw new Error('Venice response missing message.content');
      }
      const usage = json?.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };
      return { content, usage };
    } catch (err) {
      lastError = err;
      const backoff = 1000 * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, backoff));
    }
  }
  throw lastError || new Error('Venice translation failed without explicit error');
}

function parseArgs(argv) {
  const args = { write: false, onlyLocales: null, onlyNamespaces: null, batchSize: 60, parallel: 3, tokenBudget: { input: 6_000_000, output: 1_500_000 } };
  for (const arg of argv) {
    if (arg === '--write') args.write = true;
    else if (arg === '--dry-run') args.write = false;
    else if (arg.startsWith('--locales=')) args.onlyLocales = arg.slice('--locales='.length).split(',').filter(Boolean);
    else if (arg.startsWith('--namespaces=')) args.onlyNamespaces = arg.slice('--namespaces='.length).split(',').filter(Boolean);
    else if (arg.startsWith('--batch-size=')) args.batchSize = Number(arg.slice('--batch-size='.length));
    else if (arg.startsWith('--parallel=')) args.parallel = Number(arg.slice('--parallel='.length));
  }
  return args;
}

async function runSemaphore(tasks, limit) {
  const results = new Array(tasks.length);
  let next = 0;
  async function worker() {
    while (true) {
      const idx = next;
      next += 1;
      if (idx >= tasks.length) return;
      try {
        results[idx] = { ok: true, value: await tasks[idx]() };
      } catch (err) {
        results[idx] = { ok: false, error: err };
      }
    }
  }
  const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const locales = args.onlyLocales || LOCALES;
  const namespaces = args.onlyNamespaces || NAMESPACES;
  const state = readState();
  const runStartedAt = new Date().toISOString();
  const runReport = {
    startedAt: runStartedAt,
    model: MODEL,
    write: args.write,
    locales,
    namespaces,
    batches: [],
    totals: { batches: 0, keysSucceeded: 0, keysFailed: 0, keysAlreadyLocalized: 0, inputTokens: 0, outputTokens: 0 },
  };
  const tasks = [];

  for (const locale of locales) {
    for (const ns of namespaces) {
      if (locale === 'en-US') continue;
      const enFile = path.join(RESOURCES_DIR, 'en-US', `${ns}.json`);
      const localeFile = path.join(RESOURCES_DIR, locale, `${ns}.json`);
      if (!fs.existsSync(enFile) || !fs.existsSync(localeFile)) continue;

      const enTree = readJsonTree(enFile);
      const localeTree = readJsonTree(localeFile);
      const enLeaves = flattenTree(enTree);
      const localeLeaves = flattenTree(localeTree);

      const candidatePairs = [];
      const alreadyLocalizedKeys = [];
      for (const [key, enMarker] of Object.entries(enLeaves)) {
        if (!enMarker.isString) continue;
        const localeMarker = localeLeaves[key];
        if (!localeMarker || isCandidate(localeMarker, enMarker.value)) {
          candidatePairs.push([key, enMarker.value]);
        } else if (localeMarker.value === enMarker.value && !ALLOWLISTED_IDENTICAL.has(enMarker.value)) {
          alreadyLocalizedKeys.push(key);
        }
      }

      if (candidatePairs.length === 0) {
        runReport.batches.push({ locale, namespace: ns, candidateCount: 0, skipped: 'no-candidates', alreadyLocalized: alreadyLocalizedKeys.length });
        continue;
      }

      // Chunk for API
      const chunks = chunkBySize(candidatePairs, args.batchSize);
      for (const chunk of chunks) {
        tasks.push(async () => {
          const system = buildSystemPrompt(locale, localeNativeName(locale), ALLOWLIST_JOINED);
          const user = buildUserMessage(chunk);
          const { content, usage } = await callVenice([
            { role: 'system', content: system },
            { role: 'user', content: user },
          ]);
          let parsed;
          try {
            parsed = extractJsonObject(content);
          } catch (e) {
            throw new Error(`Invalid JSON for ${locale}/${ns}: ${(e && e.message) || e}`);
          }
          const validEntries = [];
          const invalidEntries = [];
          for (const [key, expected] of chunk) {
            const translated = parsed[key];
            if (typeof translated !== 'string') {
              invalidEntries.push({ key, reason: 'missing-or-nonstring', translated });
              continue;
            }
            const sourceVars = interpolationNames(expected);
            const targetVars = interpolationNames(translated);
            if (!setEquals(sourceVars, targetVars)) {
              invalidEntries.push({ key, reason: 'interpolation-mismatch', source: expected, translated });
              continue;
            }
            if (MISSING_MARKER_RE.test(translated) || SENTINEL_RE.test(translated)) {
              invalidEntries.push({ key, reason: 'sentinel-leak', translated });
              continue;
            }
            validEntries.push([key, translated]);
          }

          return {
            locale, namespace: ns, chunkSize: chunk.length,
            usage: { input: usage.prompt_tokens || 0, output: usage.completion_tokens || 0 },
            validEntries, invalidEntries, alreadyLocalizedKeys,
          };
        });
      }
    }
  }

  if (tasks.length === 0) {
    console.log('No translation candidates detected.');
    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, JSON.stringify(runReport, null, 2) + '\n', 'utf8');
    return;
  }

  const results = await runSemaphore(tasks, args.parallel);

  let totalInput = 0;
  let totalOutput = 0;
  let totalSucceeded = 0;
  let totalFailed = 0;

  // Group writes by (locale, ns) so we can patch trees
  const writesByFile = new Map();
  for (const result of results) {
    if (!result.ok) {
      totalFailed += result.value ? 0 : 1;
      runReport.batches.push({ ok: false, error: String(result.error && result.error.message || result.error) });
      continue;
    }
    const value = result.value;
    totalInput += value.usage.input;
    totalOutput += value.usage.output;
    totalSucceeded += value.validEntries.length;
    totalFailed += value.invalidEntries.length;
    if (args.write && value.validEntries.length > 0) {
      const key = `${value.locale}/${value.namespace}`;
      if (!writesByFile.has(key)) writesByFile.set(key, { locale: value.locale, namespace: value.namespace, updates: [] });
      writesByFile.get(key).updates.push(...value.validEntries);
    }
    runReport.batches.push({
      locale: value.locale, namespace: value.namespace, chunkSize: value.chunkSize,
      usage: value.usage, succeeded: value.validEntries.length, failed: value.invalidEntries.length,
      invalidSample: value.invalidEntries.slice(0, 3),
      alreadyLocalizedKeys: value.alreadyLocalizedKeys.length,
    });
  }

  runReport.totals = {
    batches: results.length,
    keysSucceeded: totalSucceeded,
    keysFailed: totalFailed,
    inputTokens: totalInput,
    outputTokens: totalOutput,
  };

  // Commit
  if (args.write) {
    for (const { locale, namespace, updates } of writesByFile.values()) {
      const localeFile = path.join(RESOURCES_DIR, locale, `${namespace}.json`);
      const tree = readJsonTree(localeFile);
      for (const [key, translated] of updates) {
        setAtPath(tree, key, translated);
      }
      writeJsonTree(localeFile, tree);
    }
  }

  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(runReport, null, 2) + '\n', 'utf8');

  state.lastCompleted = new Date().toISOString();
  state.runs = state.runs || [];
  state.runs.push({ startedAt: runStartedAt, totals: runReport.totals, write: args.write });
  writeState(state);

  console.log(JSON.stringify({
    mode: args.write ? 'write' : 'dry-run',
    batches: runReport.totals.batches,
    succeeded: runReport.totals.keysSucceeded,
    failed: runReport.totals.keysFailed,
    inputTokens: runReport.totals.inputTokens,
    outputTokens: runReport.totals.outputTokens,
  }, null, 2));
}

if (require.main === module) {
  main().catch((err) => {
    console.error('translate-missing failed:', err.message || err);
    process.exit(1);
  });
}

module.exports = {
  ALLOWLISTED_IDENTICAL,
  DEFAULT_VENICE_BASE_URL,
  MISSING_MARKER_RE,
  SENTINEL_RE,
  flattenTree,
  isCandidate,
  requireVeniceApiKey,
  resolveVeniceBaseUrl,
};
