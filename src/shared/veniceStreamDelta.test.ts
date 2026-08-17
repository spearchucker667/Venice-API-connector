/** @fileoverview Conformance tests for the shared stream-delta envelope
 *  (P1-006). These lock the main → preload → renderer wire contract:
 *  appended tool-result messages with generated-media/document metadata
 *  survive validation and explicit forwarding, and malformed envelopes are
 *  dropped at the boundary. */

import { describe, expect, it } from "vitest";
import {
  sanitizeStreamDeltaEnvelope,
  toRendererStreamDelta,
  type VeniceStreamDeltaEnvelope,
} from "./veniceStreamDelta";

const toolResultWithMediaMetadata = {
  role: "tool",
  tool_call_id: "call_1",
  name: "generate_image",
  content: "{\"ok\":true}",
  metadata: {
    generatedMedia: [
      {
        id: "media-1",
        mediaId: "media-1",
        mediaType: "image",
        operation: "generate",
        mimeType: "image/png",
      },
    ],
    managedDocuments: [
      { id: "doc-1", name: "proposal.md", mimeType: "text/markdown" },
    ],
  },
};

function validEnvelope(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    signalId: "sig-1",
    delta: "Hello",
    reasoning: "thinking",
    providerRequestId: "req-1",
    usage: { prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 },
    tool_calls: [
      { index: 0, id: "call_1", type: "function", function: { name: "f", arguments: "{}" } },
    ],
    finish_reason: "tool_calls",
    appendedMessages: [toolResultWithMediaMetadata],
    ...overrides,
  };
}

describe("sanitizeStreamDeltaEnvelope", () => {
  it("accepts a well-formed envelope and preserves every property", () => {
    const result = sanitizeStreamDeltaEnvelope(validEnvelope());
    expect(result).not.toBeNull();
    expect(result!.signalId).toBe("sig-1");
    expect(result!.delta).toBe("Hello");
    expect(result!.reasoning).toBe("thinking");
    expect(result!.providerRequestId).toBe("req-1");
    expect(result!.usage).toEqual({ prompt_tokens: 1, completion_tokens: 2, total_tokens: 3 });
    expect(result!.tool_calls).toEqual([
      { index: 0, id: "call_1", type: "function", function: { name: "f", arguments: "{}" } },
    ]);
    expect(result!.finish_reason).toBe("tool_calls");
    expect(result!.appendedMessages).toEqual([toolResultWithMediaMetadata]);
  });

  it("preserves appended tool-result messages with media and document metadata", () => {
    const result = sanitizeStreamDeltaEnvelope(validEnvelope());
    const message = result!.appendedMessages![0]!;
    expect(message.role).toBe("tool");
    expect(message.tool_call_id).toBe("call_1");
    expect(message.name).toBe("generate_image");
    expect(message.metadata!.generatedMedia).toHaveLength(1);
    expect(message.metadata!.managedDocuments).toHaveLength(1);
  });

  it("accepts a plain text delta with no appended messages (no-tool regression)", () => {
    const result = sanitizeStreamDeltaEnvelope({
      signalId: "sig-2",
      delta: "streaming text",
    });
    expect(result).not.toBeNull();
    expect(result!.appendedMessages).toBeUndefined();
    expect(result!.tool_calls).toBeUndefined();
  });

  it("rejects non-object envelopes", () => {
    expect(sanitizeStreamDeltaEnvelope(null)).toBeNull();
    expect(sanitizeStreamDeltaEnvelope("delta")).toBeNull();
    expect(sanitizeStreamDeltaEnvelope(42)).toBeNull();
  });

  it("rejects envelopes without a signalId or delta string", () => {
    expect(sanitizeStreamDeltaEnvelope({ delta: "x" })).toBeNull();
    expect(sanitizeStreamDeltaEnvelope({ signalId: "s" })).toBeNull();
    expect(sanitizeStreamDeltaEnvelope({ signalId: "s", delta: 7 })).toBeNull();
  });

  it("drops over-long appended message batches but keeps the text stream", () => {
    const envelope = validEnvelope();
    envelope.appendedMessages = Array.from({ length: 65 }, () => toolResultWithMediaMetadata);
    const result = sanitizeStreamDeltaEnvelope(envelope);
    expect(result).not.toBeNull();
    expect(result!.delta).toBe("Hello");
    expect(result!.appendedMessages).toBeUndefined();
  });

  it("skips malformed appended messages and forwards the valid ones", () => {
    const envelope = validEnvelope({
      appendedMessages: [
        toolResultWithMediaMetadata,
        { role: 7 },
        { role: "tool", content: null },
      ],
    });
    const result = sanitizeStreamDeltaEnvelope(envelope);
    expect(result).not.toBeNull();
    expect(result!.appendedMessages).toHaveLength(2);
  });

  it("drops non-numeric or negative usage without destroying the delta", () => {
    const bad = sanitizeStreamDeltaEnvelope(validEnvelope({ usage: { prompt_tokens: "a", completion_tokens: 1, total_tokens: 1 } }));
    expect(bad).not.toBeNull();
    expect(bad!.usage).toBeUndefined();
    expect(bad!.delta).toBe("Hello");
    const negative = sanitizeStreamDeltaEnvelope(validEnvelope({ usage: { prompt_tokens: -1, completion_tokens: 1, total_tokens: 1 } }));
    expect(negative).not.toBeNull();
    expect(negative!.usage).toBeUndefined();
  });
});

describe("toRendererStreamDelta", () => {
  it("forwards every envelope property explicitly, including appendedMessages", () => {
    const envelope = sanitizeStreamDeltaEnvelope(validEnvelope()) as VeniceStreamDeltaEnvelope;
    const delta = toRendererStreamDelta(envelope);
    expect(delta.content).toBe("Hello");
    expect(delta.reasoning).toBe("thinking");
    expect(delta.providerRequestId).toBe("req-1");
    expect(delta.usage).toEqual(envelope.usage);
    expect(delta.tool_calls).toEqual(envelope.tool_calls);
    expect(delta.finish_reason).toBe("tool_calls");
    expect(delta.appendedMessages).toEqual(envelope.appendedMessages);
  });

  it("normalizes missing reasoning to an empty string like the preload did", () => {
    const delta = toRendererStreamDelta({ signalId: "s", delta: "hi" });
    expect(delta.reasoning).toBe("");
    expect(delta.appendedMessages).toBeUndefined();
  });
});
