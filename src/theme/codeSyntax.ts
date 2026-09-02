import { CODE_SYNTAX_PRESETS } from './codeSyntaxPresets';
import {
  type CodeSyntaxPresetId,
  type CodeThemeConfig,
  type CodeThemeDerivationContext,
  type CodeThemeInput,
  type CodeThemeTokens,
  CODE_THEME_TOKEN_KEYS,
  CODE_SURFACE_TOKEN_KEYS,
  CODE_SYNTAX_TOKEN_KEYS,
} from './themeTypes';
import { luminance } from './contrast';

export {
  CODE_THEME_TOKEN_KEYS,
  CODE_SURFACE_TOKEN_KEYS,
  CODE_SYNTAX_TOKEN_KEYS,
};

export { CODE_SYNTAX_PRESETS } from './codeSyntaxPresets';

/**
 * Return true if the value is a known bundled preset identifier.
 */
export function isCodeSyntaxPresetId(value: unknown): value is CodeSyntaxPresetId {
  return typeof value === 'string' && value in CODE_SYNTAX_PRESETS;
}

/**
 * Coerce a string to a known preset identifier, falling back to 'automatic'.
 */
export function normalizeCodeSyntaxPresetId(value: unknown): CodeSyntaxPresetId {
  return isCodeSyntaxPresetId(value) ? value : 'automatic';
}

/**
 * Resolve a complete code theme for a given preset and mode.
 */
export function resolveCodeThemeTokens(
  preset: CodeSyntaxPresetId,
  mode: 'light' | 'dark',
): CodeThemeTokens {
  const presetData = CODE_SYNTAX_PRESETS[preset] ?? CODE_SYNTAX_PRESETS.automatic;
  return presetData[mode];
}

/**
 * Derive a readable automatic code theme from the active UI tokens. Used as a
 * deterministic fallback for legacy themes or partial code configurations.
 */
function fallbackHex(value: string | undefined, fallback: string): string {
  return typeof value === 'string' && value.startsWith('#') ? value : fallback;
}

export function deriveCodeThemeTokens(ctx: CodeThemeDerivationContext): CodeThemeTokens {
  const { mode, tokens } = ctx;
  const isLight = mode === 'light';
  const bg = fallbackHex(tokens.background, isLight ? '#ffffff' : '#0a0a0c');
  const fg = fallbackHex(tokens.foreground, isLight ? '#1f2937' : '#e5e7eb');
  const accent = fallbackHex(tokens.accent, isLight ? '#2563eb' : '#63b3ed');
  const secondary = fallbackHex(tokens.link ?? tokens.info, accent);
  const success = fallbackHex(tokens.success, isLight ? '#16a34a' : '#4ade80');
  const danger = fallbackHex(tokens.danger, isLight ? '#dc2626' : '#f87171');
  const warning = fallbackHex(tokens.warning, isLight ? '#ca8a04' : '#facc15');

  const surfaceLum = luminance(bg);
  const surfaceMix = (mix: string, amount: number) => blend(bg, mix, amount);
  const textDim = surfaceLum > 0.5 ? darken(fg, 0.35) : lighten(fg, 0.35);

  return {
    background: surfaceMix(bg, 0.04),
    foreground: fg,
    border: surfaceMix(fg, 0.12),
    headerBackground: surfaceMix(bg, 0.08),
    headerForeground: textDim,
    inlineBackground: surfaceMix(fg, 0.08),
    inlineForeground: fg,
    selectionBackground: blend(accent, bg, 0.25),

    comment: textDim,
    punctuation: fg,
    property: accent,
    tag: danger,
    boolean: accent,
    number: accent,
    constant: accent,
    symbol: accent,
    deleted: danger,
    selector: success,
    attribute: accent,
    string: secondary,
    character: secondary,
    builtin: accent,
    inserted: success,
    operator: fg,
    entity: danger,
    url: secondary,
    atRule: danger,
    keyword: danger,
    function: isLight ? darken(accent, 0.15) : lighten(accent, 0.15),
    className: isLight ? darken(accent, 0.15) : lighten(accent, 0.15),
    regex: warning,
    important: danger,
    variable: fg,
  };
}

/**
 * Complete a partial code theme input into a full CodeThemeConfig.
 */
export function completeCodeThemeConfig(
  mode: 'light' | 'dark',
  input: CodeThemeInput | undefined,
  ctx: CodeThemeDerivationContext,
): CodeThemeConfig {
  const preset = normalizeCodeSyntaxPresetId(input?.preset);
  const base =
    preset === 'automatic'
      ? deriveCodeThemeTokens(ctx)
      : resolveCodeThemeTokens(preset, mode);

  const overrides = input?.tokens ?? {};
  const tokens: CodeThemeTokens = { ...base };
  for (const key of CODE_THEME_TOKEN_KEYS) {
    const override = overrides[key];
    if (typeof override === 'string' && override.startsWith('#')) {
      tokens[key] = override;
    }
  }

  return { preset, tokens };
}

function blend(a: string, b: string, amount: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return a;
  return toHex({
    r: Math.round(ca.r * (1 - amount) + cb.r * amount),
    g: Math.round(ca.g * (1 - amount) + cb.g * amount),
    b: Math.round(ca.b * (1 - amount) + cb.b * amount),
  });
}

function lighten(hex: string, amount: number): string {
  return blend(hex, '#ffffff', amount);
}

function darken(hex: string, amount: number): string {
  return blend(hex, '#000000', amount);
}

function parseColor(value: string): { r: number; g: number; b: number } | null {
  const hex = value.replace('#', '');
  if (hex.length !== 3 && hex.length !== 6) return null;
  const full = hex.length === 3 ? hex.split('').map((c) => c + c).join('') : hex;
  const num = parseInt(full, 16);
  if (Number.isNaN(num)) return null;
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function toHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}
