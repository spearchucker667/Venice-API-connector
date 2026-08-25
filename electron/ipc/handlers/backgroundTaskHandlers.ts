/** @fileoverview Background task IPC handlers. Bridges the persistent
 *  main-process task manager to the renderer process.
 */

import { type WebContents } from "electron";
import { registerPrivilegedIpcChannel } from "./common";
import type { BackgroundTaskCreateInput, BackgroundTaskIpcEnvelope, BackgroundTaskUpdate } from "../../../src/types/background-task";
import { isValidTaskType, isValidTaskStatus, isValidVideoTaskStage } from "../../../src/types/background-task";
import {
  initBackgroundTaskManager,
  createBackgroundTaskInMain,
  updateBackgroundTaskInMain,
  cancelBackgroundTaskInMain,
  retryBackgroundTaskInMain,
  clearBackgroundTaskInMain,
  submitPaidQueueTaskInMain,
  getBackgroundTask,
  listBackgroundTasks,
  subscribeToBackgroundTasks,
} from "../../services/backgroundTaskManager";
import { redactErrorMessage } from "../../../src/shared/redaction";
import { safeSendToRenderer } from "./common";
import { getProfileSessionId } from "../../services/profileSession";

const subscribers = new Set<WebContents>();

function broadcast(envelope: BackgroundTaskIpcEnvelope, profileId: string): void {
  for (const webContents of subscribers) {
    if (webContents.isDestroyed()) {
      subscribers.delete(webContents);
      continue;
    }
    if (getProfileSessionId(webContents) !== profileId) continue;
    safeSendToRenderer(webContents, "backgroundTask:update", envelope);
  }
}

function sendSnapshot(webContents: WebContents): void {
  if (webContents.isDestroyed()) return;
  safeSendToRenderer(webContents, "backgroundTask:update", {
    kind: "snapshot",
    tasks: listBackgroundTasks().filter((task) => task.profileId === getProfileSessionId(webContents)),
  } as BackgroundTaskIpcEnvelope);
}

let listenerRegistered = false;

export function __resetBackgroundTaskHandlersForTests(): void {
  subscribers.clear();
  listenerRegistered = false;
}

function registerBroadcastListener(): void {
  if (listenerRegistered) return;
  listenerRegistered = true;
  subscribeToBackgroundTasks((taskId, task, kind, profileId) => {
    if (kind === 'removed') {
      broadcast({ kind: "removed", taskId }, profileId);
    } else if (task) {
      broadcast({ kind, taskId, tasks: [task] }, profileId);
    }
  });
}

function isTaskOwnedBySender(sender: WebContents, taskId: string): boolean {
  const task = getBackgroundTask(taskId);
  return task !== null && task.profileId === getProfileSessionId(sender);
}

function taskNotFound(): { ok: false; error: string } {
  return { ok: false, error: "Background task not found." };
}

