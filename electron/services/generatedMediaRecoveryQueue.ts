/** Bounded, process-local custody for valid media that could not reach disk. */
import crypto from 'crypto'
import { persistGeneratedMedia, type DurableGeneratedMedia } from './generatedMediaStore'

const MAX_RECOVERY_ITEMS = 8
const MAX_RECOVERY_BYTES = 128 * 1024 * 1024
const RECOVERY_TTL_MS = 30 * 60 * 1000

interface RecoveryEntry {
  id: string
  bytes: Buffer
  mimeType: string
  byteCount: number
  sha256: string
  createdAt: number
}

const entries = new Map<string, RecoveryEntry>()
let retainedBytes = 0

function discardEntry(id: string): void {
  const entry = entries.get(id)
  if (!entry) return
  entries.delete(id)
  retainedBytes -= entry.byteCount
  entry.bytes.fill(0)
}

function prune(now = Date.now()): void {
  for (const entry of entries.values()) {
    if (now - entry.createdAt >= RECOVERY_TTL_MS) discardEntry(entry.id)
  }
  while (entries.size > MAX_RECOVERY_ITEMS || retainedBytes > MAX_RECOVERY_BYTES) {
    const oldest = entries.keys().next().value as string | undefined
    if (!oldest) break
    discardEntry(oldest)
  }
}

export function retainGeneratedMediaForRecovery(bytes: Buffer, mimeType: string): {
  recoveryId: string
  byteCount: number
  sha256: string
} | null {
  prune()
  if (bytes.length === 0 || bytes.length > MAX_RECOVERY_BYTES) return null
  const recoveryId = crypto.randomUUID()
  const copy = Buffer.from(bytes)
  const entry: RecoveryEntry = {
    id: recoveryId,
    bytes: copy,
    mimeType,
    byteCount: copy.length,
    sha256: crypto.createHash('sha256').update(copy).digest('hex'),
    createdAt: Date.now(),
  }
  entries.set(recoveryId, entry)
  retainedBytes += entry.byteCount
  const expiryTimer = setTimeout(() => discardEntry(recoveryId), RECOVERY_TTL_MS)
  expiryTimer.unref()
  prune()
  return entries.has(recoveryId)
    ? { recoveryId, byteCount: entry.byteCount, sha256: entry.sha256 }
    : null
}

export function getGeneratedMediaRecovery(recoveryId: string): {
  bytes: Buffer
  mimeType: string
  byteCount: number
  sha256: string
} | null {
  prune()
  const entry = entries.get(recoveryId)
  if (!entry) return null
  return {
    bytes: Buffer.from(entry.bytes),
    mimeType: entry.mimeType,
    byteCount: entry.byteCount,
    sha256: entry.sha256,
  }
}

export async function retryGeneratedMediaRecovery(recoveryId: string): Promise<DurableGeneratedMedia> {
  const entry = getGeneratedMediaRecovery(recoveryId)
  if (!entry) throw new Error('Generated image recovery data expired or is unavailable.')
  const media = await persistGeneratedMedia(entry.bytes, entry.mimeType)
  discardEntry(recoveryId)
  return media
}

export function discardGeneratedMediaRecovery(recoveryId: string): void {
  discardEntry(recoveryId)
}

/** Test-only reset; production callers must discard individual opaque IDs. */
export function resetGeneratedMediaRecoveryQueueForTests(): void {
  for (const id of [...entries.keys()]) discardEntry(id)
}
