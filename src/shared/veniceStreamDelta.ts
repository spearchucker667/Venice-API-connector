/** @fileoverview Shared, serializable Venice chat-stream delta envelope.
 *
 *  One canonical delta shape flows from the Electron main process (agent
 *  runner) through the IPC handler, preload bridge, desktop bridge, and the
 *  chat stream manager. Keep this module free of renderer-only imports so it
 *  can be consumed by `electron/` code, the preload, and the renderer alike.
 *
 *  `appendedMessages` carries assistant-appended tool-result messages with
 *  generated-media/document metadata; dropping it anywhere in the chain loses
 *  conversation records (P1-006). Never add transport-specific fields here —
 *  extend the envelope with an explicit property instead.
 */

/** Token usage reported by the provider for a streamed completion. */
export interface VeniceStreamUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** A partial tool call as it accumulates across SSE deltas. */
export interface VeniceStreamToolCall {
  index: number;
  id?: string;
  type?: "function";
  function?: {
    name?: string;
    arguments?: string;
  };
}

/** An assistant-appended message (e.g. a tool result) forwarded with the
 *  stream so the renderer can persist it with the conversation. The agent
 *  loop emits `role: "tool"` messages whose `metadata` may carry canonical
 *  generated-media (`generatedMedia`) and managed-document
 *  (`managedDocuments`) references. */
export interface VeniceStreamAppendedMessage {
  role: string;
  content?: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: string;
    function: { name: string; arguments: string };
  }>;
  metadata?: Record<string, unknown>;
}

/** A single logical streamed delta (one decode event). */
export interface VeniceStreamDelta {
  content?: string;
  reasoning?: string;
  providerRequestId?: string;
  usage?: VeniceStreamUsage;
  tool_calls?: VeniceStreamToolCall[];
  finish_reason?: string | null;
  appendedMessages?: VeniceStreamAppendedMessage[];
}

/** The IPC envelope: the main → preload → renderer wire shape. `delta`
 *  carries the accumulated delta content and `signalId` correlates the
 *  stream. */
export interface VeniceStreamDeltaEnvelope {
  signalId: string;
  delta: string;
  reasoning?: string;
  providerRequestId?: string;
  usage?: VeniceStreamUsage;
  tool_calls?: VeniceStreamToolCall[];
  finish_reason?: string | null;
  appendedMessages?: VeniceStreamAppendedMessage[];
}

/** Largest accepted delta payload (protects the preload from a hostile or
 *  misbehaving main process). */
const MAX_DELTA_LENGTH = 1024 * 1024;
const MAX_REASONING_LENGTH = 1024 * 1024;
const MAX_APPENDED_MESSAGES = 64;
const MAX_APPENDED_MESSAGE_TEXT = 512 * 1024;
const MAX_TOOL_CALL_FRAGMENTS = 128;
const MAX_SIGNAL_ID_LENGTH = 128;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

/** Validates main-process-supplied stream envelopes at the preload boundary.
 *  Returns the envelope when structurally valid, or null when malformed
 *  (the delta is then dropped rather than forwarded). This is a safety
 *  validation, not a promise of Venice API correctness. */
