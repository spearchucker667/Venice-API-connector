#!/usr/bin/env node

const fs = require('node:fs')
const path = require('node:path')
const { spawnSync } = require('node:child_process')

const failures = []
const read = (file) => fs.readFileSync(file, 'utf8')
const requireText = (file, text, label) => {
  if (!read(file).includes(text)) failures.push(`${label}: ${file} must contain ${text}`)
}

requireText('src/agent/registry/tool-name-map.ts', 'workspace_trash', 'VERIFY-145 canonical registry')
requireText('electron/agent/approvals/approval-coordinator.ts', 'proposalHash', 'VERIFY-146 exact approval')
requireText('electron/agent/workspace/path-policy.ts', 'SYMLINK_ESCAPE', 'VERIFY-147 path containment')
requireText('electron/agent/documents/document-serializer-service.ts', 'Packer.toBuffer', 'VERIFY-148 DOCX application serializer')
requireText('electron/agent/documents/document-serializer-service.ts', 'PDFDocument.create', 'VERIFY-148 PDF application serializer')
requireText('electron/agent/workspace/workspace-filesystem-service.ts', 'readRegularFileBounded', 'VERIFY-149 bounded workspace read')
requireText('electron/ipc/handlers/documentAgentHandlers.ts', 'dialog.showSaveDialog', 'VERIFY-151 native export dialog')
requireText('electron/ipc/handlers/documentAgentHandlers.ts', 'atomicExternalWrite', 'VERIFY-151 atomic export')
requireText('electron/agent/audit/document-agent-audit-service.ts', 'previousHash', 'VERIFY-152 hash-chained audit')
requireText('electron/agent/audit/document-agent-audit-service.ts', '[REDACTED_PATH]', 'VERIFY-153 audit path redaction')
requireText('electron/preload.ts', 'documentAgent:', 'VERIFY-150 narrow preload')
requireText('src/agent/contracts/workspace.ts', 'export interface WorkspaceEntry', 'VERIFY-154 workspace entry contract')
requireText('src/agent/contracts/workspace.ts', 'export interface WorkspaceListResult', 'VERIFY-155 workspace list result contract')
requireText('electron/agent/workspace/workspace-filesystem-service.ts', 'WorkspaceListResult', 'VERIFY-156 workspace filesystem uses list result')
requireText('src/components/documents/WorkspaceTree.tsx', 'kind === "directory"', 'VERIFY-157 workspace tree uses kind directory')
requireText('electron/agent/runtime/agent-tool-executor.ts', 'buildWorkspaceChangesetPlan', 'VERIFY-158 changeset plan factory')
requireText('electron/agent/runtime/agent-tool-executor.ts', 'buildWorkspaceMovePlan', 'VERIFY-158 move plan factory')
requireText('electron/agent/runtime/agent-tool-executor.ts', 'buildWorkspaceTrashPlan', 'VERIFY-158 trash plan factory')

const handlers = read('electron/ipc/handlers/documentAgentHandlers.ts')
if (/return \{[^}]*filePath:/s.test(handlers)) failures.push('VERIFY-151 document export must not return the selected absolute filePath')
if (!handlers.includes('displayName: path.basename(selected.filePath)')) failures.push('VERIFY-151 export must return only a display name')

if (failures.length) {
  console.error('[verify:document-agent] FAIL')
  failures.forEach((failure) => console.error(`- ${failure}`))
  process.exit(1)
}

const repoRoot = path.resolve(__dirname, '..')
const runtime = spawnSync(
  'npx',
  [
    'vitest', 'run',
    'electron/agent/runtime/document-agent-contracts.test.ts',
    'electron/agent/attachments/attachment-registry.test.ts',
    'src/components/documents/WorkspaceTree.test.tsx',
    '--reporter=dot',
  ],
  { cwd: repoRoot, encoding: 'utf8' }
)

if (runtime.status !== 0) {
  console.error('[verify:document-agent] FAIL — runtime contract tests failed')
  if (runtime.stdout) console.error(runtime.stdout)
  if (runtime.stderr) console.error(runtime.stderr)
  process.exit(1)
}

console.log('[verify:document-agent] PASS — registry, approvals, paths, serializers, IPC, export, audit, and redaction contracts are present')
