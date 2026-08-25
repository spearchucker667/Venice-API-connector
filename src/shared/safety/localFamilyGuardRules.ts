/** The Family Safe Mode rule engine entry point. Kept separate so skip behavior is testable. */
import {
  assessChildExploitationSafety,
  evaluateImageAdultContentPolicy,
  type SafetyGuardDecision,
  type SafetyGuardInput,
} from "./childExploitationGuard";

/**
 * Runs the safety stack for a request.
 *
 * 1. The mandatory child-exploitation guard always runs first.
 * 2. If it blocks, that decision is returned immediately.
 * 3. If Family Safe Mode is enabled and the request reaches an image endpoint,
 *    the optional adult-content image policy is evaluated.
 * 4. Otherwise the request is allowed.
 */
export function runLocalFamilyGuard(
  input: SafetyGuardInput,
  localFamilySafeModeEnabled: boolean,
): SafetyGuardDecision {
  const mandatoryDecision = assessChildExploitationSafety(input);
  if (!mandatoryDecision.allow || mandatoryDecision.action === "block") {
    return mandatoryDecision;
  }

  if (localFamilySafeModeEnabled) {
    const optionalDecision = evaluateImageAdultContentPolicy(input);
    if (optionalDecision && (!optionalDecision.allow || optionalDecision.action === "block")) {
      return optionalDecision;
    }
  }

  return mandatoryDecision;
}
