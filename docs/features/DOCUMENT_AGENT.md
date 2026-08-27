# Document Agent

Document Agent is Venice Forge's local-first, main-process-authoritative document workspace. It separates app-managed documents from explicitly granted workspace access and never grants shell, Git, network, keychain, database, or operating-system control.

## Access modes

Access is expressed through a single `AgentPermissionPreset` defined in `src/agent/contracts/capabilities.ts`. The preset is enforced in the main process and never derived from renderer state.

- **`off`** — Exposes no document or workspace tools.
- **`read_attachments`** — Only `attachment:read`. Files must be explicitly attached to the active conversation; no managed documents or workspace access.
- **`limited_documents`** — Safe default. Adds attachment promotion and bounded managed-document operations: read, non-overwriting create, edit proposals, revision read/restore, and user-mediated export. No workspace access.
- **`workspace_with_approval`** — Adds a single granted workspace with bounded read/list/search and mutation tools. Every workspace mutation is staged as an approval and requires explicit user confirmation. The workspace grant is per-session, chosen through a native directory picker, limited to supported extensions, and not persisted across app restart.
- **`workspace_autonomous`** — *Deprecated / reserved for a future design.* This value remains in the `AgentPermissionPreset` type for backward compatibility with persisted state, but it is **not** in the supported public preset set. Main-process validation rejects it via `VALID_PRESETS`. The current implementation treats every workspace mutation as approval-required regardless of preset; an "autonomous" mode that bypasses approval is a future design that requires its own threat-model review before it can be enabled.

`capabilitiesForPreset()` in `src/agent/contracts/capabilities.ts` is the authoritative mapping from preset to capabilities. `ToolRegistry.getProviderSchemas()` and `resolveAvailableTools()` in `src/agent/registry/tool-registry.ts` filter the canonical tool definitions by these capabilities; tool visibility in the model request is UX only, because the executor re-enforces the same preset independently.

## Tool execution context

`electron/agent/runtime/tool-execution-context.ts` defines `ToolExecutionContext`, the main-process-only authority object for every agent tool call. It is constructed after IPC sender validation and contains:

- `profileId` — active authenticated profile.
- `runtimeSessionId` — long-lived main-process runtime session.
- `rendererSessionId` — scoped to the renderer sender and optional Document Agent session.
- `agentSessionId` — optional Document Agent session supplied by the renderer.
- `preset` — effective `AgentPermissionPreset`.
- `capabilityGrant` — derived grant with the resolved capability list.
- `workspaceGrant` — resolved workspace grant for this session, if any.

Model-facing tool schemas contain only model-facing arguments such as `documentId`, `relativePath`, or `workspaceId`. Capability tokens, `grantId`, `profileId`, session IDs, and absolute paths are injected by trusted main-process code. The executor (`electron/agent/runtime/agent-tool-executor.ts`) resolves the workspace grant from `ToolExecutionContext` and rejects any tool whose required capability is absent from the active preset.

## Supported tools

Canonical tool definitions live in `src/agent/registry/tool-registry.ts` and are mapped to provider-facing names through `src/agent/registry/tool-name-map.ts`.

### Document tools

| Internal name | Capability | Approval | Implemented |
|---|---|---|---|
| `document.get` | `document:read` | never | Yes |
| `document.create` | `document:create` | never | Yes |
| `document.proposeEdits` | `document:propose-update` | always | Yes |
| `document.export` | `document:export` | always | Yes |
| `document.getRevision` | `document:read-revision` | never | Yes |
| `document.restoreRevision` | `document:restore-revision` | always | Yes |
| `document.promoteAttachment` | `attachment:promote` | never | Yes |

### Workspace tools

| Internal name | Capability | Approval | Implemented |
|---|---|---|---|
| `workspace.list` | `workspace:list` | never | Yes |
| `workspace.read` | `workspace:read` | never | Yes |
| `workspace.search` | `workspace:search` | never | Yes |
| `workspace.createFile` | `workspace:create-file` | policy | Yes |
| `workspace.createDirectory` | `workspace:create-directory` | policy | Yes |
| `workspace.proposeChangeset` | `workspace:propose-update` | policy | Yes |
| `workspace.move` | `workspace:move` | always | Yes |
| `workspace.trash` | `workspace:trash` | always | Yes |