export function sanitizeStreamDeltaEnvelope(
  value: unknown,
): VeniceStreamDeltaEnvelope | null {
  if (!isRecord(value)) return null;
  if (typeof value.signalId !== "string" || value.signalId.length === 0 || value.signalId.length > MAX_SIGNAL_ID_LENGTH) {
    return null;
  }
  if (typeof value.delta !== "string" || value.delta.length > MAX_DELTA_LENGTH) {
    return null;
  }
  const envelope: VeniceStreamDeltaEnvelope = { signalId: value.signalId, delta: value.delta };

  if (typeof value.reasoning === "string" && value.reasoning.length <= MAX_REASONING_LENGTH) {
    envelope.reasoning = value.reasoning;
  }
  if (typeof value.providerRequestId === "string" && value.providerRequestId.length <= 512) {
    envelope.providerRequestId = value.providerRequestId;
  }
  if (isRecord(value.usage)) {
    const { prompt_tokens, completion_tokens, total_tokens } = value.usage;
    if (
      isFiniteNumber(prompt_tokens) &&
      isFiniteNumber(completion_tokens) &&
      isFiniteNumber(total_tokens) &&
      prompt_tokens >= 0 && completion_tokens >= 0 && total_tokens >= 0
    ) {
      envelope.usage = { prompt_tokens, completion_tokens, total_tokens };
    }
  }
  if (value.finish_reason === null || typeof value.finish_reason === "string") {
    envelope.finish_reason = value.finish_reason;
  }
  if (Array.isArray(value.tool_calls) && value.tool_calls.length <= MAX_TOOL_CALL_FRAGMENTS) {
    const toolCalls: VeniceStreamToolCall[] = [];
    for (const raw of value.tool_calls) {
      if (!isRecord(raw) || !isFiniteNumber(raw.index)) continue;
      const call: VeniceStreamToolCall = { index: raw.index };
      if (typeof raw.id === "string" && raw.id.length <= 256) call.id = raw.id;
      if (raw.type === "function") call.type = "function";
      if (isRecord(raw.function)) {
        const fn: VeniceStreamToolCall["function"] = {};
        if (typeof raw.function.name === "string" && raw.function.name.length <= 512) fn.name = raw.function.name;
        if (typeof raw.function.arguments === "string" && raw.function.arguments.length <= MAX_DELTA_LENGTH) fn.arguments = raw.function.arguments;
        call.function = fn;
      }
      toolCalls.push(call);
    }
    if (toolCalls.length > 0) envelope.tool_calls = toolCalls;
  }
  if (Array.isArray(value.appendedMessages) && value.appendedMessages.length <= MAX_APPENDED_MESSAGES) {
    const messages: VeniceStreamAppendedMessage[] = [];
    for (const raw of value.appendedMessages) {
      if (!isRecord(raw) || typeof raw.role !== "string" || raw.role.length === 0) continue;
      const message: VeniceStreamAppendedMessage = { role: raw.role };
      if (typeof raw.content === "string" && raw.content.length <= MAX_APPENDED_MESSAGE_TEXT) {
        message.content = raw.content;
      }
      if (typeof raw.tool_call_id === "string" && raw.tool_call_id.length <= 256) message.tool_call_id = raw.tool_call_id;
      if (typeof raw.name === "string" && raw.name.length <= 512) message.name = raw.name;
      if (Array.isArray(raw.tool_calls) && raw.tool_calls.length <= 16) {
        const nested: VeniceStreamAppendedMessage["tool_calls"] = [];
        for (const tc of raw.tool_calls) {
          if (
            isRecord(tc) &&
            typeof tc.id === "string" &&
            typeof tc.type === "string" &&
            isRecord(tc.function) &&
            typeof tc.function.name === "string" &&
            typeof tc.function.arguments === "string"
          ) {
            nested.push({
              id: tc.id,
              type: tc.type,
              function: { name: tc.function.name, arguments: tc.function.arguments },
            });
          }
        }
        if (nested.length > 0) message.tool_calls = nested;
      }
      if (isRecord(raw.metadata)) {
        message.metadata = raw.metadata;
      }
      messages.push(message);
    }
    if (messages.length > 0) envelope.appendedMessages = messages;
  }
  return envelope;
}

/** Rebuilds the logical renderer delta from a validated IPC envelope,
 *  forwarding every property explicitly so no field can be dropped by a
 *  reconstruction. */
export function toRendererStreamDelta(
  envelope: VeniceStreamDeltaEnvelope,
): VeniceStreamDelta {
  const delta: VeniceStreamDelta = {
    content: envelope.delta,
    reasoning: envelope.reasoning ?? "",
    providerRequestId: envelope.providerRequestId,
    usage: envelope.usage,
    tool_calls: envelope.tool_calls,
    finish_reason: envelope.finish_reason,
    appendedMessages: envelope.appendedMessages,
  };
  return delta;
}