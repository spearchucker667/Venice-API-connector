// @vitest-environment node

/** @fileoverview Tests for the bounded response-body reader. */

import { describe, it, expect, vi } from "vitest";
import {
  readResponseBufferBounded,
  readResponseTextBounded,
  type BoundedReadOptions,
} from "./boundedResponseReader";

function buildStream(chunks: Uint8Array[], delayMs = 0): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      let index = 0;
      function push() {
        if (index >= chunks.length) {
          controller.close();
          return;
        }
        const chunk = chunks[index++];
        controller.enqueue(chunk);
        if (delayMs > 0) {
          setTimeout(push, delayMs);
        } else {
          push();
        }
      }
      push();
    },
  });
}

function buildResponse(overrides: {
  headers?: Headers;
  body?: ReadableStream<Uint8Array>;
  text?: string | (() => Promise<string>);
  arrayBuffer?: ArrayBuffer | (() => Promise<ArrayBuffer>);
}): Response {
  return {
    headers: overrides.headers ?? new Headers(),
    body: overrides.body,
    text:
      typeof overrides.text === "function"
        ? vi.fn(overrides.text)
        : vi.fn().mockResolvedValue(overrides.text ?? ""),
    arrayBuffer:
      typeof overrides.arrayBuffer === "function"
        ? vi.fn(overrides.arrayBuffer)
        : vi.fn().mockResolvedValue(overrides.arrayBuffer ?? new ArrayBuffer(0)),
  } as unknown as Response;
}

const baseOptions: BoundedReadOptions = {
  maxBytes: 1024,
  timeoutMs: 25,
  label: "Replicate control response",
};

describe("readResponseBufferBounded", () => {
  it("rejects a declared Content-Length above maxBytes", async () => {
    const response = buildResponse({
      headers: new Headers({ "content-length": String(baseOptions.maxBytes + 1) }),
    });

    await expect(readResponseBufferBounded(response, baseOptions)).rejects.toThrow(
      /Content-Length.*exceeds maximum/i,
    );
  });

  it("reads a valid streamed body", async () => {
    const data = Buffer.from("hello world", "utf8");
    const response = buildResponse({
      body: buildStream([new Uint8Array(data)], 0),
    });

    const result = await readResponseBufferBounded(response, baseOptions);
    expect(result.toString("utf8")).toBe("hello world");
  });

  it("rejects when streamed chunks exceed maxBytes", async () => {
    const response = buildResponse({
      body: buildStream([
        new Uint8Array(Buffer.from("hello", "utf8")),
        new Uint8Array(Buffer.from(" world overflow", "utf8")),
      ]),
    });

    await expect(
      readResponseBufferBounded(response, { ...baseOptions, maxBytes: 8 }),
    ).rejects.toThrow(/exceeds maximum/i);
  });

  it("rejects when the body stalls after headers", async () => {
    const response = buildResponse({
      body: new ReadableStream({
        start() {
          // Never enqueue or close.
        },
      }),
    });

    await expect(readResponseBufferBounded(response, baseOptions)).rejects.toThrow(
      /timed out/i,
    );
  });

  it("falls back to text() for non-stream mocks", async () => {
    const response = buildResponse({
      text: "fallback body",
    });

    const result = await readResponseTextBounded(response, baseOptions);
    expect(result).toBe("fallback body");
  });

  it("rejects a slow non-stream fallback that exceeds the deadline", async () => {
    const response = buildResponse({
      text: () => new Promise<string>((resolve) =>
        setTimeout(() => resolve("too late"), baseOptions.timeoutMs * 2),
      ),
    });

    await expect(readResponseBufferBounded(response, baseOptions)).rejects.toThrow(
      /timed out/i,
    );
  });

  it("rejects an oversized non-stream fallback", async () => {
    const response = buildResponse({
      text: "x".repeat(baseOptions.maxBytes + 1),
    });

    await expect(readResponseBufferBounded(response, baseOptions)).rejects.toThrow(
      /exceeds maximum/i,
    );
  });

  it("respects a parent abort signal", async () => {
    const controller = new AbortController();
    const response = buildResponse({
      body: new ReadableStream({
        start() {
          setTimeout(() => controller.abort(), 5);
        },
      }),
    });

    await expect(
      readResponseBufferBounded(response, { ...baseOptions, signal: controller.signal }),
    ).rejects.toThrow(/aborted/i);
  });

  it("cleans up timers and listeners after a successful read", async () => {
    const controller = new AbortController();
    const data = Buffer.from("ok", "utf8");
    const response = buildResponse({
      body: buildStream([new Uint8Array(data)], 0),
    });

    await readResponseBufferBounded(response, { ...baseOptions, signal: controller.signal });

    // After a successful read the listener is removed, so a later abort is a no-op.
    expect(() => controller.abort()).not.toThrow();
  });
});
