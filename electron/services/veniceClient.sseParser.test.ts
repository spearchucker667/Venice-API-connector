// @vitest-environment node
/** @fileoverview Tests for the SSE handling used by `performVeniceRequest` in
 *  the Electron main process. Framing/UTF-8 conformance lives in
 *  `src/shared/sseStreamDecoder.test.ts` (shared with the Web transport);
 *  this file covers the Electron-main delta contract surface plus the
 *  behaviors inherited from the shared decoder through this process.
 *
 *  Coverage:
 *    - `extractStreamDelta`: content/reasoning deltas, [DONE], error frames,
 *      malformed JSON, legacy choices[0].text
 *    - Blank-line event boundaries (a single newline is NOT an event end)
 *    - Multi-line `data:` joining
 *    - UTF-8 code points split across chunk boundaries (never corrupted)
 *    - EOF flush of a trailing unterminated event
 *    - Provider error frames surfaced as malformed outcomes
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(),
    getVersion: vi.fn(),
  },
}));

import { extractStreamDelta } from "./veniceClient";
import {
  SseDecoder,
  applyStreamSseEvent,
  type SseEventOutcome,
} from "../../src/shared/sseStreamDecoder";

const DELTA = (content: string) =>
  JSON.stringify({ choices: [{ delta: { content } }] });

describe("extractStreamDelta (electron surface)", () => {
  it("parses a normal Venice content delta", () => {
    const delta = extractStreamDelta(DELTA("hello"));
    expect(delta.parsed).toBe(true);
    expect(delta.malformed).toBe(false);
    expect(delta.content).toBe("hello");
    expect(delta.reasoning).toBe("");
  });

  it("parses reasoning_content when present", () => {
    const delta = extractStreamDelta(
      JSON.stringify({ choices: [{ delta: { content: "ans", reasoning_content: "think" } }] }),
    );
    expect(delta.parsed).toBe(true);
    expect(delta.content).toBe("ans");
    expect(delta.reasoning).toBe("think");
  });

  it("returns malformed=true on JSON parse error and retains rawData for diagnostics", () => {
    const delta = extractStreamDelta("not-json");
    expect(delta.parsed).toBe(false);
    expect(delta.malformed).toBe(true);
    expect(delta.rawData).toBe("not-json");
  });

  it("treats [DONE] as a benign non-delta terminator", () => {
    const delta = extractStreamDelta("[DONE]");
    expect(delta.parsed).toBe(true);
    expect(delta.malformed).toBe(false);
    expect(delta.content).toBe("");
  });

  it("treats empty data as benign", () => {
    const delta = extractStreamDelta("");
    expect(delta.parsed).toBe(false);
    expect(delta.malformed).toBe(false);
  });

  it("reads legacy choices[0].text fallback", () => {
    const delta = extractStreamDelta(JSON.stringify({ choices: [{ text: "legacy" }] }));
    expect(delta.content).toBe("legacy");
    expect(delta.malformed).toBe(false);
  });
});

describe("shared SseDecoder consumed by the Electron read loop", () => {
  /** Models the main-process read loop: push every chunk, drain dispatched
   *  events via applyStreamSseEvent, and flush at res.end. */
  function runStream(chunks: Uint8Array[]) {
    const decoder = new SseDecoder();
    const deltas: string[] = [];
    const malformed: SseEventOutcome[] = [];
    for (const chunk of chunks) {
      for (const ev of decoder.push(chunk)) {
        const outcome = applyStreamSseEvent(ev, { onDelta: (c) => deltas.push(c.content + c.reasoning) });
        if (outcome.malformed) malformed.push(outcome);
      }
    }
    for (const ev of decoder.flush()) {
      const outcome = applyStreamSseEvent(ev, { onDelta: (c) => deltas.push(c.content + c.reasoning) });
      if (outcome.malformed) malformed.push(outcome);
    }
    return { deltas, malformed };
  }

  it("dispatches on blank lines, not on a single newline after data:", () => {
    const { deltas, malformed } = runStream([
      Buffer.from(`data: ${DELTA("a")}\n`), // single newline: NOT an event end
      Buffer.from(`\n`), // the blank line completes event "a"
      Buffer.from(`data: ${DELTA("b")}\n\n`), // fresh event completes on blank line
    ]);
    expect(deltas).toEqual(["a", "b"]);
    expect(malformed).toHaveLength(0);
  });

  it("joins multiline data payloads with newlines (SSE spec)", () => {
    const { deltas } = runStream([
      Buffer.from('data: {"choices":[{"delta":\ndata: {"content":"joined"}}]}\n\n'),
    ]);
    expect(deltas).toEqual(["joined"]);
  });

  it("preserves UTF-8 code points split across Buffer boundaries", () => {
    const payload = DELTA("caf\u00e9 \ud83c\udf0d \ud83d\udd0b");
    const bytes = Buffer.from(`data: ${payload}\n\n`, "utf-8");
    // Split after the first byte of the é (0xC3|0xA9) and mid-emoji.
    const splitAt = Buffer.from(`data: caf`, "utf-8").length;
    const { deltas } = runStream([bytes.subarray(0, splitAt), bytes.subarray(splitAt)]);
    expect(deltas).toEqual(["caf\u00e9 \ud83c\udf0d \ud83d\udd0b"]);
  });

  it("flushes the trailing unterminated event at res.end", () => {
    const { deltas } = runStream([Buffer.from(`data: ${DELTA("tail")}`, "utf-8")]);
    expect(deltas).toEqual(["tail"]);
  });

  it("surfaces provider error frames as malformed outcomes", () => {
    const { deltas, malformed } = runStream([
      Buffer.from(`data: ${DELTA("ok")}\n\n`),
      Buffer.from('data: {"error":"rate_limited"}\n\n'),
      Buffer.from(`data: ${DELTA("after")}\n\n`),
    ]);
    expect(deltas).toEqual(["ok", "after"]);
    expect(malformed).toHaveLength(1);
    expect(malformed[0].errorMessage).toBe("rate_limited");
  });

  it("counts malformed non-JSON frames without killing the stream", () => {
    const { deltas, malformed } = runStream([
      Buffer.from("data: not-json\n\n"),
      Buffer.from(`data: ${DELTA("ok")}\n\n`),
    ]);
    expect(deltas).toEqual(["ok"]);
    expect(malformed).toHaveLength(1);
  });

  it("handles \\r\\n line endings", () => {
    const { deltas } = runStream([
      Buffer.from(`data: ${DELTA("crlf")}\r\n\r\n`),
    ]);
    expect(deltas).toEqual(["crlf"]);
  });

  it("accepts provider-specific extractors (fallback adapters)", () => {
    const decoder = new SseDecoder();
    const deltas: string[] = [];
    for (const ev of decoder.push(Buffer.from(`data: {"type":"content_delta"}\n\n`))) {
      applyStreamSseEvent(ev, {
        extractFn: (_data) => ({ content: "adapter", reasoning: "", parsed: true, malformed: false }),
        onDelta: (c) => deltas.push(c.content),
      });
    }
    expect(deltas).toEqual(["adapter"]);
  });
});