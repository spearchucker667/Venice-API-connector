import { describe, it, expect } from 'vitest';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const tm = require('./translate-missing.cjs') as {
  ALLOWLISTED_IDENTICAL: Set<string>;
  MISSING_MARKER_RE: RegExp;
  SENTINEL_RE: RegExp;
  flattenTree: (
    tree: Record<string, unknown>,
    prefix?: string,
    out?: Record<string, { value: unknown; isString: boolean }>,
  ) => Record<string, { value: unknown; isString: boolean }>;
  isCandidate: (marker: unknown, enUSValue: unknown) => boolean;
};

const { ALLOWLISTED_IDENTICAL, MISSING_MARKER_RE, SENTINEL_RE, flattenTree, isCandidate } = tm;

describe('translate-missing detection', () => {
  it('flattens a nested tree', () => {
    const tree = { a: { b: 'B', c: { d: 'D' } } };
    const out = flattenTree(tree);
    expect(out['a.b']).toEqual({ value: 'B', isString: true });
    expect(out['a.c.d']).toEqual({ value: 'D', isString: true });
  });

  it('flattens arrays as non-string leaves (caller inspects opaquely)', () => {
    const out = flattenTree({ items: ['one', 'two'] });
    expect(out['items']).toEqual({ value: ['one', 'two'], isString: false });
  });

  it('isCandidate flags null/empty/missing-marker/sentinel values', () => {
    expect(isCandidate({ isString: true, value: null }, 'X')).toBe(true);
    expect(isCandidate({ isString: true, value: undefined }, 'X')).toBe(true);
    expect(isCandidate({ isString: true, value: '' }, 'X')).toBe(true);
    expect(isCandidate({ isString: true, value: '__MISSING__:foo' }, 'X')).toBe(true);
    expect(isCandidate({ isString: true, value: '[RU] foo' }, 'X')).toBe(true);
  });

  it('isCandidate preserves real translations', () => {
    expect(isCandidate({ isString: true, value: 'Guardar' }, 'Save')).toBe(false);
    expect(isCandidate({ isString: true, value: 'Сохранить' }, 'Save')).toBe(false);
  });

  it('isCandidate flags identical-to-en leaves for re-translation', () => {
    expect(isCandidate({ isString: true, value: 'Open file' }, 'Open file')).toBe(true);
    expect(isCandidate({ isString: true, value: 'Save Key (i18n)' }, 'Save Key (i18n)')).toBe(true);
    expect(isCandidate({ isString: true, value: 'saveKey' }, 'saveKey')).toBe(true);
  });

  it('isCandidate preserves allowlisted identical tokens', () => {
    expect(isCandidate({ isString: true, value: 'Venice Forge' }, 'Venice Forge')).toBe(false);
    expect(isCandidate({ isString: true, value: 'PNG' }, 'PNG')).toBe(false);
  });

  it('isCandidate preserves short non-allowlist identical tokens (OK, MFA etc.)', () => {
    expect(isCandidate({ isString: true, value: 'OK' }, 'OK')).toBe(false);
    expect(isCandidate({ isString: true, value: 'On' }, 'On')).toBe(false);
  });

  it('regex constants are exported and stable', () => {
    expect(MISSING_MARKER_RE.test('__MISSING__:foo')).toBe(true);
    expect(MISSING_MARKER_RE.test('Save')).toBe(false);
    expect(SENTINEL_RE.test('[RU] foo')).toBe(true);
    expect(SENTINEL_RE.test('Save')).toBe(false);
  });

  it('allowlist contains Venice Forge and infrastructure tokens', () => {
    expect(ALLOWLISTED_IDENTICAL.has('Venice Forge')).toBe(true);
    expect(ALLOWLISTED_IDENTICAL.has('JSON')).toBe(true);
    expect(ALLOWLISTED_IDENTICAL.has('Argon2id')).toBe(true);
  });
});
