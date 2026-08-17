/** @fileoverview Shared, transport-independent model capability gates.
 *
 *  Gate tool injection and capability-gated request fields ONLY on explicit
 *  runtime metadata (P1-005/P3-001): missing metadata fails closed so an
 *  unsupported model never receives `tools` / tool choice from the canonical
 *  body builder. Never hard-code production model IDs here.
 */

export interface FunctionCallingCapableModel {
  capabilities?: { supportsFunctionCalling?: boolean };
}

/** True only when the model explicitly advertises function calling. */
export function supportsFunctionCalling(
  modelInfo: FunctionCallingCapableModel | undefined,
): boolean {
  return modelInfo?.capabilities?.supportsFunctionCalling === true;
}

/** True only when the model explicitly advertises vision. */
export function supportsVision(modelInfo: FunctionCallingCapableModel & {
  capabilities?: { supportsVision?: boolean };
} | undefined): boolean {
  return modelInfo?.capabilities?.supportsVision === true;
}