/** @fileoverview Canonical, strongly-typed approval plan factories.
 *
 *  Every approval-bound agent tool uses these factories so the plan stored
 *  in `privateExecutionPlan` always satisfies the same validators used by
 *  the approval execution path. Keeping the shape in one place eliminates
 *  the drift that previously allowed proposals to be created with missing
 *  grant/session/workspace identity.
 */

import type { DocumentEditOperation } from "../../../src/agent/contracts/documents";
import type { WorkspaceChange } from "../../../src/agent/contracts/workspace";

export interface DocumentEditPlan {
  kind: "document_edit";
  profileId: string;
  documentId: string;
  baseRevisionId: string;
  summary: string;
  operations: DocumentEditOperation[];
}

export interface DocumentRestorePlan {
  kind: "document_restore";
  profileId: string;
  documentId: string;
  currentRevisionId: string;
  restoreRevisionId: string;
  reason: string;
}

export interface WorkspaceChangesetPlan {
  kind: "workspace_changeset";
  profileId: string;
  grantId: string;
  agentSessionId?: string;
  workspaceId: string;
  summary: string;
  changes: WorkspaceChange[];
}

export interface WorkspaceMovePlan {
  kind: "workspace_move";
  profileId: string;
  grantId: string;
  agentSessionId?: string;
  workspaceId: string;
  sourcePath: string;
  destinationPath: string;
}

export interface WorkspaceTrashPlan {
  kind: "workspace_trash";
  profileId: string;
  grantId: string;
  agentSessionId?: string;
  workspaceId: string;
  relativePath: string;
}

export interface DocumentExportPlan {
  kind: "document_export";
  profileId: string;
  documentId: string;
  revisionId?: string;
  format: import("../../../src/agent/contracts/documents").DocumentFormat;
  suggestedFileName: string;
}

export type ExecutionPlan =
  | DocumentEditPlan
  | DocumentRestorePlan
  | DocumentExportPlan
  | WorkspaceChangesetPlan
  | WorkspaceMovePlan
  | WorkspaceTrashPlan;

export function buildDocumentEditPlan(input: {
  profileId: string;
  documentId: string;
  baseRevisionId: string;
  summary: string;
  operations: DocumentEditOperation[];
}): DocumentEditPlan {
  return {
    kind: "document_edit",
    profileId: input.profileId,
    documentId: input.documentId,
    baseRevisionId: input.baseRevisionId,
    summary: input.summary,
    operations: structuredClone(input.operations),
  };
}

export function buildDocumentRestorePlan(input: {
  profileId: string;
  documentId: string;
  currentRevisionId: string;
  restoreRevisionId: string;
  reason: string;
}): DocumentRestorePlan {
  return {
    kind: "document_restore",
    profileId: input.profileId,
    documentId: input.documentId,
    currentRevisionId: input.currentRevisionId,
    restoreRevisionId: input.restoreRevisionId,
    reason: input.reason,
  };
}

export function buildDocumentExportPlan(input: {
  profileId: string;
  documentId: string;
  revisionId?: string;
  format: import("../../../src/agent/contracts/documents").DocumentFormat;
  suggestedFileName: string;
}): DocumentExportPlan {
  return {
    kind: "document_export",
    profileId: input.profileId,
    documentId: input.documentId,
    revisionId: input.revisionId,
    format: input.format,
    suggestedFileName: input.suggestedFileName,
  };
}

export function buildWorkspaceChangesetPlan(input: {
  profileId: string;
  grantId: string;
  agentSessionId?: string;
  workspaceId: string;
  summary: string;
  changes: WorkspaceChange[];
}): WorkspaceChangesetPlan {
  return {
    kind: "workspace_changeset",
    profileId: input.profileId,
    grantId: input.grantId,
    agentSessionId: input.agentSessionId,
    workspaceId: input.workspaceId,
    summary: input.summary,
    changes: structuredClone(input.changes),
  };
}

export function buildWorkspaceMovePlan(input: {
  profileId: string;
  grantId: string;
  agentSessionId?: string;
  workspaceId: string;
  sourcePath: string;
  destinationPath: string;
}): WorkspaceMovePlan {
  return {
    kind: "workspace_move",
    profileId: input.profileId,
    grantId: input.grantId,
    agentSessionId: input.agentSessionId,
    workspaceId: input.workspaceId,
    sourcePath: input.sourcePath,
    destinationPath: input.destinationPath,
  };
}

export function buildWorkspaceTrashPlan(input: {
  profileId: string;
  grantId: string;
  agentSessionId?: string;
  workspaceId: string;
  relativePath: string;
}): WorkspaceTrashPlan {
  return {
    kind: "workspace_trash",
    profileId: input.profileId,
    grantId: input.grantId,
    agentSessionId: input.agentSessionId,
    workspaceId: input.workspaceId,
    relativePath: input.relativePath,
  };
}

function hasString(value: unknown, key: string): boolean {
  return typeof (value as Record<string, unknown> | undefined)?.[key] === "string";
}

export function isDocumentEditPlan(value: unknown): value is DocumentEditPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<DocumentEditPlan>;
  return (
    plan.kind === "document_edit" &&
    hasString(plan, "profileId") &&
    hasString(plan, "documentId") &&
    hasString(plan, "baseRevisionId") &&
    hasString(plan, "summary") &&
    Array.isArray(plan.operations)
  );
}

export function isDocumentRestorePlan(value: unknown): value is DocumentRestorePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<DocumentRestorePlan>;
  return (
    plan.kind === "document_restore" &&
    hasString(plan, "profileId") &&
    hasString(plan, "documentId") &&
    hasString(plan, "currentRevisionId") &&
    hasString(plan, "restoreRevisionId") &&
    hasString(plan, "reason")
  );
}

export function isDocumentExportPlan(value: unknown): value is DocumentExportPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<DocumentExportPlan>;
  return (
    plan.kind === "document_export" &&
    hasString(plan, "profileId") &&
    hasString(plan, "documentId") &&
    hasString(plan, "suggestedFileName")
  );
}

export function isWorkspaceChangesetPlan(value: unknown): value is WorkspaceChangesetPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<WorkspaceChangesetPlan>;
  return (
    plan.kind === "workspace_changeset" &&
    hasString(plan, "profileId") &&
    hasString(plan, "grantId") &&
    hasString(plan, "workspaceId") &&
    hasString(plan, "summary") &&
    Array.isArray(plan.changes)
  );
}

export function isWorkspaceMovePlan(value: unknown): value is WorkspaceMovePlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<WorkspaceMovePlan>;
  return (
    plan.kind === "workspace_move" &&
    hasString(plan, "profileId") &&
    hasString(plan, "grantId") &&
    hasString(plan, "workspaceId") &&
    hasString(plan, "sourcePath") &&
    hasString(plan, "destinationPath")
  );
}

export function isWorkspaceTrashPlan(value: unknown): value is WorkspaceTrashPlan {
  if (!value || typeof value !== "object") return false;
  const plan = value as Partial<WorkspaceTrashPlan>;
  return (
    plan.kind === "workspace_trash" &&
    hasString(plan, "profileId") &&
    hasString(plan, "grantId") &&
    hasString(plan, "workspaceId") &&
    hasString(plan, "relativePath")
  );
}
