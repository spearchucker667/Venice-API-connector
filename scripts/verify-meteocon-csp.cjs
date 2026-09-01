const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const METEOCON_SOURCE = path.join(REPO_ROOT, 'src', 'components', 'ui', 'Meteocon.tsx');
const DIST_DIR = path.join(REPO_ROOT, 'dist');

const STYLE_ELEMENT_RE = /<style\b/i;
const STYLE_ATTR_RE = /\sstyle=/i;

/**
 * Strips JS/TS block and line comments so that documentation mentioning
 * `<style>` or `style=` does not trigger the source-level scan.
 *
 * @param {string} source
 * @returns {string}
 */
function stripComments(source) {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

/**
 * Scans a single markup string for inline SVG style violations.
 *
 * @param {string} markup The markup or source string to scan.
 * @returns {string[]} Human-readable violation descriptions.
 */
function scanMeteoconMarkup(markup) {
  const violations = [];
  if (STYLE_ELEMENT_RE.test(markup)) {
    violations.push('contains prohibited style element (<style>)');
  }
  if (STYLE_ATTR_RE.test(markup)) {
    violations.push('contains prohibited style attribute (style=)');
  }
  return violations;
}

/**
 * Recursively collects file paths matching the given predicate.
 *
 * @param {string} dir Directory to walk.
 * @param {(file: string) => boolean} predicate
 * @returns {string[]}
 */
function walk(dir, predicate) {
  const results = [];
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walk(full, predicate));
    } else if (predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

/**
 * Extracts the set of @meteocons SVG paths imported by the Meteocon source.
 *
 * @param {string} sourcePath Path to Meteocon.tsx.
 * @returns {string[]} Relative paths inside node_modules (e.g. @meteocons/svg/fill/wind.svg).
 */
function extractImportedMeteoconPaths(sourcePath) {
  const source = fs.readFileSync(sourcePath, 'utf-8');
  const paths = [];
  const importRe = /import\s+\w+\s+from\s+['"](@meteocons\/svg\/fill\/[^'"]+\.svg)\?raw['"];?/g;
  let match;
  while ((match = importRe.exec(source)) !== null) {
    paths.push(match[1]);
  }
  return paths;
}

function main() {
  const violations = [];

  // 1. The component source itself must not inject inline styles.
  const componentSource = fs.readFileSync(METEOCON_SOURCE, 'utf-8');
  const componentViolations = scanMeteoconMarkup(stripComments(componentSource));
  if (componentViolations.length > 0) {
    violations.push(`src/components/ui/Meteocon.tsx: ${componentViolations.join(', ')}`);
  }

  // 2. The built renderer assets must not carry inline SVG style markup.
  if (fs.existsSync(DIST_DIR)) {
    const distFiles = walk(
      DIST_DIR,
      (file) => file.endsWith('.js') || file.endsWith('.svg'),
    );

    for (const file of distFiles) {
      const rel = path.relative(REPO_ROOT, file);
      const content = fs.readFileSync(file, 'utf-8');
      const isMeteoconRelated =
        /Meteocon/i.test(rel) ||
        /id="(wind|cloudy|partly-cloudy-day|thunderstorms|compass|barometer|star|time-morning|time-night|rainbow-clear|horizon|code-purple|code-green|umbrella|weather-alarm|humidity|thermometer|tornado|raindrop|snowflake)"/i.test(content);
      if (!isMeteoconRelated) continue;

      const fileViolations = scanMeteoconMarkup(content);
      if (fileViolations.length > 0) {
        violations.push(`${rel}: ${fileViolations.join(', ')}`);
      }
    }
  }

  if (violations.length > 0) {
    console.error('Meteocon CSP violations found:');
    for (const violation of violations) {
      console.error(`  - ${violation}`);
    }
    process.exit(1);
  }

  console.log('No Meteocon CSP violations found.');
}

module.exports = {
  scanMeteoconMarkup,
  extractImportedMeteoconPaths,
};

if (require.main === module) {
  main();
}