`media.generateImage` is the only currently enabled media tool and is gated separately by model function-calling support; other `media.*` tools are intentionally absent until their durable approval pipeline lands.

## Shared workspace contract

The workspace contract is declared in `src/agent/contracts/workspace.ts`:

- `WorkspaceEntry` carries `relativePath`, `kind: "file" | "directory"`, `sizeBytes`, and `modifiedAt`.
- `WorkspaceListResult` returns `entries` and `nextOffset`; a `null` `nextOffset` marks the end of the directory page.
- `WorkspaceChange` and `WorkspaceChangeProposal` type the bounded changeset operations used for approval-staged mutations.
- `WorkspaceSearchResult` types bounded text search matches.

`kind` distinguishes files from directories so the renderer can build an expandable tree without inspecting path strings. The main-process workspace service (`electron/agent/workspace/workspace-filesystem-service.ts`) enforces `followSymlinks: false`, extension allowlists, hidden/dependency/VCS directory exclusion, and bounded reads/searches.

## Lazy directory tree

`src/components/documents/WorkspaceTree.tsx` renders the granted workspace as a lazy, paginated tree:

- The root directory loads non-recursively on mount.
- Each directory node starts collapsed and loads its children only when expanded.
- Listing calls use `recursive: false` and `maxDepth: 1` so large directories do not block the UI.
- Pagination follows `nextOffset` automatically until `nextOffset === null` or a safety cap is reached.
- Files are selectable; selecting a file invokes the renderer's file-read handler.

## Approval integrity

An edit proposal is prepared without writing. Its SHA-256 hash covers the canonical tool name, validated arguments, base revisions, affected resources, grant, and public preview. The renderer submits the displayed proposal ID and hash. Main consumes an approval once, rejects replay or mismatch, verifies the active profile and current revision, then appends a new immutable revision. Persisted approvals from an earlier app runtime cannot execute automatically.

The approval boundary is strict:

- `document.proposeEdits`, `document.export`, and `document.restoreRevision` always require user approval.
- Every workspace mutation — `workspace.createFile`, `workspace.createDirectory`, `workspace.proposeChangeset`, `workspace.move`, and `workspace.trash` — is staged as an approval plan and only applied after an explicit user decision through `documentAgent:approvals:decide`.

Plan factories in `electron/agent/approvals/plan-factories.ts` produce the typed private execution plans used by both the executor and the approval handler, ensuring the approved payload matches the proposed payload.

## Managed storage and revisions

Managed document metadata and revisions live beneath Electron `userData`, partitioned by the authenticated profile. The renderer receives opaque IDs, relative library paths, bounded blocks, and opaque cursors—not storage paths. New documents use `overwrite: false`. Edits and restoration append revisions; restoration never moves the current pointer backward or deletes later history.

Supported normalized block types are headings, paragraphs, lists, tables, code, quotes, managed-image references, and page breaks. The current lightweight editor directly edits a single paragraph; complex documents remain readable, exportable, and available to structured tool operations.

## Formats

The application serializes TXT, Markdown, JSON, CSV, HTML, DOCX, and PDF. Models cannot submit binary DOCX or PDF bytes.

- JSON must be representable by `JSON.stringify` and uses deterministic indentation.
- CSV rows must match the declared column width. Cells beginning with `=`, `+`, `-`, or `@` are prefixed to prevent spreadsheet formula injection.
- HTML is generated from escaped normalized blocks with a restrictive embedded CSP. Active content is never copied through.
- DOCX bytes are generated with the `docx` library.
- PDF bytes are generated with `pdf-lib` as a reflowed derivative; this is not arbitrary in-place PDF editing or secure visual redaction.

## Workspace security

Workspace paths must be relative and no longer than 500 characters. Main rejects POSIX and Windows absolute paths, UNC/device/URI paths, home shortcuts, null bytes, encoded traversal, dot segments, alternate data streams, reserved Windows device names, invalid trailing characters, symlinks, and special files. Existing targets and nearest existing parents are resolved through `realpath` and checked by path components, not string prefixes.

Listing and search are bounded, extension-limited, hidden/dependency/VCS directories are excluded by default, binary files are skipped, and search is implemented in-process without shell commands or subprocesses. File creation uses exclusive creation. Prepared changesets verify expected hashes, stage outputs in the destination directory, retain app-managed backups, commit deterministically, and attempt rollback on failure.

