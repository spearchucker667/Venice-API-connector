// @vitest-environment node

import { describe, it, expect, vi, beforeEach } from "vitest";
import { executeAgentTool } from "./agent-tool-executor";
import { createToolExecutionContext, contextHasCapability } from "./tool-execution-context";
import { createCanonicalToolDefinitions, type RegisteredTool } from "../../../src/agent/registry/tool-registry";
import type { AssistantToolCall } from "../../../src/types/venice";
import type { WorkspaceGrant } from "../../../src/agent/contracts/capabilities";
import { capabilitiesForPreset } from "../../../src/agent/contracts/capabilities";
import {
  buildDocumentEditPlan,
  buildDocumentExportPlan,
  buildDocumentRestorePlan,
  buildWorkspaceChangesetPlan,
  buildWorkspaceMovePlan,
  buildWorkspaceTrashPlan,
  isDocumentEditPlan,
  isDocumentExportPlan,
  isDocumentRestorePlan,
  isWorkspaceChangesetPlan,
  isWorkspaceMovePlan,
  isWorkspaceTrashPlan,
} from "../approvals/plan-factories";
import type { ToolExecutionContext } from "./tool-execution-context";

const PNG_PIXEL_BASE64 = "iVBORw0KGgo";

const mockDocuments = {
  read: vi.fn().mockResolvedValue({
    documentId: "doc_1",
    revisionId: "rev_1",
    displayName: "test.md",
    format: "md",
    blocks: [],
    nextCursor: null,
    totalBlocks: 0,
    contentHash: "hash",
    warnings: [],
  }),
  create: vi.fn().mockResolvedValue({
    document: {
      id: "doc_1",
      projectId: "proj_1",
      libraryRelativePath: "notes/test.md",
      displayName: "test.md",
      originalFormat: "md",
    },
    revision: { id: "rev_1" },
  }),
  prepareEdits: vi.fn().mockResolvedValue({
    before: [],
    after: [],
    resultingContentHash: "hash",
  }),
  getRevisionForSerialization: vi.fn().mockResolvedValue({
    document: {
      id: "doc_1",
      currentRevisionId: "rev_current",
      displayName: "test.md",
    },
    revision: {
      id: "rev_1",
      blocks: [],
      warnings: [],
    },
  }),
};

const mockApprovals = {
  prepare: vi.fn().mockResolvedValue({ id: "approval_1" }),
};

const mockWorkspaceFiles = {
  list: vi.fn().mockResolvedValue({ entries: [], nextOffset: null }),
  readText: vi.fn().mockResolvedValue({ content: "hello", relativePath: "test.txt" }),
  search: vi.fn().mockResolvedValue([]),
};

const mockWorkspaceMutations = {
  prepareChangeset: vi.fn().mockResolvedValue({ totalBytes: 10, affectedPaths: ["test.txt"] }),
};

const mockAttachmentRegistry = {
  resolve: vi.fn().mockReturnValue({
    id: "att_1",
    profileId: "profile_1",
    sessionId: "runtime_test:renderer_1:agent_agent_1",
    mimeType: "text/plain",
    displayName: "notes.txt",
    sizeBytes: 11,
    bodyB64: Buffer.from("hello world").toString("base64"),
    createdAt: new Date().toISOString(),
  }),
};

const mockAttachments = {
  promote: vi.fn().mockResolvedValue({
    document: { id: "doc_1", displayName: "promoted.txt" },
    revision: { id: "rev_1" },
    format: "txt",
    mode: "text",
    bytesReceived: 11,
    bytesRedacted: 0,
  }),
};

const mockAudit = {
  record: vi.fn().mockResolvedValue(undefined),
};

const performGuardedVeniceRequest = vi.fn();
const persistGeneratedMedia = vi.fn();

vi.mock("./agent-services", () => ({
  getAgentServices: () => ({
    documents: mockDocuments,
    approvals: mockApprovals,
    workspaceFiles: mockWorkspaceFiles,
    workspaceMutations: mockWorkspaceMutations,
    attachmentRegistry: mockAttachmentRegistry,
    attachments: mockAttachments,
    audit: mockAudit,
  }),
}));

vi.mock("../../services/guardPipeline", () => ({
  performGuardedVeniceRequest: (...args: unknown[]) => performGuardedVeniceRequest(...args),
}));

