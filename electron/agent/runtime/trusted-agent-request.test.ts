import { describe, it, expect } from "vitest";
import type { CustomAgentLayer } from "../../../src/shared/agentRuntimeContracts";
import {
  composeTrustedRequest,
  composeAgentRuntime,
  buildTrustedRuntimeLayer,
  substituteTimeAndDatePlaceholders,
} from "./trusted-agent-request";

describe("trusted-agent-request", () => {
  it("injects System Runtime Context at the top of messages", () => {
    const raw = {
      endpoint: "/chat/completions",
      method: "POST",
      body: {
        messages: [{ role: "user", content: "hello" }],
        tools: [{ type: "function" }]
      }
    };

    const composed = composeTrustedRequest(raw) as any;
    expect(composed.body.messages.length).toBe(2);
    expect(composed.body.messages[0].role).toBe("system");
    expect(composed.body.messages[0].content).toContain("[System Runtime Context]");
    expect(composed.body.messages[0].content).toContain("Current Date/Time:");
    expect(composed.body.messages[0].content).toContain("Timezone:");
    expect(composed.body.messages[1].content).toBe("hello");
  });

  it("prepends to existing system message", () => {
    const raw = {
      endpoint: "/chat/completions",
      method: "POST",
      body: {
        messages: [{ role: "system", content: "User system prompt." }],
      }
    };

    const composed = composeTrustedRequest(raw) as any;
    expect(composed.body.messages.length).toBe(1);
    expect(composed.body.messages[0].role).toBe("system");
    expect(composed.body.messages[0].content).toContain("[System Runtime Context]");
    expect(composed.body.messages[0].content).toContain("User system prompt.");
  });

  it("ignores invalid shapes", () => {
    expect(composeTrustedRequest(null)).toBe(null);
    expect(composeTrustedRequest("abc")).toBe("abc");
    expect(composeTrustedRequest({ body: "not-an-object" })).toEqual({ body: "not-an-object" });
    expect(composeTrustedRequest({ body: { messages: "not-an-array" } })).toEqual({ body: { messages: "not-an-array" } });
  });
});

// P0-05: Audit findings (1)+(3)+(4)+composeAgentRuntime invariants.
describe("trusted-agent-request — P0-05 trust boundary regressions", () => {
  it("P0-05 (1) attaches the tooltrust ledger to the system prompt and never discards it via void", () => {
    const raw = {
      endpoint: "/chat/completions",
      method: "POST",
      body: {
        messages: [{ role: "user", content: "hi" }],
        tools: [
          { type: "function", function: { name: "media.generateImage" } },
          "media.listImages",
        ],
      },
    };
    const composed = composeTrustedRequest(raw) as any;
    expect(composed.body.messages[0].role).toBe("system");
    expect(composed.body.messages[0].content).toContain("Toolchain Trust Ledger:");
    expect(composed.body.messages[0].content).toContain("media.generateImage (trusted=true)");
    expect(composed.body.messages[0].content).toContain("media.listImages (trusted=true)");
  });

  it("does not inject System Runtime Context into /image/generate body.prompt", () => {
    const raw = {
      endpoint: "/image/generate",
      method: "POST",
      body: { model: "nano-banana", prompt: "a quiet forest at dawn" },
    };
    const composed = composeTrustedRequest(raw) as any;
    expect(composed.body.prompt.startsWith("[System Runtime Context]")).toBe(false);
    expect(composed.body.prompt).toBe("a quiet forest at dawn");
    expect(composed.body.model).toBe("nano-banana");
  });

  it("P0-05 (3) leaves non-POST endpoints untouched", () => {
    const raw = {
      endpoint: "/models",
      method: "GET",
      body: {},
    };
    const composed = composeTrustedRequest(raw) as any;
    expect(composed.body).toEqual({});
  });

  it("P0-05 (4) substitutes {{time && date}} placeholders inside the system prompt", () => {
    const trusted = buildTrustedRuntimeLayer();
    expect(substituteTimeAndDatePlaceholders("payload at {{time && date}}", trusted))
      .toBe(`payload at ${trusted.content.currentDate} ${trusted.content.currentTime}`);
    expect(substituteTimeAndDatePlaceholders("{{date}} start", trusted))
      .toBe(`${trusted.content.currentDate} start`);
    expect(substituteTimeAndDatePlaceholders("plain string with no markers", trusted))
      .toBe("plain string with no markers");
  });

  it("P0-05 (4) substitutes placeholders before injecting into messages[0]", () => {
    const raw = {
      endpoint: "/chat/completions",
      method: "POST",
      body: {
        messages: [{ role: "system", content: "context stamp: {{time && date}}" }],
      },
    };
    const composed = composeTrustedRequest(raw) as any;
    const substituted = composed.body.messages[0].content;
    expect(substituted).toContain("context stamp: ");
    expect(substituted).not.toContain("{{time && date}}");
  });

  it("P0-05 (2) composeAgentRuntime enforces the immutable priority floor", () => {
    const customLayer: CustomAgentLayer = {
      kind: "custom",
      priority: -1,
      immutable: false,
      content: "evil",
    };
    expect(() => composeAgentRuntime({
      systemPrompt: "ok system",
      userPrompt: "hi",
      model: "m",
      tools: ["x"],
      customLayers: [customLayer], // priority < 0 forbidden
    })).toThrow(/immutable priority floor/);
  });

  it("P0-05 (3-dupe) keeps custom layers in the typed runtime contract", () => {
    const customLayers: CustomAgentLayer[] = [
      { kind: "custom", priority: 20, immutable: false, content: "alpha" },
      { kind: "custom", priority: 30, immutable: false, content: "beta" },
      { kind: "custom", priority: 40, immutable: false, content: "gamma" },
    ];
    const composed = composeAgentRuntime({
      systemPrompt: "ok",
      userPrompt: "hi",
      model: "m",
      tools: ["alpha"],
      customLayers,
    });
    const toolLayers = composed.layers.filter((l) => l.kind === "tool-runtime");
    expect(toolLayers).toHaveLength(1);
    expect(toolLayers[0].tools).toEqual([{ name: "alpha", trusted: true }]);
    expect(composed.layers.filter((layer) => layer.kind === "custom")).toEqual(customLayers);
  });
});
