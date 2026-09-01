import { stringify } from 'yaml';
import type { ThemeFamily, ThemeTokens } from '../themeTypes';

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function serializeTokens(tokens: ThemeTokens): Record<string, string> {
  const out: Record<string, string> = {};
  const keys = Object.keys(tokens).sort();
  const tokenMap = tokens as unknown as Record<string, string>;
  for (const key of keys) {
    const snake = camelToSnake(key);
    out[snake] = tokenMap[key];
  }
  return out;
}

/**
 * Serialize a ThemeFamily to the V2 YAML schema.
 *
 * Output is deterministic (alphabetical token order) so round-trips are
 * semantically stable. Colors are written as snake_case CSS variables.
 */
export function serializeThemeFamilyYaml(family: ThemeFamily): string {
  const doc = {
    schemaVersion: 2,
    id: family.id,
    name: family.name,
    variants: {
      light: {
        tokens: serializeTokens(family.variants.light.tokens),
      },
      dark: {
        tokens: serializeTokens(family.variants.dark.tokens),
      },
    },
  };
  return stringify(doc);
}

/** Convenience alias matching the pipeline naming convention. */
export const themeFamilyToYaml = serializeThemeFamilyYaml;