vi.mock("../../services/generatedMediaStore", () => ({
  persistGeneratedMedia: (...args: unknown[]) => persistGeneratedMedia(...args),
}));

vi.mock("../../services/inspectorTelemetry", () => ({
  publishInspectorRequest: vi.fn(() => "evt-tool-1"),
  publishInspectorCompletion: vi.fn(),
}));

function makeWorkspaceGrant(workspaceId: string, sessionId: string): WorkspaceGrant {
  return {
    id: "grant_1",
    sessionId,
    workspaceId,
    rootPath: "/tmp/workspace",
    displayName: "Test Workspace",
    allowedOperations: ["list", "read", "search", "create", "update", "rename", "move", "trash"],
    allowedExtensions: ["txt", "md"],
    maxReadBytes: 1_000_000,
    maxWriteBytes: 1_000_000,
    maxFilesPerOperation: 100,
    maxTotalChangeBytes: 10_000_000,
    includeHiddenFiles: false,
    followSymlinks: false,
    issuedAt: new Date().toISOString(),
  };
}

function makeContext(tool: RegisteredTool): ToolExecutionContext {
  const runtimeSessionId = "runtime_test";
  const senderId = 1;
  const agentSessionId = "agent_1";
  const rendererSessionId = `${runtimeSessionId}:renderer_${senderId}:agent_${agentSessionId}`;
  const isWorkspace = tool.requiredCapabilities.some((capability) => capability.startsWith("workspace:"));

  if (isWorkspace) {
    return createToolExecutionContext({
      profileId: "profile_1",
      runtimeSessionId,
      senderId,
      agentSessionId,
      preset: "workspace_with_approval",
      workspaceGrant: makeWorkspaceGrant("ws_1", rendererSessionId),
    });
  }

  return createToolExecutionContext({
    profileId: "profile_1",
    runtimeSessionId,
    senderId,
    agentSessionId,
    preset: "limited_documents",
  });
}

function makeToolCall(tool: RegisteredTool): AssistantToolCall {
  return {
    id: `call_${tool.internalName}`,
    type: "function",
    function: {
      name: tool.providerName,
      arguments: JSON.stringify(makeValidArgs(tool)),
    },
  };
}

function makeValidArgs(tool: RegisteredTool): Record<string, unknown> {
  switch (tool.internalName) {
    case "document.get":
      return { documentId: "doc_1" };
    case "document.proposeEdits":
      return {
        documentId: "doc_1",
        baseRevisionId: "rev_1",
        summary: "Edit summary",
        operations: [
          {
            operation: "replace_block",
            blockId: "blk_1",
            expectedBlockHash: "hash",
            block: { id: "blk_2", type: "paragraph", text: "Updated text" },
          },
        ],
      };
    case "document.create":
      return {
        projectId: "proj_1",
        relativePath: "notes/test.md",
        format: "md",
        document: { text: "Hello world" },
        overwrite: false,
      };
    case "document.export":
      return { documentId: "doc_1", revisionId: "rev_1", format: "md", suggestedFileName: "test.md" };
    case "document.getRevision":
      return { documentId: "doc_1", revisionId: "rev_1" };
    case "document.restoreRevision":
      return {
        documentId: "doc_1",
        currentRevisionId: "rev_current",
        restoreRevisionId: "rev_1",
        reason: "Restore previous version",
      };
    case "document.promoteAttachment":
      return {
        projectId: "proj_1",
        relativePath: "notes/notes.txt",
        format: "txt",
        attachmentId: "att_1",
        mimeType: "text/plain",
        sizeBytes: 11,
        displayName: "notes.txt",
      };
    case "workspace.list":
      return { workspaceId: "ws_1", relativeDirectory: "", recursive: false, maxDepth: 1 };
    case "workspace.read":
      return { workspaceId: "ws_1", relativePath: "test.txt", mode: "text" };
    case "workspace.search":
      return { workspaceId: "ws_1", query: "hello", maxResults: 10 };
    case "workspace.createFile":
      return { workspaceId: "ws_1", relativePath: "test.txt", content: "hello" };
    case "workspace.createDirectory":
      return { workspaceId: "ws_1", relativePath: "dir" };
    case "workspace.proposeChangeset":
      return {
        workspaceId: "ws_1",
        summary: "Create test file",
        changes: [
          { type: "create_file", relativePath: "test.txt", expectedAbsent: true, format: "txt", content: "hello" },
        ],
      };
    case "workspace.move":
      return { workspaceId: "ws_1", sourcePath: "a.txt", destinationPath: "b.txt" };
    case "workspace.trash":
      return { workspaceId: "ws_1", relativePath: "a.txt" };
    case "media.generateImage":
      return { prompt: "a serene landscape", model: "nano-banana" };
    default:
      return {};
  }
}

