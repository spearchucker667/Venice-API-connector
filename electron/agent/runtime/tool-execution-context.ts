/** @fileoverview Authoritative main-process context for agent tool execution.
 *
 *  ToolExecutionContext carries identity, session, preset, and grant authority
 *  that the renderer/model must never be allowed to supply. It is constructed
 *  inside the main process after IPC sender validation and is the single
 *  source of truth for capability decisions in executeAgentTool.
 */

import type {
  AgentPermissionPreset,
  Capability,
  CapabilityGrant,
  WorkspaceGrant,
} from "../../../src/agent/contracts/capabilities";
import { capabilitiesForPreset } from "../../../src/agent/contracts/capabilities";

export interface ToolExecutionContext {
  /** Active profile id, main-process authoritative. */
  profileId: string;
  /** The long-lived runtime session id for this main-process instance. */
  runtimeSessionId: string;
  /** The renderer-scoped session id (includes sender id and optional agent session). */
  rendererSessionId: string;
  /** Optional Document Agent session id supplied by the renderer. */
  agentSessionId?: string;
  /** The effective permission preset for this request. */
  preset: AgentPermissionPreset;
  /** Derived capability grant from the preset/session. */
  capabilityGrant: CapabilityGrant;
  /** Resolved workspace grant for this renderer session, if any. */
  workspaceGrant: WorkspaceGrant | null;
}

export function createToolExecutionContext(input: {
  profileId: string;
  runtimeSessionId: string;
  senderId: number;
  agentSessionId?: string;
  preset: AgentPermissionPreset;
  workspaceGrant?: WorkspaceGrant | null;
}): ToolExecutionContext {
  const rendererSessionId = `${input.runtimeSessionId}:renderer_${input.senderId}${input.agentSessionId ? `:agent_${input.agentSessionId}` : ""}`;
  const capabilityGrant: CapabilityGrant = {
    id: `preset:${input.profileId}:${rendererSessionId}`,
    sessionId: rendererSessionId,
    preset: input.preset,
    capabilities: capabilitiesForPreset(input.preset),
    issuedAt: new Date().toISOString(),
    userInitiated: true,
  };
  return {
    profileId: input.profileId,
    runtimeSessionId: input.runtimeSessionId,
    rendererSessionId,
    agentSessionId: input.agentSessionId,
    preset: input.preset,
    capabilityGrant,
    workspaceGrant: input.workspaceGrant ?? null,
  };
}

/** Returns true when the context's preset includes the requested capability. */
export function contextHasCapability(
  ctx: ToolExecutionContext,
  capability: Capability,
): boolean {
  return ctx.capabilityGrant.capabilities.includes(capability);
}
