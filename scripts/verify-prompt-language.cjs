/**
 * @fileoverview Verification script for AI prompt language directives.
 * Enforces that runtime AI prompts do not contain unjustified English-only constraints.
 */

const fs = require('fs');
const path = require('path');

const ROOT_DIR = path.join(__dirname, '..');
const MANIFEST_PATH = path.join(ROOT_DIR, 'config', 'prompt-language-audit.json');

if (!fs.existsSync(MANIFEST_PATH)) {
  console.error('Error: config/prompt-language-audit.json manifest not found.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

const FORBIDDEN_PATTERNS = [
  /respond\s+(?:only\s+)?in\s+english/i,
  /always\s+(?:answer|respond)\s+in\s+english/i,
  /english\s+only/i,
  /translate\s+all\s+input\s+to\s+english/i,
  /must\s+be\s+in\s+english/i,
];

const PROMPT_SOURCE_DIRS = [
  path.join(ROOT_DIR, 'src', 'constants'),
  path.join(ROOT_DIR, 'src', 'services'),
  path.join(ROOT_DIR, 'src', 'agent'),
  path.join(ROOT_DIR, 'electron', 'agent'),
];

let violations = [];

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const relPath = path.relative(ROOT_DIR, filePath);

  for (const pattern of FORBIDDEN_PATTERNS) {
    const match = content.match(pattern);
    if (match) {
      // Check if file is in allowlist manifest
      const isAllowed = manifest.allowedEnglishDirectives.some((entry) => {
        return relPath.includes(entry.file) || entry.file.includes(relPath);
      });

      if (!isAllowed) {
        violations.push({
          file: relPath,
          matched: match[0],
          pattern: pattern.toString(),
        });
      }
    }
  }
}

function scanDirectory(dirPath) {
  if (!fs.existsSync(dirPath)) return;
  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dirPath, entry.name);
    if (entry.isDirectory()) {
      scanDirectory(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx') || entry.name.endsWith('.json'))) {
      scanFile(fullPath);
    }
  }
}

for (const dir of PROMPT_SOURCE_DIRS) {
  scanDirectory(dir);
}

if (violations.length > 0) {
  console.error('❌ Prompt Language Verification Failed!');
  console.error('Found unjustified English-only prompt directives:');
  for (const v of violations) {
    console.error(` - File: ${v.file}`);
    console.error(`   Matched: "${v.matched}"`);
    console.error(`   Pattern: ${v.pattern}`);
  }
  process.exit(1);
} else {
  console.log('✓ Prompt Language Verification Passed (0 unjustified English-only directives).');
}
