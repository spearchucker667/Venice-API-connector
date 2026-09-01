/** @fileoverview Bounded response-body reader.
 *  Protects control-plane and download reads with a size cap and a per-read
 *  deadline while respecting an optional parent abort signal.
 */

export interface BoundedReadOptions {
  maxBytes: number;
  timeoutMs: number;
  label: string;
  signal?: AbortSignal;
}

type StreamReadResult<T> =
  | { done: true; value?: T }
  | { done: false; value: T };

function buildTimeoutError(label: string, timeoutMs: number): Error {
  return new Error(`${label} timed out after ${timeoutMs}ms`);
}

/** Fallback reader for environments without streaming bodies (e.g. some test
 *  mocks).  Races response.text() against the same deadline and size cap as the
 *  streaming path. */
async function readResponseBodyFallback(
  response: Response,
  options: BoundedReadOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(buildTimeoutError(options.label, options.timeoutMs));
    }, options.timeoutMs);

    const abortListener = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener("abort", abortListener);
      }
      reject(new Error(`${options.label} aborted`));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        settled = true;
        clearTimeout(timer);
        reject(new Error(`${options.label} aborted`));
        return;
      }
      options.signal.addEventListener("abort", abortListener);
    }

    response
      .text()
      .then((text) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (options.signal) {
          options.signal.removeEventListener("abort", abortListener);
        }
        const buffer = Buffer.from(text, "utf8");
        if (buffer.length > options.maxBytes) {
          reject(
            new Error(
              `${options.label} exceeds maximum ${options.maxBytes} bytes.`,
            ),
          );
        } else {
          resolve(buffer);
        }
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (options.signal) {
          options.signal.removeEventListener("abort", abortListener);
        }
        reject(err);
      });
  });
}

async function readChunkWithDeadline(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  options: BoundedReadOptions,
): Promise<StreamReadResult<Uint8Array>> {
  return new Promise((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reader.cancel().catch(() => undefined);
      reject(buildTimeoutError(options.label, options.timeoutMs));
    }, options.timeoutMs);

    const abortListener = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (options.signal) {
        options.signal.removeEventListener("abort", abortListener);
      }
      reader.cancel().catch(() => undefined);
      reject(new Error(`${options.label} aborted`));
    };

    if (options.signal) {
      if (options.signal.aborted) {
        settled = true;
        clearTimeout(timer);
        reader.cancel().catch(() => undefined);
        reject(new Error(`${options.label} aborted`));
        return;
      }
      options.signal.addEventListener("abort", abortListener);
    }

    reader
      .read()
      .then((result) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (options.signal) {
          options.signal.removeEventListener("abort", abortListener);
        }
        resolve(result);
      })
      .catch((err) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (options.signal) {
          options.signal.removeEventListener("abort", abortListener);
        }
        reject(err);
      });
  });
}

/** Reads the body of a Fetch {@link Response} into a Buffer with hard limits.
 *  - Rejects before reading if the declared Content-Length exceeds maxBytes.
 *  - Races each streamed chunk against the deadline and parent abort signal.
 *  - Cancels the reader and clears timers/listeners in all exit paths.
 *  - Falls back to response.text() for non-stream test mocks. */
export async function readResponseBufferBounded(
  response: Response,
  options: BoundedReadOptions,
): Promise<Buffer> {
  const contentLengthHeader = response.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (Number.isFinite(contentLength) && contentLength > options.maxBytes) {
      throw new Error(
        `${options.label} Content-Length ${contentLength} exceeds maximum ${options.maxBytes} bytes.`,
      );
    }
  }

  if (options.signal?.aborted) {
    throw new Error(`${options.label} aborted`);
  }

  if (response.body) {
    const reader = response.body.getReader();
    const chunks: Buffer[] = [];
    let total = 0;

    try {
      while (true) {
        const { done, value } = await readChunkWithDeadline(reader, options);
        if (done) break;
        const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value);
        total += chunk.length;
        if (total > options.maxBytes) {
          throw new Error(
            `${options.label} exceeds maximum ${options.maxBytes} bytes.`,
          );
        }
        chunks.push(chunk);
      }
      return Buffer.concat(chunks);
    } finally {
      reader.cancel().catch(() => undefined);
    }
  }

  // Fallback for environments without streaming bodies (e.g. some test mocks).
  return readResponseBodyFallback(response, options);
}

/** Convenience wrapper that returns the bounded body as a UTF-8 string. */
export async function readResponseTextBounded(
  response: Response,
  options: BoundedReadOptions,
): Promise<string> {
  return (await readResponseBufferBounded(response, options)).toString("utf8");
}
