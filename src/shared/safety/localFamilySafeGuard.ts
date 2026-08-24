/** Central pipeline for Venice Forge's mandatory child-safety guard and
 * optional local family-filter state. */
import type { SafetyGuardDecision, SafetyGuardInput } from "./childExploitationGuard";
import { recordDecision } from "./guardAudit";
import { runLocalFamilyGuard } from "./localFamilyGuardRules";
export { runLocalFamilyGuard } from "./localFamilyGuardRules";

export const FAMILY_SAFE_MODE_BLOCK_MESSAGE =
  "Blocked by child-safety protections. This protection cannot be disabled.";

export type SafetyDecisionCategory =
  | "adult-content-approved"
  | "general"
  | "child-safety"
  | "illegal-content"
  | "provider-policy"
  | "validation-error";

export type SafetyDecision =
  | { allowed: true; category: "adult-content-approved" | "general" }
  | {
      allowed: false;
      category: Exclude<SafetyDecisionCategory, "adult-content-approved" | "general">;
      userMessage: string;
    };

export type LocalGuardDecision =
  | {
      allowed: true;
      skipped?: boolean;
      reason?: string;
      guardDecision?: SafetyGuardDecision;
      category?: Extract<SafetyDecisionCategory, "adult-content-approved" | "general">;
    }
  | {
      allowed: false;
      skipped?: false;
      reason: string;
      ruleId?: string;
      userMessage: string;
      guardDecision: SafetyGuardDecision;
      category: Exclude<SafetyDecisionCategory, "adult-content-approved" | "general">;
    };

function uiCategoryFromGuardCategory(
  guardCategory: SafetyGuardDecision["category"],
): SafetyDecision["category"] {
  switch (guardCategory) {
    case "adult_sexual_content":
      return "adult-content-approved";
    case "allowed_child_safety_context":
    case "none":
      return "general";
    case "csam_request":
      return "illegal-content";
    case "minor_sexualization":
    case "fictional_minor_sexualization":
    case "obfuscated_minor_sexualization":
    case "age_evasion":
    case "grooming_or_exploitation":
    case "unsafe_image_generation":
    case "unsafe_roleplay":
    case "unsafe_batch_or_automation":
    case "ambiguous_youth_context":
      return "child-safety";
    default:
      return "child-safety";
  }
}

function userMessageForSafetyDecision(
  category: Exclude<SafetyDecisionCategory, "adult-content-approved" | "general">,
  _reasonCode: string,
): string {
  switch (category) {
    case "illegal-content":
      return "Blocked: illegal-content protection triggered.\n\nReason:\nThe request appears to involve child sexual abuse material or a CSAM genre label.\n\nAdult fictional content is not blocked by this rule.";
    case "child-safety":
      return "Blocked: child-safety protection triggered.\n\nReason:\nThe request appears to involve a minor, age-ambiguous subject, or exploitative content.\n\nAdult fictional content is not blocked by this rule.";
    case "provider-policy":
      return "Blocked: provider policy violation.\n\nReason:\nThe request violates the selected provider's content policy.";
    case "validation-error":
      return "Blocked: request validation failed.\n\nReason:\nThe request could not be validated for safety.";
  }
}

export function toSafetyDecision(
  guardDecision: SafetyGuardDecision,
): SafetyDecision {
  if (!guardDecision.allow || guardDecision.action === "block") {
    const category = uiCategoryFromGuardCategory(guardDecision.category);
    if (category === "adult-content-approved" || category === "general") {
      return {
        allowed: false,
        category: "child-safety",
        userMessage: userMessageForSafetyDecision("child-safety", guardDecision.reasonCode),
      };
    }
    return {
      allowed: false,
      category,
      userMessage: userMessageForSafetyDecision(category, guardDecision.reasonCode),
    };
  }
  return {
    allowed: true,
    category: guardDecision.category === "adult_sexual_content" ? "adult-content-approved" : "general",
  };
}

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
    const decision = toSafetyDecision(guardDecision);
    return {
      allowed: false,
      reason: guardDecision.reasonCode,
      ruleId: guardDecision.reasonCode,
      userMessage: decision.allowed ? FAMILY_SAFE_MODE_BLOCK_MESSAGE : decision.userMessage,
      guardDecision,
      category: decision.allowed ? "child-safety" : decision.category,
    };
  }

  const decision = toSafetyDecision(guardDecision);
  const allowedCategory = decision.category as Extract<
    SafetyDecisionCategory,
    "adult-content-approved" | "general"
  >;
  return localFamilySafeModeEnabled
    ? { allowed: true, guardDecision, category: allowedCategory }
    : {
        allowed: true,
        skipped: true,
        reason: "optional-local-family-filter-disabled-child-safety-checked",
        guardDecision,
        category: allowedCategory,
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
    const decision = toSafetyDecision(guardDecision);
    return {
      allowed: false,
      reason: guardDecision.reasonCode,
      ruleId: guardDecision.reasonCode,
      userMessage: decision.allowed ? FAMILY_SAFE_MODE_BLOCK_MESSAGE : decision.userMessage,
      guardDecision,
      category: decision.allowed ? "child-safety" : decision.category,
    };
  }

  const decision = toSafetyDecision(guardDecision);
  const allowedCategory = decision.category as Extract<
    SafetyDecisionCategory,
    "adult-content-approved" | "general"
  >;
  return localFamilySafeModeEnabled
    ? { allowed: true, guardDecision, category: allowedCategory }
    : {
        allowed: true,
        skipped: true,
        reason: "optional-local-family-filter-disabled-child-safety-checked",
        guardDecision,
        category: allowedCategory,
      };
}

export type ResponseBodyScreenResult =
  | { allowed: true; skipped: boolean; reason?: string; uiCategory?: SafetyDecisionCategory }
  | {
      allowed: false;
      reason: string;
      reasonCode: string;
      category: SafetyGuardDecision["category"];
      uiCategory: SafetyDecisionCategory;
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
      uiCategory: decision.category,
      severity: decision.guardDecision.severity,
      ruleId: decision.ruleId,
      userMessage: decision.userMessage,
    };
  }
  return {
    allowed: true,
    skipped: !localFamilySafeModeEnabled,
    uiCategory: decision.category,
    ...(localFamilySafeModeEnabled
      ? {}
      : { reason: "optional-local-family-filter-disabled-child-safety-checked" }),
  };
}

export * from "./mediaScreener";
