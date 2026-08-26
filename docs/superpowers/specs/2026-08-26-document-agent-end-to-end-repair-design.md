# Document Agent End-to-End Repair Design

**Date:** 2026-08-26  
**Repository:** Venice Forge  
**Starting SHA:** `3dfad16395951457c1ff788f6bd7e3a234020a97`  
**Scope:** Repair Documents, workspace/folder loading, chat attachments, attachment promotion, Document Agent model-tool execution, approvals, and verification coverage.

## Problem Statement

The Document Agent feature is partially disconnected. Managed-document CRUD and chat attachment ingestion are substantially implemented, but the workspace browser, model workspace tools, approval execution, attachment promotion, and advertised document tools have confirmed end-to-end defects that pass the current static verification suite.

## Staged Implementation Order

1. **Shared workspace contracts** — move `WorkspaceEntry`/`WorkspaceListResult` into `src/agent/contracts/workspace.ts`; propagate through main service, IPC, preload, desktop types, bridge, renderer, and tests.
2. **Lazy workspace directory tree** — replace flat recursive load with paginated, expandable directory browser.
3. **Authoritative `ToolExecutionContext`** — main-process-only context carrying profile, renderer session, Document Agent session, preset, and resolved workspace grant.
4. **Workspace model tool contracts** — remove `grantId` from model-facing schemas; resolve grant from context.
5. **Centralized approval-plan factories** — canonical typed plan builders used by executor and approval handler.
6. **Registry↔executor parity** — implement missing `document.export`, `document.getRevision`, `document.restoreRevision`, `document.promoteAttachment`.
7. **Access presets authoritative** — `AgentPermissionPreset` is the single source of truth; derive `enable_document_tools` from preset.
8. **Attachment ownership/promotion** — profile/session-scoped attachment registry with opaque IDs; wire promotion.
9. **Managed-document regression pass** — re-test all managed-document operations.
10. **End-to-end tests** — reproduce every confirmed defect.
11. **Verification contracts** — replace grep-only claims with runtime/unit-test assertions.
12. **Documentation/roadmap truthfulness** — update `DOCUMENT_AGENT.md`, `ROADMAP.md`, `summary_of_work.md`.

## Key Architecture Decisions

- Model/provider request bodies contain only model-facing arguments; capability authority (`grantId`, `profileId`, session IDs) is injected by trusted main-process code.
- Tool visibility is UX/metadata; the main-process executor enforces preset/capability policy independently.
- Workspace browsing is lazy: root loads non-recursively, directories expand on demand, pagination follows `nextOffset` automatically.
- Approval plans are produced by one canonical factory and validated by the same shape in the approval handler.
- Every `modelCallable: true` registry entry must have a real executor implementation; CI fails on drift.

## Security Invariants

- Absolute workspace paths and capability tokens never reach the model.
- Workspace mutations are approval-gated.
- Attachment promotion resolves bytes through trusted main authority; models supply only opaque IDs.
- Cross-profile attachment lookup is denied.

## Acceptance Criteria

- Workspace directories render as folders and expand; files invoke `workspace.read`.
- Pagination beyond 200 entries works.
- Model workspace tools use the same active grant as the Documents UI.
- All advertised document tools execute without "not supported yet".
- Approval → execution succeeds for every workspace mutation type.
- Preset policy is enforced regardless of tool visibility.
- Full validation suite passes: lint, typecheck, tests, contracts, build.
