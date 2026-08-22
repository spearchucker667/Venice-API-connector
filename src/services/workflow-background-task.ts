import { useBackgroundTaskStore } from '../stores/background-task-store'
import { WorkflowExecutionError } from '../lib/workflow-errors'
import { toUserFacingVideoError } from './task-errors'

interface WorkflowVideoTaskInput {
  queueId: string
  model: string
  request: Record<string, unknown>
  queueDownloadUrl?: string
  runId?: string
  nodeId?: string
  signal?: AbortSignal
  /** When provided on Electron, the task was already created + journaled
   *  by `submitPaidQueue` and this function merely monitors it instead of
   *  creating a duplicate task + poller for the same provider queue.
   *  On web this stays undefined — the legacy `registerQueueTask` path
   *  is used. */
  existingTaskId?: string
}

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'aborted', 'timeout'])

/**
 * On Electron the workflow routes video queuing through `submitPaidQueue`,
 * which already creates a durable main-process task and starts main-owned
 * polling.  This function monitors that existing task rather than
 * registering a duplicate.
 *
 * On the web path there is no main process, so a local renderer task is
 * still registered for polling.
 */
export function awaitWorkflowVideoTask(input: WorkflowVideoTaskInput): Promise<string> {
  const taskId = input.existingTaskId
    ? input.existingTaskId
    : (input.runId && input.nodeId ? `workflow-video-${input.runId}-${input.nodeId}` : `workflow-video-${crypto.randomUUID()}`)
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const finish = (callback: () => void) => {
      if (settled) return
      settled = true
      unsubscribe()
      input.signal?.removeEventListener('abort', onAbort)
      callback()
    }
    const inspect = () => {
      const task = useBackgroundTaskStore.getState().tasks[taskId]
      if (!task || !TERMINAL_STATUSES.has(task.status)) return
      if (task.status === 'completed' && task.resultUrl) {
        finish(() => resolve(task.resultUrl!))
        return
      }
      const rawError = task?.error || (task?.status === 'timeout' ? 'Video generation timed out.' : 'Video generation failed.')
      const safeError = toUserFacingVideoError(rawError, 'Video generation failed.')
      finish(() => reject(new WorkflowExecutionError(safeError)))
    }
    const onAbort = () => finish(() => reject(new DOMException('Aborted', 'AbortError')))
    const unsubscribe = useBackgroundTaskStore.subscribe(inspect)
    input.signal?.addEventListener('abort', onAbort, { once: true })

    if (!input.existingTaskId) {
      // Web path: no main process — register a local renderer task.
      useBackgroundTaskStore.getState().registerQueueTask(taskId, 'video', input.queueId, {
        model: input.model,
        request: input.request,
        source: 'workflow',
        ...(input.queueDownloadUrl ? { queueDownloadUrl: input.queueDownloadUrl } : {}),
      })
    }
    inspect()
  })
}
