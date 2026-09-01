#!/usr/bin/env node
"use strict";

/**
 * One-off migration script: converts src/theme/builtins/*.ts from single-mode
 * Theme objects to ThemeFamily objects with generated companion variants.
 * Companion variants are produced by mapping colors through HSL lightness
 * (not RGB inversion) so the hue/saturation personality is preserved.
 *
 * After running this script the files still need visual review, but the
 * resulting families satisfy the V2 structural contract.
 */

const fs = require("fs");
const path = require("path");

const BUILTINS_DIR = path.resolve(__dirname, "../src/theme/builtins");

function hexToRgb(hex) {
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(hex.trim());
  if (!m) return null;
  const full = m[1].length === 3 ? m[1].split("").map((c) => c + c).join("") : m[1];
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]) {
  const clamp = (v) => Math.max(0, Math.min(255, Math.round(v)));
  const toHex = (v) => clamp(v).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsl([r, g, b]) {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return [h * 360, s * 100, l * 100];
}

function hslToRgb([h, s, l]) {
  h /= 360; s /= 100; l /= 100;
  let r, g, b;
  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p, q, t) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }
  return [r * 255, g * 255, b * 255];
}

function isHex(value) {
  return typeof value === "string" && /^#?[0-9a-fA-F]{3,6}$/.test(value.trim());
}

function isRgba(value) {
  return typeof value === "string" && /^rgba?\(/i.test(value);
}

function mapHex(hex, direction) {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  const [h, s, l] = rgbToHsl(rgb);
  // Map lightness toward the opposite end, but not all the way, to keep
  // the palette recognizable.
  const targetL = direction === "light"
    ? Math.max(l, 30 + (1 - l / 100) * 45)
    : Math.min(l, 70 - (l / 100) * 45);
  // Reduce saturation slightly in the generated companion for readability.
  const targetS = direction === "light" ? s * 0.85 : s * 0.9;
  return rgbToHex(hslToRgb([h, targetS, targetL]));
}

function transformTokenValue(value, direction) {
  if (isHex(value)) return mapHex(value, direction);
  // Preserve rgba(...) values by leaving them unchanged; they are mostly
  // overlays and glows that the editor can tweak later.
  if (isRgba(value)) return value;
  return value;
}

function generateCompanion(tokens, direction) {
  const out = {};
  for (const [key, value] of Object.entries(tokens)) {
    out[key] = transformTokenValue(value, direction);
  }
  return out;
}

function parseExistingFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const exportMatch = /export const (BUILTIN_[A-Z_]+): Theme = \{([\s\S]*?)\n\};/.exec(content);
  if (!exportMatch) {
    throw new Error(`Could not parse ${filePath}`);
  }
  const constName = exportMatch[1];
  const body = exportMatch[2];

  const idMatch = /id:\s*["']([^"']+)["']/.exec(body);
  const nameMatch = /name:\s*["']([^"']+)["']/.exec(body);
  const modeMatch = /mode:\s*["'](dark|light)["']/.exec(body);

  if (!idMatch || !nameMatch || !modeMatch) {
    throw new Error(`Missing id/name/mode in ${filePath}`);
  }

  const id = idMatch[1];
  const name = nameMatch[1];
  const mode = modeMatch[1];

  // Extract the tokens object. It may be passed to completeThemeTokens(...) or
  // written as a literal. We look for the first object literal after "tokens:".
  const tokensMatch = /tokens:\s*(?:completeThemeTokens\(["'](dark|light)["'],\s*)?\{([\s\S]*?)\n\s*\}\)?/.exec(body);
  if (!tokensMatch) {
    throw new Error(`Could not parse tokens in ${filePath}`);
  }
  const tokensSource = `{${tokensMatch[2]}\n}`;
  // Evaluate safely-ish in a new VM context; the source is project-owned.
  const tokens = (new Function(`return ${tokensSource}`))();

  return { constName, id, name, mode, tokens };
}

function renderFamily({ constName, id, name, mode, tokens }) {
  const familyId = id.replace(/^builtin-/, "");
  const aliases = [...new Set([`builtin-${familyId}`, id])];

  const lightTokens = mode === "light" ? tokens : generateCompanion(tokens, "light");
  const darkTokens = mode === "dark" ? tokens : generateCompanion(tokens, "dark");

  const render = (t) =>
    Object.entries(t)
      .map(([k, v]) => `      ${k}: ${JSON.stringify(v)},`)
      .join("\n");

  return `import { completeThemeTokens, type ThemeFamily } from '../themeTypes';

export const ${constName}: ThemeFamily = {
  schemaVersion: 2,
  id: ${JSON.stringify(familyId)},
  name: ${JSON.stringify(name)},
  aliases: ${JSON.stringify(aliases)},
  builtIn: true,
  variants: {
    light: {
      tokens: completeThemeTokens('light', {
${render(lightTokens)}
      }),
    },
    dark: {
      tokens: completeThemeTokens('dark', {
${render(darkTokens)}
      }),
    },
  },
};
`;
}

function main() {
  const files = fs.readdirSync(BUILTINS_DIR)
    .filter((f) => f.endsWith(".ts") && f !== "index.ts")
    .sort();

  const metadata = [];
  for (const file of files) {
    const filePath = path.join(BUILTINS_DIR, file);
    const parsed = parseExistingFile(filePath);
    const output = renderFamily(parsed);
    fs.writeFileSync(filePath, output, "utf8");
    metadata.push({ file, id: parsed.id, familyId: parsed.id.replace(/^builtin-/, ""), mode: parsed.mode });
  }

  // Report potential manual-review needs: single-mode themes whose companion
  // was generated rather than authored.
  const generated = metadata.filter((m) => {
    const counterpart = metadata.find((o) => o.familyId === m.familyId && o !== m);
    return !counterpart;
  });

  console.log(`Rewrote ${metadata.length} built-in theme files to ThemeFamily V2.`);
  if (generated.length > 0) {
    console.log(`Generated companion variants (review recommended): ${generated.map((m) => m.familyId).join(", ")}`);
  }
}

main();
