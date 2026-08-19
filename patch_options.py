import re

with open('src/lib/workflow-engine.ts', 'r') as f:
    content = f.read()

content = content.replace(
"""export interface ExecuteOptions {
  signal?: AbortSignal
  /** When true, the engine will refuse to start — the caller must guard
   *  against concurrent runs.  This is an engine-level invariant, not a
   *  UI-only check. */
  isRunning?: boolean
  onUpdate?: (nodeId: string, result: Partial<NodeResult>) => void
}""",
"""export interface ExecuteOptions {
  signal?: AbortSignal
  /** When true, the engine will refuse to start — the caller must guard
   *  against concurrent runs.  This is an engine-level invariant, not a
   *  UI-only check. */
  isRunning?: boolean
  runId?: string
  onUpdate?: (nodeId: string, result: Partial<NodeResult>) => void
}"""
)

content = content.replace(
"""  if (isRunning) {
    throw new WorkflowExecutionError('Workflow is already running.')
  }

  const _runId = crypto.randomUUID()""",
"""  if (isRunning) {
    throw new WorkflowExecutionError('Workflow is already running.')
  }

  const _runId = opts.runId || crypto.randomUUID()"""
)

with open('src/lib/workflow-engine.ts', 'w') as f:
    f.write(content)