High-level Node path checks cannot eliminate every filesystem time-of-check/time-of-use race on every platform. Main revalidates immediately before operations and uses no-follow file descriptors for bounded reads, but packaged-platform review remains required before enabling broader autonomous mutations.

## Export and privacy

Export always opens a native save dialog from a validated main-frame sender. The model never selects or receives the absolute destination. Main serializes, validates, writes a same-directory temporary file, flushes it, and renames it into place. The result includes only display name, format, byte count, and warnings.

Document Agent audit records are append-only, hash chained, and contain event metadata only. Bodies, raw model arguments, API keys, bearer tokens, signed data, and absolute paths are excluded or redacted.

## Attachments and promotion

Chat and Document Agent share `electron/agent/attachments/attachment-registry.ts`. Attachments are profile/session-scoped, identified by opaque IDs, and capped at 1 MiB. The model receives only the opaque `attachmentId`; base64 bodies and local paths are resolved by main.

`document.promoteAttachment` (granted in `limited_documents` and above; never in `off` or `read_attachments`) lets a chat attachment become a managed document. The renderer can either supply `bodyB64` directly or let main resolve the registered attachment by ID. Bodies are base64-decoded in main, capped at 1 MiB, classified against a MIME allow-list with an HTML blocklist, and non-overwriting. Text-bearing MIME types redact secrets through the canonical redaction pipeline before being split into bounded paragraph blocks; binary MIME types emit a deterministic placeholder block set with `contentKind: "binary"` metadata and the bytes are not retained.

Every promotion records an audit event (`toolName: "document.promoteAttachment"`, `outcome: "execution"`, `resourceIds: [<document id>]`, `metadata: { attachmentId, mimeType, sizeBytes, format, mode, bytesRedacted }`) and propagates `createdBy: "import"` through `ManagedDocumentService.create()` so the revision lineage remains auditable.

## Validation

The regression sequence `VERIFY-145` through `VERIFY-154` covers the registry and revisions, one-time approvals, hostile path handling, all serializers, bounded workspace operations, the typed preload/main boundary, native export, audit chaining, redaction, and attachment-to-managed-document promotion. Run:

```bash
npx vitest run src/agent electron/agent electron/ipc/handlers.test.ts src/config/tabs.test.ts src/App.navigation.test.ts src/components/layout/sidebar.test.tsx --no-file-parallelism
npm run lint:eslint
npm run typecheck
```

## What is implemented vs. what remains

**Implemented and locally regression-tested:**

- Shared workspace contracts with `kind: "file" | "directory"` (`src/agent/contracts/workspace.ts`).
- Lazy, paginated workspace directory tree (`src/components/documents/WorkspaceTree.tsx`).
- Main-process-only `ToolExecutionContext` with profile/session/preset/grant authority (`electron/agent/runtime/tool-execution-context.ts`).
- `AgentPermissionPreset` semantics and capability derivation (`src/agent/contracts/capabilities.ts`).
- Attachment registry with opaque IDs and profile/session ownership (`electron/agent/attachments/attachment-registry.ts`).
- Attachment promotion to managed document (`document.promoteAttachment`).
- Approval-gated document edit/export/restore and all workspace mutations.
- Supported document and workspace tool definitions and executor implementations (`src/agent/registry/tool-registry.ts`, `electron/agent/runtime/agent-tool-executor.ts`).

**Still requires manual acceptance before the roadmap item can close:**

- Headed end-to-end Document Agent workflow in `npm run dev:electron` (managed-document create/read/edit/export, attachment promotion, workspace grant, lazy tree expansion, file read, approval → execution for each mutation type).
- Packaged cross-platform smoke of the Documents tab and workspace picker.
- Crash-journal recovery for in-flight approvals and workspace operations.
- Fuzzed/isolated parsing of complex DOCX/PDF source blobs.
- Full Chat/Workflow/Project agent-loop integration beyond the current executor surface.

The historical implementation and acceptance specification is retained at [`docs/audits/Records/Function_calling_todo.md`](../audits/Records/Function_calling_todo.md). The repository reconciliation report is [`docs/discovery/DISCOVERY_DOCUMENT_AGENT.md`](../discovery/DISCOVERY_DOCUMENT_AGENT.md).
