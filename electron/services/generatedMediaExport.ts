/** Native Save As boundary for main-owned generated media. */
import { dialog } from 'electron'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { resolveGeneratedMedia, verifyGeneratedMediaIntegrity } from './generatedMediaStore'

export interface BulkExportItem {
  itemId: string
  mediaId?: string
  dataUrl?: string
  mimeType?: string
  suggestedName: string
}

export interface BulkExportResult {
  ok: boolean
  canceled: boolean
  succeeded: Array<{ itemId: string; filename: string; bytes: number }>
  failed: Array<{ itemId: string; error: string }>
}

const EXTENSION_BY_MIME: Record<string, string> = {
  'video/mp4': 'mp4',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/flac': 'flac',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
}

function sanitizeSuggestedName(value: unknown, extension: string): string {
  const stem = typeof value === 'string' ? path.parse(path.basename(value)).name : 'venice-forge-media'
  const sanitized = stem.replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '').slice(0, 120) || 'venice-forge-media'
  return `${sanitized}.${extension}`
}

async function chooseGeneratedMediaDestination(input: {
  mimeType: string
  suggestedName?: string
}): Promise<{ canceled: true } | { canceled: false; destination: string }> {
  const extension = EXTENSION_BY_MIME[input.mimeType]
  if (!extension) throw new Error('Generated media type cannot be exported.')
  const suggestedName = sanitizeSuggestedName(input.suggestedName, extension)
  const filterLabel = input.mimeType.startsWith('image/')
    ? `${extension.toUpperCase()} image`
    : input.mimeType === 'video/mp4'
      ? 'MP4 video'
      : 'Audio'
  // verify-no-native-dialogs: allow — user-initiated generated-media Save As
  const choice = await dialog.showSaveDialog({
    title: 'Save generated media',
    defaultPath: suggestedName,
    filters: [{ name: filterLabel, extensions: [extension] }],
  })
  if (choice.canceled || !choice.filePath) return { canceled: true }
  const parsedDestination = path.parse(choice.filePath)
  return {
    canceled: false,
    destination: path.join(parsedDestination.dir, `${parsedDestination.name}.${extension}`),
  }
}

async function replaceFileAtomically(destination: string, writeTemporary: (temporary: string) => Promise<void>): Promise<number> {
  const temporary = `${destination}.tmp-${crypto.randomBytes(6).toString('hex')}`
  const displaced = `${destination}.previous-${crypto.randomBytes(6).toString('hex')}`
  let displacedExisting = false
  try {
    await writeTemporary(temporary)
    const handle = await fs.open(temporary, 'r')
    try { await handle.sync() } finally { await handle.close() }
    try {
      await fs.rename(temporary, destination)
    } catch (error) {
      if (!['EEXIST', 'EPERM'].includes((error as NodeJS.ErrnoException).code ?? '')) throw error
      try {
        await fs.rename(destination, displaced)
        displacedExisting = true
      } catch (displaceError) {
        if ((displaceError as NodeJS.ErrnoException).code !== 'ENOENT') throw displaceError
      }
      try {
        await fs.rename(temporary, destination)
      } catch (replacementError) {
        if (displacedExisting) await fs.rename(displaced, destination).catch(() => undefined)
        throw replacementError
      }
    }
    if (displacedExisting) await fs.rm(displaced, { force: true }).catch(() => undefined)
    return (await fs.stat(destination)).size
  } finally {
    await fs.rm(temporary, { force: true }).catch(() => undefined)
  }
}

export async function saveGeneratedMediaBytesAs(input: {
  bytes: Buffer
  mimeType: string
  suggestedName?: string
}): Promise<{ ok: boolean; canceled: boolean; filename?: string; bytes?: number }> {
  if (input.bytes.length === 0) throw new Error('Generated media recovery data was empty.')
  const choice = await chooseGeneratedMediaDestination(input)
  if (choice.canceled) return { ok: true, canceled: true }
  const byteCount = await replaceFileAtomically(choice.destination, (temporary) => fs.writeFile(temporary, input.bytes, { mode: 0o600 }))
  return { ok: true, canceled: false, filename: path.basename(choice.destination), bytes: byteCount }
}

export async function saveGeneratedMediaAs(input: { mediaId: string; suggestedName?: string }): Promise<{
  ok: boolean
  canceled: boolean
  filename?: string
  bytes?: number
}> {
  if (!/^[a-f0-9]{64}$/.test(input.mediaId)) throw new Error('Generated media ID was invalid.')
  const integrity = await verifyGeneratedMediaIntegrity(input.mediaId)
  if (!integrity.ok) throw new Error('Generated media failed its integrity check and cannot be exported.')
  const resolved = await resolveGeneratedMedia(input.mediaId)
  if (!resolved) throw new Error('Generated media is missing. Retry retrieval from Video Studio.')
  const choice = await chooseGeneratedMediaDestination({ mimeType: resolved.mimeType, suggestedName: input.suggestedName })
  if (choice.canceled) return { ok: true, canceled: true }
  const bytes = await replaceFileAtomically(choice.destination, (temporary) => fs.copyFile(resolved.path, temporary))
  return { ok: true, canceled: false, filename: path.basename(choice.destination), bytes }
}

