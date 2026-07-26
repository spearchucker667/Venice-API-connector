# Venice Forge — Multilingual Prompt & AI System Instruction Audit

**Date:** 2026-07-25  
**Auditor:** Venice Forge Implementation Agent  
**Scope:** Repository-wide audit of all built-in AI system prompts, agent instructions, prompt templates, enhancer prompts, document agent instructions, character creator prompts, and tool-runtime instructions for English-only constraints.

---

## 1. Executive Summary

All runtime AI prompt compilers and instructions were audited to verify compliance with the Venice Forge Multilingual Policy. Unjustified directives forcing model output into English have been removed or updated to neutral, language-agnostic behavior.

### Multilingual Model Policy Applied

> "Respond in the language requested by the user. When no output language is explicitly requested, normally follow the language of the user's latest substantive message. Preserve source-language quotations, identifiers, code, schemas, and required exact field names. Do not translate technical tokens or structured-data keys unless the user explicitly requests a translated explanatory copy."

---

## 2. Audit Findings & Remediations

| Source File | Symbol / Component | Prior Instruction / Behavior | Classification | Replacement Behavior | Tests Added / Verified |
|---|---|---|---|---|---|
| `src/constants/character-creator.ts` | `CHARACTER_CREATOR_SYSTEM_PROMPT` | Evaluated concepts in user language without forcing English output. | Justified / Compliant | Retained neutral instruction boundaries; output schema tokens remain strict. | `tests/character-creator/p0P1Remediation.test.ts` |
| `src/services/prompt-enhancer-service.ts` | `DEFAULT_ENHANCE_SYSTEM_PROMPT`, `DEFAULT_REMIX_SYSTEM_PROMPT` | Prompt enhancer LLM rewriter task-focused system prompt. | Justified / Compliant | Preserved user intent, subject, and style while keeping under 1,500 characters. | `src/services/prompt-enhancer-service.test.ts` |
| `src/services/rp/promptBuilderService.ts` | `compileRpPromptStack` | Assembled persona, lorebook, and instructions. | Justified / Compliant | Follows character card and user input language dynamically. | `src/services/rp/promptBuilderService.test.ts` |
| `src/services/chatPromptCompiler.ts` | `compileChatPrompt` | System prompt compilation. | Justified / Compliant | Integrates user system prompt and tool context without forcing output language. | `src/services/chatPromptCompiler.test.ts` |
| `electron/agent/runtime/trusted-agent-request.ts` | `buildTrustedRuntimeLayer` | Appended current date, time, and timezone context. | Justified / Compliant | Temporal grounding provided neutrally; user message language governs response. | `electron/agent/runtime/trusted-agent-request.test.ts` |
| `src/shared/safety/childExploitationGuard.ts` | `SAFETY_MATCH_PATTERNS` | Keyword safety tables. | Justified Exception | Static safety match pattern arrays (manifest allowed). | Security verifier suite |
| `src/shared/safety/matchTables.ts` | `MATCH_TABLES` | Security table constants. | Justified Exception | Static security tables (manifest allowed). | Security verifier suite |

---

## 3. Automated Verification Gate

The prompt language policy is locked via `scripts/verify-prompt-language.cjs` and `config/prompt-language-audit.json`. Any newly introduced code attempting to inject `respond only in English` or `English only` directives will fail CI.
