/**
 * @fileoverview Stable SHA-256 payload hashing for request binding and quote approvals.
 *
 * Uses Node.js `crypto.createHash('sha256')` which correctly encodes the input as UTF-8
 * before hashing. The previous pure-JS implementation truncated UTF-16 code units to
 * their low byte, causing collisions on non-ASCII characters (e.g. "A" U+0041 and
 * "Ł" U+0141 both map to low byte 0x41 and would produce identical hashes).
 */

import { canonicalizeJson } from './canonicalize';

/** Returns the SHA-256 hex digest of the UTF-8 encoding of `input`. */
export function computeSha256HexSync(input: string): string {
  // Node.js crypto is available in both Electron main process and server.ts.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const crypto = require('crypto') as typeof import('crypto');
  return crypto.createHash('sha256').update(input, 'utf8').digest('hex');
}

export function computePayloadHash(payload: unknown): string {
  const canonicalString = canonicalizeJson(payload);
  return computeSha256HexSync(canonicalString);
}