describe("Document Agent contracts", () => {
  beforeEach(() => {
    performGuardedVeniceRequest.mockReset();
    persistGeneratedMedia.mockReset();
    mockAudit.record.mockReset();

    performGuardedVeniceRequest.mockResolvedValue({
      kind: "response",
      response: {
        ok: true,
        status: 200,
        statusText: "OK",
        headers: {},
        body: { images: [{ b64_json: PNG_PIXEL_BASE64 }] },
        contentType: "application/json",
      },
    });

    persistGeneratedMedia.mockResolvedValue({
      id: "media_1",
      url: "venice-media://media_1.png",
      mimeType: "image/png",
    });
  });

  describe("A. Tool registry ↔ executor parity", () => {
    it("does not hit the 'not supported yet' fallthrough for any modelCallable tool", async () => {
      const tools = createCanonicalToolDefinitions().filter((tool) => tool.modelCallable === true);
      expect(tools.length).toBeGreaterThan(0);

      for (const tool of tools) {
        const ctx = makeContext(tool);
        const toolCall = makeToolCall(tool);
        const result = await executeAgentTool(ctx, toolCall);

        const isFallthrough =
          !result.ok &&
          result.error.code === "INVALID_ARGUMENTS" &&
          result.error.message.includes("not supported yet");
        expect(isFallthrough, `Tool ${tool.internalName} fell through to default not-supported handler`).toBe(false);
      }
    });
  });

  describe("B. Preset → capabilities mapping", () => {
    it("off has no capabilities", () => {
      expect(capabilitiesForPreset("off")).toEqual([]);
    });

    it("read_attachments has only attachment:read", () => {
      expect(capabilitiesForPreset("read_attachments")).toEqual(["attachment:read"]);
    });

    it("limited_documents has document/attachment capabilities but no workspace:*", () => {
      const caps = capabilitiesForPreset("limited_documents");
      expect(caps).toContain("document:read");
      expect(caps).toContain("attachment:read");
      expect(caps.some((c) => c.startsWith("workspace:"))).toBe(false);
    });

    it("workspace_with_approval includes all workspace capabilities", () => {
      const caps = capabilitiesForPreset("workspace_with_approval");
      expect(caps).toContain("workspace:list");
      expect(caps).toContain("workspace:read");
      expect(caps).toContain("workspace:search");
      expect(caps).toContain("workspace:create-file");
      expect(caps).toContain("workspace:create-directory");
      expect(caps).toContain("workspace:propose-update");
      expect(caps).toContain("workspace:move");
      expect(caps).toContain("workspace:trash");
    });
  });

  describe("C. ToolExecutionContext authority", () => {
    it("builds a context whose rendererSessionId and capability grant match the preset", () => {
      const ctx = createToolExecutionContext({
        profileId: "profile_1",
        runtimeSessionId: "runtime_test",
        senderId: 42,
        agentSessionId: "agent_session_xyz",
        preset: "workspace_with_approval",
      });

      expect(ctx.rendererSessionId).toContain("runtime_test");
      expect(ctx.rendererSessionId).toContain("renderer_42");
      expect(ctx.rendererSessionId).toContain("agent_agent_session_xyz");
      expect(ctx.capabilityGrant.preset).toBe("workspace_with_approval");
      expect(ctx.capabilityGrant.capabilities).toEqual(capabilitiesForPreset("workspace_with_approval"));
      expect(contextHasCapability(ctx, "workspace:read")).toBe(true);
      expect(contextHasCapability(ctx, "media:generate-image")).toBe(false);
    });
  });

  describe("D. Approval plan factories", () => {
    it("buildDocumentEditPlan contains required identity fields and isDocumentEditPlan returns true", () => {
      const plan = buildDocumentEditPlan({
        profileId: "profile_1",
        documentId: "doc_1",
        baseRevisionId: "rev_1",
        summary: "Edit summary",
        operations: [
          {
            operation: "replace_block",
            blockId: "blk_1",
            expectedBlockHash: "hash",
            block: { id: "blk_2", type: "paragraph", text: "Updated" },
          },
        ],
      });
      expect(plan.kind).toBe("document_edit");
      expect(plan.profileId).toBe("profile_1");
      expect(plan.documentId).toBe("doc_1");
      expect(plan.baseRevisionId).toBe("rev_1");
      expect(plan.summary).toBe("Edit summary");
      expect(Array.isArray(plan.operations)).toBe(true);
      expect(isDocumentEditPlan(plan)).toBe(true);
    });

    it("buildDocumentRestorePlan contains required identity fields and isDocumentRestorePlan returns true", () => {
      const plan = buildDocumentRestorePlan({
        profileId: "profile_1",
        documentId: "doc_1",
        currentRevisionId: "rev_current",
        restoreRevisionId: "rev_1",
        reason: "Restore",
      });
      expect(plan.kind).toBe("document_restore");
      expect(plan.profileId).toBe("profile_1");
      expect(plan.documentId).toBe("doc_1");
      expect(plan.currentRevisionId).toBe("rev_current");
      expect(plan.restoreRevisionId).toBe("rev_1");
      expect(plan.reason).toBe("Restore");
      expect(isDocumentRestorePlan(plan)).toBe(true);
    });

    it("buildDocumentExportPlan contains required identity fields and isDocumentExportPlan returns true", () => {
      const plan = buildDocumentExportPlan({
        profileId: "profile_1",
        documentId: "doc_1",
        revisionId: "rev_1",
        format: "md",
        suggestedFileName: "test.md",
      });
      expect(plan.kind).toBe("document_export");
      expect(plan.profileId).toBe("profile_1");
      expect(plan.documentId).toBe("doc_1");
      expect(plan.revisionId).toBe("rev_1");
      expect(plan.format).toBe("md");
      expect(plan.suggestedFileName).toBe("test.md");
      expect(isDocumentExportPlan(plan)).toBe(true);
    });

    it("buildWorkspaceChangesetPlan contains required identity fields and isWorkspaceChangesetPlan returns true", () => {
      const plan = buildWorkspaceChangesetPlan({
        profileId: "profile_1",
        grantId: "grant_1",
        agentSessionId: "agent_1",
        workspaceId: "ws_1",
        summary: "Create file",
        changes: [
          { type: "create_file", relativePath: "test.txt", expectedAbsent: true, format: "txt", content: "hello" },
        ],
      });
      expect(plan.kind).toBe("workspace_changeset");
      expect(plan.profileId).toBe("profile_1");
      expect(plan.grantId).toBe("grant_1");
      expect(plan.agentSessionId).toBe("agent_1");
      expect(plan.workspaceId).toBe("ws_1");
      expect(plan.summary).toBe("Create file");
      expect(Array.isArray(plan.changes)).toBe(true);
      expect(isWorkspaceChangesetPlan(plan)).toBe(true);
    });

    it("buildWorkspaceMovePlan contains required identity fields and isWorkspaceMovePlan returns true", () => {
      const plan = buildWorkspaceMovePlan({
        profileId: "profile_1",
        grantId: "grant_1",
        agentSessionId: "agent_1",
        workspaceId: "ws_1",
        sourcePath: "a.txt",
        destinationPath: "b.txt",
      });
      expect(plan.kind).toBe("workspace_move");
      expect(plan.profileId).toBe("profile_1");
      expect(plan.grantId).toBe("grant_1");
      expect(plan.workspaceId).toBe("ws_1");
      expect(plan.sourcePath).toBe("a.txt");
      expect(plan.destinationPath).toBe("b.txt");
      expect(isWorkspaceMovePlan(plan)).toBe(true);
    });

    it("buildWorkspaceTrashPlan contains required identity fields and isWorkspaceTrashPlan returns true", () => {
      const plan = buildWorkspaceTrashPlan({
        profileId: "profile_1",
        grantId: "grant_1",
        agentSessionId: "agent_1",
        workspaceId: "ws_1",
        relativePath: "a.txt",
      });
      expect(plan.kind).toBe("workspace_trash");
      expect(plan.profileId).toBe("profile_1");
      expect(plan.grantId).toBe("grant_1");
      expect(plan.workspaceId).toBe("ws_1");
      expect(plan.relativePath).toBe("a.txt");
      expect(isWorkspaceTrashPlan(plan)).toBe(true);
    });
  });
});
