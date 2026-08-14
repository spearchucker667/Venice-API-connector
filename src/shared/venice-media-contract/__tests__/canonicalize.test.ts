import { describe, it, expect } from 'vitest';
import { canonicalizeJson } from '../canonicalize';
import { computePayloadHash } from '../payload-hash';

describe('Canonicalize & Payload Hash', () => {
  it('produces identical JSON regardless of key ordering', () => {
    const objA = {
      model: 'seedance-v1',
      prompt: 'a running horse',
      duration: '5s',
      aspect_ratio: '16:9',
    };

    const objB = {
      aspect_ratio: '16:9',
      duration: '5s',
      prompt: 'a running horse',
      model: 'seedance-v1',
    };

    const canonicalA = canonicalizeJson(objA);
    const canonicalB = canonicalizeJson(objB);

    expect(canonicalA).toBe(canonicalB);
    expect(canonicalA).toBe('{"aspect_ratio":"16:9","duration":"5s","model":"seedance-v1","prompt":"a running horse"}');
  });

  it('produces identical SHA-256 hash for identical logical content with different key order', () => {
    const objA = { b: 2, a: 1, nested: { y: 'hello', x: 'world' } };
    const objB = { a: 1, nested: { x: 'world', y: 'hello' }, b: 2 };

    const hashA = computePayloadHash(objA);
    const hashB = computePayloadHash(objB);

    expect(hashA).toBe(hashB);
    expect(hashA).toMatch(/^[a-f0-9]{64}$/);
  });

  it('produces different hash when material parameters change', () => {
    const req1 = { model: 'seedance-v1', duration: '5s' };
    const req2 = { model: 'seedance-v1', duration: '10s' };

    expect(computePayloadHash(req1)).not.toBe(computePayloadHash(req2));
  });
});
