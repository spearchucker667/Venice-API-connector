/* eslint-disable @typescript-eslint/no-explicit-any */

import { getAgentServices } from "./agent-services";
import { type ToolResult, safeToolError } from "../../../src/agent/contracts/tool-results";
import { internalToolNameForProvider } from "../../../src/agent/registry/tool-name-map";
import type { DocumentBlock, DocumentEditOperation, DocumentFormat } from "../../../src/agent/contracts/documents";
import { serializableDocumentToBlocks } from "../../../src/agent/documents/document-source";
import type { AssistantToolCall } from "../../../src/types/venice";
import { sanitizeErrorText } from "../../../src/shared/redaction";
import { performGuardedVeniceRequest } from "../../services/guardPipeline";
import { publishInspectorRequest, publishInspectorCompletion } from "../../services/inspectorTelemetry";
import { contextHasCapability, type ToolExecutionContext } from "./tool-execution-context";
import {
  buildDocumentEditPlan,
  buildDocumentExportPlan,
  buildDocumentRestorePlan,
  buildWorkspaceChangesetPlan,
  buildWorkspaceMovePlan,
  buildWorkspaceTrashPlan,
} from "../approvals/plan-factories";

export async function executeAgentTool(ctx: ToolExecutionContext, toolCall: AssistantToolCall): Promise<ToolResult> {
  const services = getAgentServices();
  const internalName = internalToolNameForProvider(toolCall.function.name);
  if (!internalName) {
    return safeToolError("document.get", toolCall.id, "INVALID_ARGUMENTS", `Unknown tool name: ${sanitizeErrorText(toolCall.function.name)}`);
  }
  const toolName = internalName;

  let args: Record<string, unknown>;
  try {
    const parsed: unknown = typeof toolCall.function.arguments === "string"
      ? JSON.parse(toolCall.function.arguments)
      : toolCall.function.arguments;
    args = (parsed ?? {}) as Record<string, unknown>;
  } catch (_error) {
    return safeToolError(toolName, toolCall.id, "INVALID_ARGUMENTS", sanitizeErrorText(`Failed to parse tool arguments: ${_error instanceof Error ? _error.message : String(_error)}`));
  }

  function requireCapability(capability: import("../../../src/agent/contracts/capabilities").Capability): ToolResult | null {
    if (!contextHasCapability(ctx, capability)) {
      return safeToolError(toolName, toolCall.id, "CAPABILITY_DENIED", `Preset ${ctx.preset} does not allow ${toolName}.`);
    }
    return null;
  }

  function resolveWorkspaceGrant(workspaceId: string): import("../../../src/agent/contracts/capabilities").WorkspaceGrant | null {
    if (!ctx.workspaceGrant) return null;
    if (ctx.workspaceGrant.workspaceId !== workspaceId) return null;
    return ctx.workspaceGrant;
  }

  try {
    if (internalName.startsWith("media.")) {
      return await executeMediaTool(ctx, internalName, toolCall.id, args);
    }

    switch (internalName) {
      case "document.get": {
        const denied = requireCapability("document:read");
        if (denied) return denied;
        const { documentId, revisionId, cursor } = args as { documentId: string; revisionId?: string; cursor?: string };
        const result = await services.documents.read(ctx.profileId, documentId, revisionId, cursor);
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: result };
      }

      case "document.create": {
        const denied = requireCapability("document:create");
        if (denied) return denied;
        const { projectId, relativePath, format, document, blocks, displayName, overwrite } = args as {
          projectId: string;
          relativePath: string;
          format: DocumentFormat;
          document?: unknown;
          blocks?: DocumentBlock[];
          displayName?: string;
          overwrite?: boolean;
        };
        if (overwrite === true) {
          return safeToolError(internalName, toolCall.id, "INVALID_ARGUMENTS", "document.create overwrite must be false.");
        }
        const resolvedBlocks = serializableDocumentToBlocks(document ?? blocks, format);
        const resolvedDisplayName = displayName || relativePath;
        const result = await services.documents.create(ctx.profileId, {
          projectId,
          relativePath,
          format,
          blocks: resolvedBlocks,
          displayName: resolvedDisplayName,
        });
        await services.audit.record({ sessionId: ctx.rendererSessionId, toolName: "document.create", outcome: "execution", resourceIds: [result.document.id] });
        const chatDocumentRef = {
          documentId: result.document.id,
          projectId: result.document.projectId,
          relativePath: result.document.libraryRelativePath,
          displayName: result.document.displayName,
          format: result.document.originalFormat,
          revisionId: result.revision.id,
        };
        return {
          ok: true,
          toolName: internalName,
          requestId: toolCall.id,
          data: {
            documentId: result.document.id,
            revisionId: result.revision.id,
            displayName: result.document.displayName,
            format: result.document.originalFormat,
            relativePath: result.document.libraryRelativePath,
            chatDocumentRef,
          },
        };
      }

      case "document.proposeEdits": {
        const denied = requireCapability("document:propose-update");
        if (denied) return denied;
        const { documentId, baseRevisionId, summary, operations } = args as { documentId: string; baseRevisionId: string; summary: string; operations: DocumentEditOperation[] };
        const preview = await services.documents.prepareEdits(ctx.profileId, { documentId, baseRevisionId, operations });
        const plan = buildDocumentEditPlan({ profileId: ctx.profileId, documentId, baseRevisionId, summary, operations });
        const pending = await services.approvals.prepare({
          grantId: `limited:${ctx.profileId}`,
          proposalType: "document_edit",
          canonicalToolName: "document.proposeEdits",
          validatedArguments: { documentId, baseRevisionId, summary, operations },
          baseRevisionIds: [baseRevisionId],
          affectedResources: [documentId],
          publicSummary: { summary, before: preview.before, after: preview.after, resultingContentHash: preview.resultingContentHash },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: ctx.rendererSessionId, toolName: "document.proposeEdits", outcome: "proposal", resourceIds: [documentId] });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, preview } };
      }

      case "document.export": {
        const denied = requireCapability("document:export");
        if (denied) return denied;
        const { documentId, revisionId, format, suggestedFileName } = args as { documentId: string; revisionId?: string; format: DocumentFormat; suggestedFileName: string };
        const plan = buildDocumentExportPlan({ profileId: ctx.profileId, documentId, revisionId, format, suggestedFileName });
        const source = await services.documents.getRevisionForSerialization(ctx.profileId, documentId, revisionId ?? null);
        const pending = await services.approvals.prepare({
          grantId: `limited:${ctx.profileId}`,
          proposalType: "document_export",
          canonicalToolName: "document.export",
          validatedArguments: { documentId, revisionId, format, suggestedFileName },
          baseRevisionIds: revisionId ? [revisionId] : [source.document.currentRevisionId],
          affectedResources: [documentId],
          publicSummary: { documentId, displayName: source.document.displayName, format, suggestedFileName },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: ctx.rendererSessionId, toolName: "document.export", outcome: "proposal", resourceIds: [documentId] });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id } };
      }

      case "document.getRevision": {
        const denied = requireCapability("document:read-revision");
        if (denied) return denied;
        const { documentId, revisionId, cursor } = args as { documentId: string; revisionId: string; cursor?: string };
        const result = await services.documents.read(ctx.profileId, documentId, revisionId, cursor);
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: result };
      }

      case "document.restoreRevision": {
        const denied = requireCapability("document:restore-revision");
        if (denied) return denied;
        const { documentId, currentRevisionId, restoreRevisionId, reason } = args as { documentId: string; currentRevisionId: string; restoreRevisionId: string; reason: string };
        const source = await services.documents.getRevisionForSerialization(ctx.profileId, documentId, restoreRevisionId);
        const plan = buildDocumentRestorePlan({ profileId: ctx.profileId, documentId, currentRevisionId, restoreRevisionId, reason });
        const pending = await services.approvals.prepare({
          grantId: `limited:${ctx.profileId}`,
          proposalType: "document_restore",
          canonicalToolName: "document.restoreRevision",
          validatedArguments: { documentId, currentRevisionId, restoreRevisionId, reason },
          baseRevisionIds: [currentRevisionId, restoreRevisionId],
          affectedResources: [documentId],
          publicSummary: { reason, restoreRevisionId, blocks: source.revision.blocks, warnings: source.revision.warnings },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: ctx.rendererSessionId, toolName: "document.restoreRevision", outcome: "proposal", resourceIds: [documentId] });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, preview: { blocks: source.revision.blocks, warnings: source.revision.warnings } } };
      }

      case "document.promoteAttachment": {
        const denied = requireCapability("attachment:promote");
        if (denied) return denied;
        const { projectId, relativePath, attachmentId, mimeType, sizeBytes, displayName } = args as {
          projectId: string;
          relativePath: string;
          attachmentId: string;
          mimeType: string;
          sizeBytes: number;
          displayName?: string;
        };
        if (typeof sizeBytes !== "number" || sizeBytes < 1 || sizeBytes > 1_048_576) {
          return safeToolError(internalName, toolCall.id, "INVALID_ARGUMENTS", "Invalid attachment size.");
        }
        const attachment = services.attachmentRegistry.resolve(ctx.profileId, attachmentId, ctx.rendererSessionId);
        if (!attachment) {
          return safeToolError(toolName, toolCall.id, "INVALID_ARGUMENTS", "Attachment not found or access denied.");
        }
        const result = await services.attachments.promote(ctx.profileId, {
          attachmentId,
          projectId,
          relativePath,
          displayName,
          mimeType,
          bodyB64: attachment.bodyB64,
        });
        await services.audit.record({
          sessionId: ctx.rendererSessionId,
          toolName: "document.promoteAttachment",
          outcome: "execution",
          resourceIds: [result.document.id],
          metadata: { attachmentId, mimeType, sizeBytes, format: result.format, mode: result.mode, bytesRedacted: result.bytesRedacted },
        });
        return {
          ok: true,
          toolName: internalName,
          requestId: toolCall.id,
          data: {
            documentId: result.document.id,
            revisionId: result.revision.id,
            displayName: result.document.displayName,
            format: result.format,
            mode: result.mode,
            bytesReceived: result.bytesReceived,
            bytesRedacted: result.bytesRedacted,
          },
        };
      }

      case "workspace.list": {
        const denied = requireCapability("workspace:list");
        if (denied) return denied;
        const { workspaceId, relativeDirectory, recursive, maxDepth, offset } = args as { workspaceId: string; relativeDirectory: string; recursive: boolean; maxDepth: number; offset?: number };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.list");
        const result = await services.workspaceFiles.list({ grant, sessionId: grant.sessionId, workspaceId, relativeDirectory, recursive, maxDepth: Math.min(Math.max(maxDepth ?? 1, 0), 10), offset });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: result };
      }

      case "workspace.read": {
        const denied = requireCapability("workspace:read");
        if (denied) return denied;
        const { workspaceId, relativePath, mode } = args as { workspaceId: string; relativePath: string; mode?: string };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.read");
        if (mode && mode !== "text") {
          return safeToolError(internalName, toolCall.id, "INVALID_ARGUMENTS", `workspace.read mode ${mode} is not supported yet.`);
        }
        const result = await services.workspaceFiles.readText({ grant, sessionId: grant.sessionId, workspaceId, relativePath });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: result };
      }

      case "workspace.search": {
        const denied = requireCapability("workspace:search");
        if (denied) return denied;
        const { workspaceId, query, maxResults } = args as { workspaceId: string; query: string; maxResults: number };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.search");
        const result = await services.workspaceFiles.search({ grant, sessionId: grant.sessionId, workspaceId, query, maxResults });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: result };
      }

      case "workspace.createFile": {
        const denied = requireCapability("workspace:create-file");
        if (denied) return denied;
        const { workspaceId, relativePath, content } = args as { workspaceId: string; relativePath: string; content: string };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.createFile");
        const change: import("../../../src/agent/contracts/workspace").WorkspaceChange = { type: "create_file", relativePath, expectedAbsent: true, format: "txt", content };
        const { totalBytes, affectedPaths } = await services.workspaceMutations.prepareChangeset({ grant, sessionId: grant.sessionId, changes: [change] });
        const plan = buildWorkspaceChangesetPlan({ profileId: ctx.profileId, grantId: grant.id, agentSessionId: ctx.agentSessionId, workspaceId, summary: `Create file ${relativePath}`, changes: [change] });
        const pending = await services.approvals.prepare({
          grantId: grant.id,
          proposalType: "workspace_changeset",
          canonicalToolName: "workspace.createFile",
          validatedArguments: { workspaceId, relativePath, content },
          baseRevisionIds: [],
          affectedResources: affectedPaths,
          publicSummary: { summary: `Create file ${relativePath}`, totalBytes, changes: [change] },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: grant.sessionId, toolName: "workspace.createFile", outcome: "proposal", resourceIds: affectedPaths });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, affectedPaths } };
      }

      case "workspace.createDirectory": {
        const denied = requireCapability("workspace:create-directory");
        if (denied) return denied;
        const { workspaceId, relativePath } = args as { workspaceId: string; relativePath: string };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.createDirectory");
        const change: import("../../../src/agent/contracts/workspace").WorkspaceChange = { type: "create_directory", relativePath, expectedAbsent: true };
        const { totalBytes, affectedPaths } = await services.workspaceMutations.prepareChangeset({ grant, sessionId: grant.sessionId, changes: [change] });
        const plan = buildWorkspaceChangesetPlan({ profileId: ctx.profileId, grantId: grant.id, agentSessionId: ctx.agentSessionId, workspaceId, summary: `Create directory ${relativePath}`, changes: [change] });
        const pending = await services.approvals.prepare({
          grantId: grant.id,
          proposalType: "workspace_changeset",
          canonicalToolName: "workspace.createDirectory",
          validatedArguments: { workspaceId, relativePath },
          baseRevisionIds: [],
          affectedResources: affectedPaths,
          publicSummary: { summary: `Create directory ${relativePath}`, totalBytes, changes: [change] },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: grant.sessionId, toolName: "workspace.createDirectory", outcome: "proposal", resourceIds: affectedPaths });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, affectedPaths } };
      }

      case "workspace.proposeChangeset": {
        const denied = requireCapability("workspace:propose-update");
        if (denied) return denied;
        const { workspaceId, summary, changes } = args as { workspaceId: string; summary: string; changes: import("../../../src/agent/contracts/workspace").WorkspaceChange[] };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.proposeChangeset");
        const { totalBytes, affectedPaths } = await services.workspaceMutations.prepareChangeset({ grant, sessionId: grant.sessionId, changes });
        const plan = buildWorkspaceChangesetPlan({ profileId: ctx.profileId, grantId: grant.id, agentSessionId: ctx.agentSessionId, workspaceId, summary, changes });
        const pending = await services.approvals.prepare({
          grantId: grant.id,
          proposalType: "workspace_changeset",
          canonicalToolName: "workspace.proposeChangeset",
          validatedArguments: { workspaceId, summary, changes },
          baseRevisionIds: [],
          affectedResources: affectedPaths,
          publicSummary: { summary, totalBytes, changes },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: grant.sessionId, toolName: "workspace.proposeChangeset", outcome: "proposal", resourceIds: affectedPaths });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, affectedPaths } };
      }

      case "workspace.move": {
        const denied = requireCapability("workspace:move");
        if (denied) return denied;
        const { workspaceId, sourcePath, destinationPath } = args as { workspaceId: string; sourcePath: string; destinationPath: string };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.move");
        const plan = buildWorkspaceMovePlan({ profileId: ctx.profileId, grantId: grant.id, agentSessionId: ctx.agentSessionId, workspaceId, sourcePath, destinationPath });
        const pending = await services.approvals.prepare({
          grantId: grant.id,
          proposalType: "workspace_move",
          canonicalToolName: "workspace.move",
          validatedArguments: { workspaceId, sourcePath, destinationPath },
          baseRevisionIds: [],
          affectedResources: [sourcePath, destinationPath],
          publicSummary: { summary: `Move ${sourcePath} to ${destinationPath}`, sourcePath, destinationPath },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: grant.sessionId, toolName: "workspace.move", outcome: "proposal", resourceIds: [sourcePath, destinationPath] });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, sourcePath, destinationPath } };
      }

      case "workspace.trash": {
        const denied = requireCapability("workspace:trash");
        if (denied) return denied;
        const { workspaceId, relativePath } = args as { workspaceId: string; relativePath: string };
        const grant = resolveWorkspaceGrant(workspaceId);
        if (!grant) return safeToolError(internalName, toolCall.id, "CAPABILITY_DENIED", "Valid workspace grant not found for workspace.trash");
        const plan = buildWorkspaceTrashPlan({ profileId: ctx.profileId, grantId: grant.id, agentSessionId: ctx.agentSessionId, workspaceId, relativePath });
        const pending = await services.approvals.prepare({
          grantId: grant.id,
          proposalType: "workspace_trash",
          canonicalToolName: "workspace.trash",
          validatedArguments: { workspaceId, relativePath },
          baseRevisionIds: [],
          affectedResources: [relativePath],
          publicSummary: { summary: `Trash ${relativePath}`, relativePath },
          privateExecutionPlan: plan,
        });
        await services.audit.record({ sessionId: grant.sessionId, toolName: "workspace.trash", outcome: "proposal", resourceIds: [relativePath] });
        return { ok: true, toolName: internalName, requestId: toolCall.id, data: { pendingApprovalId: pending.id, relativePath } };
      }

      default:
        return safeToolError(internalName, toolCall.id, "INVALID_ARGUMENTS", `Tool ${internalName} not supported yet`);
    }
  } catch (error) {
    return safeToolError(internalName, toolCall.id, "INTERNAL_ERROR", sanitizeErrorText(error instanceof Error ? error.message : String(error)));
  }
}

