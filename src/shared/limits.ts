/** @fileoverview Shared byte/size limits used across renderer, proxy, and Electron IPC. */

/** Base mebibyte unit in bytes. */
export const MIB = 1024 * 1024;

/** Unified raw Venice request-body limit (matches proxy + IPC + import/export caps). */
export const VENICE_MAX_BODY_BYTES = 25 * MIB;

/** Maximum Jina response body buffered before parsing or safety screening. */
export const JINA_MAX_RESPONSE_BYTES = 2 * MIB;

/** Maximum raw upload file size accepted in the renderer. */
export const VENICE_MAX_RAW_UPLOAD_BYTES = VENICE_MAX_BODY_BYTES;

/** Maximum serialized (base64-expanded) upload payload allowed over IPC. */
export const VENICE_MAX_SERIALIZED_UPLOAD_BYTES = Math.floor((VENICE_MAX_RAW_UPLOAD_BYTES * 4) / 3);

/**
 * Maximum Venice response body accumulated by the web proxy under Family Safe Mode.
 * Enforced both via Content-Length pre-check (declared size) and via streaming byte
 * counter (chunked transfer encoding) before any screening logic runs.
 */
export const VENICE_PROXY_MAX_FSM_RESPONSE_BYTES = 256 * MIB;

