/** @fileoverview Tests for the internal prompt-enhancer LLM service. */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../lib/venice-client", () => ({
  venice: vi.fn(),
}));

import { venice } from "../lib/venice-client";
import {
  DEFAULT_ENHANCER_MODEL,
  DEFAULT_ENHANCE_SYSTEM_PROMPT,
  DEFAULT_REMIX_SYSTEM_PROMPT,
  PromptEnhancerDisabledError,
  enhancePrompt,
  remixPrompt,
  stripEnhancerOutput,
} from "./prompt-enhancer-service";

const mockedVenice = vi.mocked(venice);

beforeEach(() => {
  mockedVenice.mockReset();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("stripEnhancerOutput", () => {
  it("removes leading/trailing markdown fences", () => {
    expect(stripEnhancerOutput("```\nhello world\n```")).toBe("hello world");
    expect(stripEnhancerOutput("```txt\nhello world\n```")).toBe("hello world");
  });

  it("strips surrounding double and single quotes", () => {
    expect(stripEnhancerOutput('"hello world"')).toBe("hello world");
    expect(stripEnhancerOutput("'hello world'")).toBe("hello world");
  });

  it("strips trailing dash separators", () => {
    expect(stripEnhancerOutput("hello world\n---")).toBe("hello world");
  });

  it("strips a leading 'Here is your enhanced prompt:' prefix", () => {
    expect(stripEnhancerOutput("Here is your enhanced prompt: hello")).toBe("hello");
    expect(stripEnhancerOutput("Sure, here is a remix: hello")).toBe("hello");
  });
});

describe("default safety posture", () => {
  it("does not add an application-authored censorship layer", () => {
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/application-authored censorship layer/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/application-authored censorship layer/i);
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/mandatory child-safety enforcement/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/mandatory child-safety enforcement/i);
  });

  it("default system prompts state the absolute 1500-character ceiling", () => {
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/1500-character/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/1500-character/i);
  });
});

describe("default prompt content", () => {
  it("enhance prompt instructs preservation of user intent and constraints", () => {
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/preserve/i);
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/explicitness/i);
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/constraint/i);
    expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).toMatch(/do not sanitize/i);
  });

  it("remix prompt instructs preservation of all user-declared invariants", () => {
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/preserve all user-declared invariants/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/identities/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/relationships/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/explicitness/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).toMatch(/medium/i);
    expect(DEFAULT_REMIX_SYSTEM_PROMPT).not.toMatch(/core subject matter only/i);
  });

  it("default prompts do not contain generic refusal or safe-assistant boilerplate", () => {
    const boilerplate = [
      /cannot fulfill/i,
      /i'm sorry/i,
      /as an ai/i,
      /family.?friendly/i,
      /appropriate content/i,
      /safe assistant/i,
      /cannot generate/i,
      /cannot help/i,
    ];
    for (const pattern of boilerplate) {
      expect(DEFAULT_ENHANCE_SYSTEM_PROMPT).not.toMatch(pattern);
      expect(DEFAULT_REMIX_SYSTEM_PROMPT).not.toMatch(pattern);
    }
  });
});

