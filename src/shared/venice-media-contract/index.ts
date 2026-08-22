/**
 * @fileoverview Canonical Venice Media Contract Layer.
 * Single source of truth for operations, types, payload builders, hashing,
 * response normalization, capabilities, and errors across Venice Forge.
 */

export * from './operations';
export * from './types';
export * from './canonicalize';
export * from './payload-builders';
export * from './response-normalizers';
export * from './capabilities';
export * from './errors';

// Note: payload-hash is intentionally excluded from the barrel. It uses Node's
// crypto module and is only consumed by the Electron main process. Re-exporting
// it here pulls Node-only code into the renderer bundle and causes Vite to
// externalize 'crypto' for browser compatibility. Main-process callers should
// import directly from './payload-hash'.
