import { describe, it, expect } from 'vitest';
import { computeSha256HexSync, computePayloadHash } from './payload-hash';

describe('computeSha256HexSync', () => {
  it('matches the known SHA-256 digest for ASCII "abc"', () => {
    expect(computeSha256HexSync('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    );
  });

  it('produces distinct 64-character hex digests for unicode inputs', () => {
    const asciiA = computeSha256HexSync('A');
    const polish = computeSha256HexSync('Ł');
    const accented = computeSha256HexSync('é');
    const japanese = computeSha256HexSync('日本語');
    const emoji = computeSha256HexSync('🙂');
    const combining = computeSha256HexSync('a\u0301');

    for (const digest of [asciiA, polish, accented, japanese, emoji, combining]) {
      expect(digest).toMatch(/^[a-f0-9]{64}$/);
    }

    expect(asciiA).not.toBe(polish);
    expect(polish).not.toBe(accented);
    expect(accented).not.toBe(japanese);
    expect(japanese).not.toBe(emoji);
    expect(emoji).not.toBe(combining);
  });
});

describe('computePayloadHash', () => {
  it('returns a 64-character hex string for a unicode payload', () => {
    expect(computePayloadHash({ prompt: 'é' })).toMatch(/^[a-f0-9]{64}$/);
  });
});