// Phase 5.1 — `media.generateImage` is the only currently enabled media
// tool. It routes through the canonical guarded Venice request pipeline
// (Local Family Safe Mode -> trusted runtime composition -> performVeniceRequest
// -> response screening) instead of raw `fetch`, so every prompt payload is
// preflighted and every response is audited. Other media.* tools are
// not yet wired and surface CAPABILITY_DENIED rather than silently
// miscalling /image/generate.

const ENABLE_RESOLUTION_RE = /^[0-9]{1,5}x[0-9]{1,5}$/;
const MODEL_ID_RE = /^[a-zA-Z0-9_.:-]{1,128}$/;
const PROMPT_MAX_CHARS = 4000;

function detectImageMimeTypeFromBase64(b64: string): "image/png" | "image/jpeg" | "image/webp" | null {
  // The base64 prefixes below fingerprint every common format we accept.
  // persistGeneratedMedia's allowlist is the second line of defence; this
  // first-line sniff rejects unknown / empty payloads before we ever
  // attempt base64-to-byte conversion.
  if (b64.startsWith("iVBORw0KGgo")) return "image/png";
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("UklGR")) return "image/webp";
  return null;
}

export async function executeMediaTool(
  ctx: ToolExecutionContext,
  internalName: string,
  requestId: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  const services = getAgentServices();

  try {
    if (internalName !== "media.generateImage") {
      // Phase 5.2 — video / audio tools are intentionally absent from the
      // canonical tool registry while their durable approval pipeline is
      // pending. Fail closed rather than silently miscalling /image/generate.
      return safeToolError(internalName as any, requestId, "CAPABILITY_DENIED", `Media tool ${internalName} is not enabled in this build.`);
    }

    const prompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
    if (prompt.length === 0) {
      return safeToolError(internalName as any, requestId, "INVALID_ARGUMENTS", "generateImage requires a non-empty prompt.");
    }
    if (prompt.length > PROMPT_MAX_CHARS) {
      return safeToolError(internalName as any, requestId, "INVALID_ARGUMENTS", `generateImage prompt exceeds ${PROMPT_MAX_CHARS} characters.`);
    }
    const requestedModel = typeof args.model === "string" ? args.model.trim() : "";
    if (!MODEL_ID_RE.test(requestedModel)) {
      return safeToolError(internalName as any, requestId, "INVALID_ARGUMENTS", "generateImage requires a string model id.");
    }
    const negativePrompt = typeof args.negativePrompt === "string" ? args.negativePrompt.trim().slice(0, PROMPT_MAX_CHARS) : undefined;
    const aspectRatio = typeof args.aspectRatio === "string" && /^[0-9]+:[0-9]+$/.test(args.aspectRatio) ? args.aspectRatio : undefined;
    let width: number | undefined;
    let height: number | undefined;
    if (typeof args.resolution === "string" && ENABLE_RESOLUTION_RE.test(args.resolution)) {
      const [w, h] = args.resolution.split("x").map((part) => Number.parseInt(part, 10));
      if (Number.isFinite(w) && Number.isFinite(h) && w > 0 && h > 0 && w <= 4096 && h <= 4096) {
        width = w;
        height = h;
      }
    }

    const imagePayload: Record<string, unknown> = {
      model: requestedModel,
      prompt,
      return_binary: false,
    };
    if (negativePrompt) imagePayload.negative_prompt = negativePrompt;
    if (aspectRatio) imagePayload.aspect_ratio = aspectRatio;
    if (width !== undefined && height !== undefined) {
      imagePayload.width = width;
      imagePayload.height = height;
    }

    const startedAt = Date.now();
    let eventId = "";
    try {
      eventId = publishInspectorRequest({
        source: "main-agent",
        transport: "venice",
        endpoint: "/image/generate",
        method: "POST",
      });
    } catch {
      // Telemetry must never break tool execution.
    }
    let guarded: Awaited<ReturnType<typeof performGuardedVeniceRequest>>;
    try {
      guarded = await performGuardedVeniceRequest({
        endpoint: "/image/generate",
        method: "POST",
        body: imagePayload,
        profileId: ctx.profileId,
      });
    } catch (err) {
      try {
        publishInspectorCompletion({
          source: "main-agent",
          transport: "venice",
          endpoint: "/image/generate",
          method: "POST",
          summaries: { durationMs: Date.now() - startedAt, model: requestedModel },
          eventId,
          error: sanitizeErrorText(err instanceof Error ? err.message : String(err)),
        });
      } catch {
        // ignore
      }
      return safeToolError(internalName as any, requestId, "INTERNAL_ERROR", sanitizeErrorText(err instanceof Error ? err.message : String(err)));
    }

    if (guarded.kind === "blocked") {
      const reason = (guarded.block.body as { error?: unknown } | undefined)?.error;
      const reasonText = typeof reason === "string" ? reason : "image-generate request blocked by Family Safe Mode";
      try {
        publishInspectorCompletion({
          source: "main-agent",
          transport: "venice",
          endpoint: "/image/generate",
          method: "POST",
          summaries: { durationMs: Date.now() - startedAt, model: requestedModel },
          eventId,
          status: 451,
          error: sanitizeErrorText(reasonText),
        });
      } catch {
        // ignore
      }
      return safeToolError(internalName as any, requestId, "CAPABILITY_DENIED", sanitizeErrorText(reasonText));
    }
    try {
      publishInspectorCompletion({
        source: "main-agent",
        transport: "venice",
        endpoint: "/image/generate",
        method: "POST",
        summaries: { durationMs: Date.now() - startedAt, model: requestedModel },
        eventId,
        status: guarded.response.ok ? guarded.response.status : 0,
      });
    } catch {
      // ignore
    }
    const response = guarded.response;
    if (!response.ok) {
      return safeToolError(internalName as any, requestId, "INTERNAL_ERROR", sanitizeErrorText(`Image generate returned status ${response.status} ${response.statusText ?? ""}.`));
    }

    const responseBody = (response.body ?? {}) as { images?: unknown };
    const rawImages = Array.isArray(responseBody.images) ? responseBody.images : [];
    if (rawImages.length === 0) {
      return safeToolError(internalName as any, requestId, "INTERNAL_ERROR", "Image generate response did not include any images.");
    }
    const first = rawImages[0] as unknown;
    const b64 = typeof first === "string" ? first : (first && typeof first === "object" && typeof (first as { b64_json?: unknown }).b64_json === "string")
      ? (first as { b64_json: string }).b64_json
      : "";
    if (b64.length === 0) {
      return safeToolError(internalName as any, requestId, "INTERNAL_ERROR", "Image generate response was missing base64 image data.");
    }
    const mimeType = detectImageMimeTypeFromBase64(b64);
    if (!mimeType) {
      return safeToolError(internalName as any, requestId, "INTERNAL_ERROR", "Image generate produced an unsupported image format.");
    }

    const { persistGeneratedMedia } = await import("../../services/generatedMediaStore");
    const buffer = Buffer.from(b64, "base64");
    const persisted = await persistGeneratedMedia(buffer, mimeType);

    await services.audit.record({
      sessionId: ctx.rendererSessionId,
      toolName: "media.generateImage",
      outcome: "execution",
      resourceIds: [persisted.id],
    });

    const createdAt = Date.now();
    // Canonical fields consumed by `chat-agent-runner` to build a
    // `metadata.generatedMedia: ChatMediaReference[]` attachment on the tool
    // message. Keeping the executor output canonical means the chat-store
    // Media Studio upsert path always sees the full ChatMediaReference shape
    // it expects instead of a stub `{ mediaId, mimeType }` object.
    return {
      ok: true,
      toolName: internalName as any,
      requestId,
      data: {
        chatRef: {
          id: persisted.id,
          mediaId: persisted.id,
          mediaType: "image",
          operation: "generate",
          displayUrl: persisted.url,
          thumbnailUrl: persisted.url,
          altText: prompt.slice(0, 200),
          modelId: requestedModel,
          createdAt,
          mimeType: persisted.mimeType,
        },
      },
    };
  } catch (error) {
    return safeToolError(internalName as any, requestId, "INTERNAL_ERROR", sanitizeErrorText(error instanceof Error ? error.message : String(error)));
  }
}
