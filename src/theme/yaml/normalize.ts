import { completeThemeTokens, type ThemeFamily, type ThemeMode, type ThemeTokens, type ThemeTokenInput } from '../themeTypes';

function normalizeTokenKey(key: string): string {
  return key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function normalizeTokens(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string') {
      out[normalizeTokenKey(key)] = value;
    }
  }
  return out;
}

/**
 * Convert a validated V2 YAML object into a canonical ThemeFamily.
 *
 * - Applies `completeThemeTokens(mode, ...)` to each variant so the full
 *   semantic token contract is always present.
 * - Applies optional `base.tokens` first; variant tokens override the base.
 * - Drops unknown fields and coerces the result to the V2 family schema.
 */
export function normalizeThemeFamilyYaml(raw: unknown): ThemeFamily {
  const doc = raw as Record<string, unknown>;
  const baseTokens = normalizeTokens(
    (doc.base && typeof doc.base === 'object' && !Array.isArray(doc.base)
      ? (doc.base as Record<string, unknown>).tokens
      : {}) as unknown,
  );

  const variants = doc.variants as Record<string, Record<string, unknown>>;

  function buildVariant(mode: ThemeMode): { tokens: ThemeTokens } {
    const rawTokens = normalizeTokens(variants[mode]?.tokens);
    const merged = { ...baseTokens, ...rawTokens } as unknown as ThemeTokenInput;
    return { tokens: completeThemeTokens(mode, merged) };
  }

  const aliases = Array.isArray(doc.aliases)
    ? doc.aliases.filter((a): a is string => typeof a === 'string')
    : [];

  return {
    schemaVersion: 2,
    id: String(doc.id),
    name: String(doc.name),
    aliases,
    description: typeof doc.description === 'string' ? doc.description : undefined,
    author: typeof doc.author === 'string' ? doc.author : undefined,
    builtIn: false,
    variants: {
      light: buildVariant('light'),
      dark: buildVariant('dark'),
    },
  };
}