describe("enhancePrompt routing", () => {
  it("calls venice /chat/completions (never raw fetch)", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "A vivid improved prompt." } }],
    });
    await enhancePrompt({ mode: "enhance", prompt: "a cat" });
    expect(mockedVenice).toHaveBeenCalledTimes(1);
    const [path, opts] = mockedVenice.mock.calls[0];
    expect(path).toBe("/chat/completions");
    expect(opts?.method).toBe("POST");
  });

  it("uses the configured model, temperature, and max_tokens", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });
    await enhancePrompt(
      { mode: "enhance", prompt: "x" },
      {
        enabled: true,
        model: "custom-model-1",
        temperature: 0.9,
        maxTokens: 250,
        systemPrompt: "",
        remixSystemPrompt: "",
      },
    );
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.model).toBe("custom-model-1");
    expect(body.temperature).toBe(0.9);
    expect(body.max_tokens).toBe(250);
  });

  it("clamps temperature and maxTokens to safe ranges", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });
    await enhancePrompt(
      { mode: "enhance", prompt: "x" },
      {
        enabled: true,
        model: "m",
        temperature: 99,
        maxTokens: 99999,
        systemPrompt: "",
        remixSystemPrompt: "",
      },
    );
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.temperature).toBeLessThanOrEqual(2);
    expect(body.max_tokens).toBeLessThanOrEqual(4000);
  });

  it("uses the configured system prompt when provided", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });
    const custom = "Custom system instruction. Be terse.";
    await enhancePrompt(
      { mode: "enhance", prompt: "x" },
      {
        enabled: true,
        model: "m",
        temperature: 0.5,
        maxTokens: 100,
        systemPrompt: custom,
        remixSystemPrompt: "",
      },
    );
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].role).toBe("system");
    expect(messages[0].content).toBe(custom);
  });

  it("falls back to the default enhance system prompt when config is missing", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });
    await enhancePrompt({ mode: "enhance", prompt: "x" });
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toBe(DEFAULT_ENHANCE_SYSTEM_PROMPT);
  });

  it("throws PromptEnhancerDisabledError when enabled is false", async () => {
    await expect(
      enhancePrompt(
        { mode: "enhance", prompt: "x" },
        {
          enabled: false,
          model: "m",
          temperature: 0.4,
          maxTokens: 100,
          systemPrompt: "",
          remixSystemPrompt: "",
        },
      ),
    ).rejects.toBeInstanceOf(PromptEnhancerDisabledError);
    expect(mockedVenice).not.toHaveBeenCalled();
  });

  it("defaults to the canonical Venice model id when model is missing", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "ok" } }],
    });
    await enhancePrompt({ mode: "enhance", prompt: "x" });
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    expect(body.model).toBe(DEFAULT_ENHANCER_MODEL);
  });
});

describe("enhancePrompt output handling", () => {
  it("strips markdown fences from the LLM response", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "```\nA vivid improved prompt.\n```" } }],
    });
    const result = await enhancePrompt({ mode: "enhance", prompt: "cat" });
    expect(result.prompt).toBe("A vivid improved prompt.");
  });

  it("falls back to the original prompt when output is empty after stripping", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "```\n```" } }],
    });
    const result = await enhancePrompt({ mode: "enhance", prompt: "cat" });
    expect(result.prompt).toBe("cat");
  });

  it("falls back to the original prompt when the LLM returns no content", async () => {
    mockedVenice.mockResolvedValueOnce({ choices: [] });
    const result = await enhancePrompt({ mode: "enhance", prompt: "cat" });
    expect(result.prompt).toBe("cat");
  });

  it("clamps enhancer output to the image prompt limit even when the model exceeds it", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: `${"a".repeat(1490)}. ${"b".repeat(200)}` } }],
    });
    const result = await enhancePrompt({ mode: "enhance", prompt: "cat" });
    expect(result.prompt.length).toBeLessThanOrEqual(1500);
    expect(result.prompt.endsWith(".")).toBe(true);
  });

  it("never includes negative prompt sentinel text in the LLM enhancer prompt", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "vivid polished red ceramic teapot" } }],
    });
    await enhancePrompt({
      mode: "enhance",
      prompt: "a red teapot",
      negativePrompt: "NEGATIVE_SENTINEL_7F3B, text, watermark",
    });
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    const messages = body.messages as Array<{ role: string; content: string }>;
    const userPrompt = messages[1].content;
    expect(userPrompt).not.toContain("NEGATIVE_SENTINEL_7F3B");
    expect(userPrompt).not.toContain("NEGATIVE PROMPT");
  });
});

describe("remixPrompt routing", () => {
  it("uses the configured remix system prompt", async () => {
    mockedVenice.mockResolvedValueOnce({
      choices: [{ message: { content: "remixed" } }],
    });
    const custom = "Custom remix instruction.";
    await remixPrompt(
      { mode: "remix", prompt: "x" },
      {
        enabled: true,
        model: "m",
        temperature: 0.4,
        maxTokens: 100,
        systemPrompt: "",
        remixSystemPrompt: custom,
      },
    );
    const body = mockedVenice.mock.calls[0][1]?.body as Record<string, unknown>;
    const messages = body.messages as Array<{ role: string; content: string }>;
    expect(messages[0].content).toBe(custom);
  });

  it("throws PromptEnhancerDisabledError when disabled", async () => {
    await expect(
      remixPrompt(
        { mode: "remix", prompt: "x" },
        {
          enabled: false,
          model: "m",
          temperature: 0.4,
          maxTokens: 100,
          systemPrompt: "",
          remixSystemPrompt: "",
        },
      ),
    ).rejects.toBeInstanceOf(PromptEnhancerDisabledError);
  });
});
