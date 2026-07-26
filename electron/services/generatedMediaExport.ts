/** Native Save As boundary for main-owned generated media. */
import { dialog } from 'electron'
import crypto from 'crypto'
import fs from 'fs/promises'
import path from 'path'
import { resolveGeneratedMedia, verifyGeneratedMediaIntegrity } from './generatedMediaStore'

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
