/** Central pipeline for Venice Forge's mandatory child-safety guard and
 * optional local family-filter state. */
import type { SafetyGuardDecision, SafetyGuardInput } from "./childExploitationGuard";
import { recordDecision } from "./guardAudit";
import { runLocalFamilyGuard } from "./localFamilyGuardRules";
export { runLocalFamilyGuard } from "./localFamilyGuardRules";

export const FAMILY_SAFE_MODE_BLOCK_MESSAGE =
  "Blocked by child-safety protections. This protection cannot be disabled.";

export type LocalGuardDecision =
  | {
      allowed: true;
      skipped?: boolean;
      reason?: string;
      guardDecision?: SafetyGuardDecision;
    }
  | {
      allowed: false;
      skipped?: false;
      reason: string;
      ruleId?: string;
      userMessage: string;
      guardDecision: SafetyGuardDecision;
    };

/**
 * Always evaluates the non-disableable child-exploitation guard. The
 * `localFamilySafeModeEnabled` flag controls optional family-filter behavior,
 * but it must never bypass legally required child-safety enforcement.
 */
export function maybeRunLocalFamilyGuard(
  input: SafetyGuardInput,
  localFamilySafeModeEnabled: boolean,
): LocalGuardDecision {
  const guardDecision = runLocalFamilyGuard(input);
  recordDecision(guardDecision);
  if (!guardDecision.allow || guardDecision.action === "block") {
    return {
      allowed: false,
      reason: guardDecision.reasonCode,
      ruleId: guardDecision.reasonCode,
      userMessage: FAMILY_SAFE_MODE_BLOCK_MESSAGE,
      guardDecision,
    };
  }

  return localFamilySafeModeEnabled
    ? { allowed: true, guardDecision }
    : {
        allowed: true,
        skipped: true,
        reason: "optional-local-family-filter-disabled-child-safety-checked",
        guardDecision,
      };
}

/**
 * Non-mutating preview of the local Family Safe Mode decision. Evaluates the
 * rule engine the same way `maybeRunLocalFamilyGuard` does, but NEVER calls
 * `recordDecision`. Use this for inspector / telemetry previews so the
 * authoritative main-process IPC enforcement path is the sole producer of
 * audit counters.
 *
 * Returning a `skipped: true` decision for Adult Mode is intentional — the
 * inspector can show the operator that the local filter is disabled without
 * the renderer pretending to enforce it.
 */
export function previewLocalFamilyGuard(
  input: SafetyGuardInput,
  localFamilySafeModeEnabled: boolean,
): LocalGuardDecision {
  const guardDecision = runLocalFamilyGuard(input);
  if (!guardDecision.allow || guardDecision.action === "block") {
    return {
      allowed: false,
      reason: guardDecision.reasonCode,
      ruleId: guardDecision.reasonCode,
      userMessage: FAMILY_SAFE_MODE_BLOCK_MESSAGE,
      guardDecision,
    };
  }

  return localFamilySafeModeEnabled
    ? { allowed: true, guardDecision }
    : {
        allowed: true,
        skipped: true,
        reason: "optional-local-family-filter-disabled-child-safety-checked",
        guardDecision,
      };
}

export type ResponseBodyScreenResult =
  | { allowed: true; skipped: boolean; reason?: string }
  | {
      allowed: false;
      reason: string;
      reasonCode: string;
      category: SafetyGuardDecision["category"];
      severity: SafetyGuardDecision["severity"];
      ruleId?: string;
      userMessage: string;
    };

export type SafetyBlockBody = {
  error: string;
  reasonCode: string;
  category: SafetyGuardDecision["category"];
  severity: SafetyGuardDecision["severity"];
};

export function safetyBlockBodyFromResponseScreen(
  screen: Extract<ResponseBodyScreenResult, { allowed: false }>,
): SafetyBlockBody {
  return {
    error: screen.userMessage,
    reasonCode: screen.reasonCode,
    category: screen.category,
    severity: screen.severity,
  };
}

/**
 * Screens a string returned by a web-proxy or scrape boundary. The guard is
 * always subject to the child-exploitation guard. When the optional Family
 * Safe Mode setting is OFF, an allowed result is marked `skipped` only to
 * describe the optional layer; child-safety evaluation still occurred.
 *
 * Callers MUST treat blocked results as a 451 with the supplied `userMessage`
 * (do not echo raw body content back to the user). When the input is shorter
 * than the guard's prompt-hash budget we screen verbatim; for very large
 * bodies we sample a window to keep evaluation O(1) on payload size.
 */
export function screenResponseBody(
  body: string,
  context: SafetyGuardInput,
  localFamilySafeModeEnabled: boolean,
  sampleWindow = 8000,
): ResponseBodyScreenResult {
  const sample = body.length > sampleWindow ? body.slice(0, sampleWindow) : body;
  const input: SafetyGuardInput = { ...context, text: sample };
  const decision = maybeRunLocalFamilyGuard(input, localFamilySafeModeEnabled);
  if (!decision.allowed) {
    return {
      allowed: false,
      reason: decision.reason,
      reasonCode: decision.guardDecision.reasonCode,
      category: decision.guardDecision.category,
      severity: decision.guardDecision.severity,
      ruleId: decision.ruleId,
      userMessage: decision.userMessage,
    };
  }
  return {
    allowed: true,
    skipped: !localFamilySafeModeEnabled,
    ...(localFamilySafeModeEnabled
      ? {}
      : { reason: "optional-local-family-filter-disabled-child-safety-checked" }),
  };
}

export * from "./mediaScreener";