function parseDataUrl(value: string): { mimeType: string; bytes: Buffer } | null {
  const match = /^data:([^;,]+);base64,([A-Za-z0-9+/=\r\n]+)$/i.exec(value.trim())
  if (!match) return null
  const mimeType = match[1].toLowerCase()
  const raw = match[2].replace(/\s+/g, '')
  if (raw.length % 4 !== 0 || !/^[A-Za-z0-9+/]+={0,2}$/.test(raw)) return null
  const bytes = Buffer.from(raw, 'base64')
  if (bytes.length === 0) return null
  return { mimeType, bytes }
}

export async function saveDataUrlAs(input: {
  dataUrl: string
  suggestedName?: string
}): Promise<{ ok: boolean; canceled: boolean; filename?: string; bytes?: number }> {
  const parsed = parseDataUrl(input.dataUrl)
  if (!parsed) throw new Error('Media data URL was invalid.')
  return saveGeneratedMediaBytesAs({
    bytes: parsed.bytes,
    mimeType: parsed.mimeType,
    suggestedName: input.suggestedName,
  })
}

function deduplicateFilename(candidate: string, existing: Set<string>): string {
  if (!existing.has(candidate)) return candidate
  const parsed = path.parse(candidate)
  let index = 2
  while (true) {
    const next = `${parsed.name}-${index}${parsed.ext}`
    if (!existing.has(next)) return next
    index++
  }
}

function sanitizeFilenameForExport(value: string): string {
  const s = path.basename(value).replace(/[^a-zA-Z0-9_.-]/g, '_').replace(/^\.+/, '').slice(0, 200)
  return s || 'venice-forge-export'
}

export async function exportMediaBatchAs(input: {
  items: BulkExportItem[]
  ownerWindow: Electron.BrowserWindow
}): Promise<BulkExportResult> {
  const count = input.items.length
  if (count === 0) return { ok: true, canceled: false, succeeded: [], failed: [] }
  if (count > 500) return { ok: false, canceled: false, succeeded: [], failed: [{ itemId: '', error: 'Batch export limited to 500 items.' }] }

  const choice = await dialog.showOpenDialog(input.ownerWindow, {
    title: 'Choose media export location',
    properties: ['openDirectory', 'createDirectory'],
  })
  if (choice.canceled || !choice.filePaths?.[0]) {
    return { ok: true, canceled: true, succeeded: [], failed: [] }
  }
  const baseDir = path.resolve(choice.filePaths[0])
  const usedFilenames = new Set<string>()
  const succeeded: BulkExportResult['succeeded'] = []
  const failed: BulkExportResult['failed'] = []

  for (const item of input.items) {
    try {
      let bytes: Buffer
      let mimeType: string

      if (item.mediaId) {
        if (!/^[a-f0-9]{64}$/.test(item.mediaId)) {
          failed.push({ itemId: item.itemId, error: 'Media ID was invalid.' })
          continue
        }
        const resolved = await resolveGeneratedMedia(item.mediaId)
        if (!resolved) {
          failed.push({ itemId: item.itemId, error: 'Generated media is missing.' })
          continue
        }
        bytes = await fs.readFile(resolved.path)
        mimeType = resolved.mimeType
      } else if (item.dataUrl) {
        const parsed = parseDataUrl(item.dataUrl)
        if (!parsed) {
          failed.push({ itemId: item.itemId, error: 'Media data URL was invalid.' })
          continue
        }
        bytes = parsed.bytes
        mimeType = parsed.mimeType
      } else {
        failed.push({ itemId: item.itemId, error: 'No media source provided.' })
        continue
      }

      const ext = EXTENSION_BY_MIME[mimeType] || 'bin'
      const rawName = item.suggestedName || item.itemId
      const safeStem = sanitizeFilenameForExport(rawName)
      const candidateName = `${safeStem}.${ext}`
      const filename = deduplicateFilename(candidateName, usedFilenames)
      usedFilenames.add(filename)

      const destination = path.join(baseDir, filename)
      const byteCount = await replaceFileAtomically(destination, (tmp) =>
        fs.writeFile(tmp, bytes, { mode: 0o600 }),
      )
      succeeded.push({ itemId: item.itemId, filename, bytes: byteCount })
    } catch (err) {
      failed.push({ itemId: item.itemId, error: (err instanceof Error ? err.message : String(err)).slice(0, 200) })
    }
  }

  return { ok: failed.length === 0, canceled: false, succeeded, failed }
}
