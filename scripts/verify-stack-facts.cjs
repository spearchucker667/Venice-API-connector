#!/usr/bin/env node
/** Verifies active stack claims against package.json dependency majors. */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const major = (name) => Number(String(pkg.dependencies?.[name] || pkg.devDependencies?.[name]).match(/\d+/)?.[0]);
const expected = {
  Electron: major('electron'),
  Vite: major('vite'),
  Express: major('express'),
};
const failures = [];
// CLAUDE.md, GEMINI.md, .windsurfrules removed in 2026-08-22 hygiene pass.
// .cursorrules is now a thin pointer to AGENTS.md.
const assertions = {
  'README.md': [`Electron ${expected.Electron}`],
  'docs/ABOUT.md': [`Vite ${expected.Vite}`, `Electron ${expected.Electron}`, `Express ${expected.Express}`],
  '.cursorrules': ['# See AGENTS.md'],
};

for (const [file, snippets] of Object.entries(assertions)) {
  const text = fs.readFileSync(path.join(root, file), 'utf8');
  for (const snippet of snippets) {
    if (!text.includes(snippet)) failures.push(`${file} is missing canonical stack fact: ${snippet}`);
  }
}

if (failures.length > 0) {
  process.stderr.write(`${failures.join('\n')}\n`);
  process.exit(1);
}
process.stdout.write(`Stack facts match package.json: Electron ${expected.Electron}, Vite ${expected.Vite}, Express ${expected.Express}.\n`);
