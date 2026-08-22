import { useMutation } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import { isElectron } from '../services/desktopBridge'
import { veniceFetch } from '../services/veniceClient/fetch'
import type { VideoQueueRequest, VideoQueueResponse } from '../types/venice'
import { useBackgroundTaskStore } from '../stores/background-task-store'
import { toUserFacingVideoError } from '../services/task-errors'

/** 120 s matches the main-process generation timeout and original specification. */
const QUEUE_TIMEOUT_MS = 120_000

export function useVideo() {
  const activeVideoTask = useBackgroundTaskStore(s => {
    const tasks = Object.values(s.tasks).filter(t => t.type === 'video')
    const running = tasks.find(t => !['completed', 'failed', 'aborted', 'timeout'].includes(t.status))
    if (running) return running
    return tasks.sort((a, b) => b.createdAt - a.createdAt)[0] || null
  })

  const [localTaskId, setLocalTaskId] = useState<string | null>(null)
  const [queueSchemaError, setQueueSchemaError] = useState<string | null>(null)
  const taskId = localTaskId || activeVideoTask?.id
  const task = useBackgroundTaskStore(s => taskId ? s.tasks[taskId] : null)

  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!task) {
      setElapsedMs(0)
      return
    }
    if (['completed', 'failed', 'aborted', 'timeout'].includes(task.status)) {
      setElapsedMs(Math.max(0, task.updatedAt - task.createdAt))
      return
    }
    const interval = setInterval(() => {
      setElapsedMs(Math.max(0, Date.now() - task.createdAt))
    }, 1000)
    setElapsedMs(Math.max(0, Date.now() - task.createdAt))
    return () => clearInterval(interval)
  }, [task])

  const queueMutation = useMutation({
    mutationFn: async (req: VideoQueueRequest) => {
      // On Electron: use the main-process paid-queue primitive — atomically journals
      // the task before dispatching to the provider, closing the crash-window where
      // the provider accepts a billable generation but the app exits before
      // registering the task locally.
      if (isElectron()) {
        const { desktopBackgroundTask } = await import('../services/desktopBridge')
        const submitRes = await desktopBackgroundTask.submitPaidQueue({
          operation: 'video',
          wirePayload: req as unknown as Record<string, unknown>,
        })
        if (!submitRes.ok) {
          throw new Error(submitRes.error || 'Video queue submission failed.')
        }
        if (!submitRes.task) {
          throw new Error('Video queue submission did not return a task.')
        }
        return { task: submitRes.task, isElectronPath: true as const }
      }

      // Web path: direct fetch (no main-process IPC available)
      const result = await veniceFetch<VideoQueueResponse>('/video/queue', {
        method: 'POST',
        body: req,
        timeoutMs: QUEUE_TIMEOUT_MS,
        retry: false,
      })
      return { data: result.data, req, isElectronPath: false as const }
    },
    onSuccess: (result) => {
      if (result.isElectronPath) {
        // Task is already journaled by the main process; just track its ID locally.
        setLocalTaskId(result.task.id)
        setQueueSchemaError(null)
        return
      }
      const { data, req } = result
      const qid = (data.queue_id || data.id || '').trim()
      if (!qid) {
        setQueueSchemaError('Video queue response did not include a queue ID.')
        return
      }
      setQueueSchemaError(null)
      const newTaskId = `video-${crypto.randomUUID()}`
      setLocalTaskId(newTaskId)
      const { image_url: _imageUrl, end_image_url: _endImageUrl, audio_url: _audioUrl, video_url: _videoUrl, reference_image_urls: _referenceImages, scene_image_urls: _sceneImages, ...requestSummary } = req
      useBackgroundTaskStore.getState().registerQueueTask(newTaskId, 'video', qid, {
        model: data.model || req.model,
        request: requestSummary,
        ...(req.duration ? { requestedDuration: req.duration } : {}),
        ...(req.resolution ? { requestedResolution: req.resolution } : {}),
        ...(req.aspect_ratio ? { requestedAspectRatio: req.aspect_ratio } : {}),
        ...(data.download_url ? { queueDownloadUrl: data.download_url } : {}),
      })
    },
  })

  const cancel = useCallback(() => {
    if (taskId) {
      useBackgroundTaskStore.getState().cancelTask(taskId)
    }
  }, [taskId])

  const reset = useCallback(() => {
    if (taskId) {
      useBackgroundTaskStore.getState().clearTask(taskId)
    }
    setLocalTaskId(null)
  }, [taskId])

  return {
    progress: task?.progress ?? null,
    queue: queueMutation.mutate,
    isQueueing: queueMutation.isPending,
    status: task ? task.status : 'idle',
    stage: task?.stage ?? null,
    videoUrl: task?.resultUrl ?? null,
    error: task?.error ?? queueSchemaError ?? (queueMutation.isError ? toUserFacingVideoError(queueMutation.error, 'Unable to queue video generation.') : null),
    elapsedMs,
    cancel,
    reset,
    queueId: task?.queueId ?? null,
    resultMediaId: task?.resultMediaId ?? null,
    lastRequest: (task?.metadata?.request as VideoQueueRequest | undefined) ?? (task ? {
      model: String(task.metadata?.model ?? task.modelId ?? ''),
      prompt: '',
      ...(typeof task.metadata?.requestedDuration === 'string' ? { duration: task.metadata.requestedDuration } : {}),
      ...(typeof task.metadata?.requestedResolution === 'string' ? { resolution: task.metadata.requestedResolution } : {}),
      ...(typeof task.metadata?.requestedAspectRatio === 'string' ? { aspect_ratio: task.metadata.requestedAspectRatio } : {}),
    } : null),
  }
}
