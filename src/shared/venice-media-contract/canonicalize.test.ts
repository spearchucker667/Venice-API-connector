import { describe, it, expect } from 'vitest';
import { canonicalizeJson, canonicalizeValue } from './canonicalize';

describe('canonicalizeValue', () => {
  it('preserves significant whitespace in strings', () => {
    expect(canonicalizeValue(' cat ')).toBe(' cat ');
  });
});

describe('canonicalizeJson', () => {
  it('distinguishes payloads that differ only by whitespace', () => {
    expect(canonicalizeJson({ prompt: 'cat' })).not.toBe(
      canonicalizeJson({ prompt: ' cat ' }),
    );
  });

  it('sorts keys so different orderings produce identical output', () => {
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe(
      canonicalizeJson({ a: 2, b: 1 }),
    );
    expect(canonicalizeJson({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });

  it('omits undefined values', () => {
    expect(canonicalizeJson({ a: 1, b: undefined, c: 'keep' })).toBe(
      '{"a":1,"c":"keep"}',
    );
  });
});
