/**
 * @vitest-environment node
 */
import { describe, expect, it } from "vitest";
import { assessChildExploitationSafety } from "../../src/shared/safety/childExploitationGuard";
import {
  DEFAULT_ENHANCE_INSTRUCTIONS,
  DEFAULT_REMIX_INSTRUCTIONS,
  MANDATORY_ENHANCE_PROTOCOL,
  MANDATORY_REMIX_PROTOCOL,
} from "../../src/shared/imagePromptDefaults";
import { buildEnhancerUserMessage } from "../../src/services/prompt-enhancer-service";

/**
 * Builds the exact outbound /chat/completions payload used by the internal
 * prompt enhancer for a given mode and user prompt.
 */
function buildEnhancerPayload(
  mode: "enhance" | "remix",
  userPrompt: string,
  configuredInstructions: string,
) {
  const systemProtocol = mode === "remix" ? MANDATORY_REMIX_PROTOCOL : MANDATORY_ENHANCE_PROTOCOL;
  return {
    model: "internal-text-enhancer",
    messages: [
      { role: "system" as const, content: systemProtocol },
      {
        role: "user" as const,
        content: buildEnhancerUserMessage(
          { mode, prompt: userPrompt },
          configuredInstructions,
        ),
      },
    ],
    temperature: 0.2,
    max_tokens: 350,
    venice_parameters: { include_venice_system_prompt: false },
  };
}

/**
 * Words that have historically caused the non-disableable child-exploitation
 * guard to false-positive on benign image-prompt enhancer traffic because the
 * mandatory protocol accidentally contained sexualization or hard-youth
 * signals. The protocol and user message must not include them.
 */
const PROHIBITED_PROTOCOL_TRIGGERS = ["explicit", "child-safety"];

describe("prompt enhancer guard regression", () => {
  const benignPrompts = [
    "cat",
    "sunset over mountains",
    "anime girl",
    "frieren anime",
    "portrait of a woman",
  ];

  it("does not include known guard trigger words in mandatory protocols", () => {
    for (const protocol of [MANDATORY_ENHANCE_PROTOCOL, MANDATORY_REMIX_PROTOCOL]) {
      const lower = protocol.toLowerCase();
      for (const trigger of PROHIBITED_PROTOCOL_TRIGGERS) {
        expect(lower).not.toContain(trigger);
      }
    }
  });

  it.each(benignPrompts)(
    "allows the enhancer payload for benign prompt: %s",
    (prompt) => {
      const payload = buildEnhancerPayload("enhance", prompt, "Prefer cinematic lighting.");
      const decision = assessChildExploitationSafety({
        endpoint: "/chat/completions",
        method: "POST",
        payload,
        source: "ipc",
      });
      expect(decision.allow).toBe(true);
      expect(decision.action).toBe("allow");
    },
  );

  it.each(benignPrompts)(
    "allows the remix payload for benign prompt: %s",
    (prompt) => {
      const payload = buildEnhancerPayload("remix", prompt, "Prefer a fresh camera angle.");
      const decision = assessChildExploitationSafety({
        endpoint: "/chat/completions",
        method: "POST",
        payload,
        source: "ipc",
      });
      expect(decision.allow).toBe(true);
      expect(decision.action).toBe("allow");
    },
  );

  it("still blocks real CSAM genre labels that appear in user prompts", () => {
    const payload = buildEnhancerPayload("enhance", "loli character", "");
    const decision = assessChildExploitationSafety({
      endpoint: "/chat/completions",
      method: "POST",
      payload,
      source: "ipc",
    });
    expect(decision.allow).toBe(false);
    expect(decision.reasonCode).toBe("CSAM_GENRE_TERM");
  });

  it("does not include trigger words in the user message output contract", () => {
    const userMessage = buildEnhancerUserMessage(
      { mode: "enhance", prompt: "cat" },
      "",
    );
    const lower = userMessage.toLowerCase();
    for (const trigger of PROHIBITED_PROTOCOL_TRIGGERS) {
      expect(lower).not.toContain(trigger);
    }
    // Sanity: the output contract reminder should still be present.
    expect(userMessage).toMatch(/Preserve the original subject/);
  });
});