export function registerBackgroundTaskHandlers(): void {
  registerBroadcastListener();

  registerPrivilegedIpcChannel("backgroundTask:subscribe", async (event) => {
    try {
      await initBackgroundTaskManager();
      subscribers.add(event.sender);
      sendSnapshot(event.sender);
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:unsubscribe", async (event) => {
    subscribers.delete(event.sender);
    return { ok: true };
  });

  registerPrivilegedIpcChannel("backgroundTask:create", async (event, input: unknown) => {
    try {
      await initBackgroundTaskManager();
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Invalid task input." };
      }
      const createInput = input as BackgroundTaskCreateInput;
      if (!isValidTaskType(createInput.type)) {
        return { ok: false, error: "Invalid task type." };
      }
      if (createInput.id && (typeof createInput.id !== 'string' || createInput.id.length > 128)) {
        return { ok: false, error: "Invalid task ID." };
      }
      if (createInput.queueId && typeof createInput.queueId !== 'string') {
        return { ok: false, error: "Invalid queue ID." };
      }
      const task = await createBackgroundTaskInMain({
        ...createInput,
        profileId: getProfileSessionId(event.sender),
      });
      return { ok: true, task };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:update", async (event, input: unknown) => {
    try {
      await initBackgroundTaskManager();
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Invalid update input." };
      }
      const { taskId, updates } = input as { taskId: unknown; updates: unknown };
      if (typeof taskId !== "string" || taskId.length === 0 || taskId.length > 128) {
        return { ok: false, error: "Invalid task ID." };
      }
      if (!updates || typeof updates !== "object") {
        return { ok: false, error: "Invalid updates." };
      }
      const updatePayload = updates as BackgroundTaskUpdate;
      if (updatePayload.status && !isValidTaskStatus(updatePayload.status)) {
        return { ok: false, error: "Invalid status." };
      }
      if (updatePayload.stage !== undefined && !isValidVideoTaskStage(updatePayload.stage)) {
        return { ok: false, error: "Invalid video task stage." };
      }
      if (!isTaskOwnedBySender(event.sender, taskId)) return taskNotFound();

      // P2-FIX: For provider-polled tasks (video, music), the renderer
      // must not authoritatively set status, queueId, stage, or resultUrl
      // — those are owned by the main-process poll loop.  Only `error` and
      // a safe metadata subset are accepted from the renderer.
      // Non-provider-polled tasks (image, research, document) can still
      // receive full updates from their rendering owner.
      const existingTask = getBackgroundTask(taskId);
      let safeUpdate = updatePayload;
      if (existingTask && (existingTask.type === 'video' || existingTask.type === 'music')) {
        safeUpdate = { metadata: {} };
        if (updatePayload.error !== undefined && typeof updatePayload.error === 'string') {
          safeUpdate.error = String(updatePayload.error).slice(0, 1024);
        }
        if (updatePayload.metadata !== undefined) {
          const allowedMetaKeys = new Set(['step', 'note', 'request'])
          const filtered: Record<string, unknown> = {}
          for (const [k, v] of Object.entries(updatePayload.metadata)) {
            if (allowedMetaKeys.has(k)) filtered[k] = v
          }
          safeUpdate.metadata = filtered
        }
      }

      const task = await updateBackgroundTaskInMain(taskId, safeUpdate);
      return { ok: true, task };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:list", async (event) => {
    try {
      await initBackgroundTaskManager();
      const profileId = getProfileSessionId(event.sender);
      return { ok: true, tasks: listBackgroundTasks().filter((task) => task.profileId === profileId) };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:cancel", async (event, taskId: unknown) => {
    try {
      await initBackgroundTaskManager();
      if (typeof taskId !== "string" || taskId.length === 0 || taskId.length > 128) {
        return { ok: false, error: "Invalid task ID." };
      }
      if (!isTaskOwnedBySender(event.sender, taskId)) return taskNotFound();
      const task = await cancelBackgroundTaskInMain(taskId);
      return { ok: true, task };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:retry", async (event, taskId: unknown) => {
    try {
      await initBackgroundTaskManager();
      if (typeof taskId !== "string" || taskId.length === 0 || taskId.length > 128) {
        return { ok: false, error: "Invalid task ID." };
      }
      if (!isTaskOwnedBySender(event.sender, taskId)) return taskNotFound();
      const task = await retryBackgroundTaskInMain(taskId);
      return { ok: true, task };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:clear", async (event, taskId: unknown) => {
    try {
      await initBackgroundTaskManager();
      if (typeof taskId !== "string" || taskId.length === 0 || taskId.length > 128) {
        return { ok: false, error: "Invalid task ID." };
      }
      if (!isTaskOwnedBySender(event.sender, taskId)) return taskNotFound();
      await clearBackgroundTaskInMain(taskId);
      return { ok: true };
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });

  registerPrivilegedIpcChannel("backgroundTask:submitPaidQueue", async (event, input: unknown) => {
    try {
      await initBackgroundTaskManager();
      if (!input || typeof input !== "object") {
        return { ok: false, error: "Invalid submission input." };
      }
      const raw = input as { operation?: unknown; wirePayload?: unknown; logicalRequestHash?: unknown };
      if (raw.operation !== "video" && raw.operation !== "audio") {
        return { ok: false, error: "Invalid operation (must be 'video' or 'audio')." };
      }
      if (!raw.wirePayload || typeof raw.wirePayload !== "object") {
        return { ok: false, error: "Invalid wire payload." };
      }
      // P2-FIX: validate provider-specific paid-operation payload at the
      // IPC trust boundary before it reaches hash/canonicalise/guard code.
      const wp = raw.wirePayload as Record<string, unknown>;
      if (typeof wp.model !== 'string' || wp.model.length === 0 || wp.model.length > 128) {
        return { ok: false, error: "Invalid or missing model in wire payload." };
      }
      if (typeof wp.prompt !== 'string' || wp.prompt.length === 0) {
        return { ok: false, error: "Invalid or missing prompt in wire payload." };
      }
      if (wp.prompt.length > 5000) {
        return { ok: false, error: "Prompt exceeds 5000 characters." };
      }
      const serialized = JSON.stringify(raw.wirePayload);
      if (serialized.length > 100000) {
        return { ok: false, error: "Wire payload exceeds 100 KB." };
      }
      const profileId = getProfileSessionId(event.sender);
      return await submitPaidQueueTaskInMain({
        operation: raw.operation,
        profileId,
        wirePayload: raw.wirePayload as Record<string, unknown>,
        logicalRequestHash: typeof raw.logicalRequestHash === 'string' ? raw.logicalRequestHash : undefined,
      });
    } catch (err: unknown) {
      return { ok: false, error: redactErrorMessage(err) };
    }
  });
}

export function __backgroundTaskSubscribersForTests(): Set<WebContents> {
  return subscribers;
}
