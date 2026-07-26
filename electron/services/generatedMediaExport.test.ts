// @vitest-environment node
// VERIFY-144: native generated-media Save As accepts an ID, derives the extension, and returns no path.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const mocks = vi.hoisted(() => ({ showSaveDialog: vi.fn(), resolveGeneratedMedia: vi.fn(), verifyGeneratedMediaIntegrity: vi.fn() }))
vi.mock('electron', () => ({ dialog: { showSaveDialog: mocks.showSaveDialog } }))
vi.mock('./generatedMediaStore', () => ({
  resolveGeneratedMedia: mocks.resolveGeneratedMedia,
  verifyGeneratedMediaIntegrity: mocks.verifyGeneratedMediaIntegrity,
}))

import { saveGeneratedMediaAs, saveGeneratedMediaBytesAs } from './generatedMediaExport'

describe('saveGeneratedMediaAs', () => {
  const root = path.join(os.tmpdir(), `vf-export-${process.pid}`)
  const source = path.join(root, 'source.mp4')

  beforeEach(async () => {
    vi.clearAllMocks()
    await fs.rm(root, { recursive: true, force: true })
    await fs.mkdir(root, { recursive: true })
    await fs.writeFile(source, Buffer.from('video'))
    mocks.verifyGeneratedMediaIntegrity.mockResolvedValue({ ok: true })
    mocks.resolveGeneratedMedia.mockResolvedValue({ path: source, mimeType: 'video/mp4' })
  })

  it('copies the resolved media through a native Save As dialog', async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(root, 'chosen.exe') })
    const result = await saveGeneratedMediaAs({ mediaId: 'a'.repeat(64), suggestedName: '../unsafe.exe' })
    expect(result).toEqual({ ok: true, canceled: false, filename: 'chosen.mp4', bytes: 5 })
    expect(result).not.toHaveProperty('filePath')
    await expect(fs.readFile(path.join(root, 'chosen.mp4'), 'utf8')).resolves.toBe('video')
  })

  it('rejects IDs instead of accepting renderer paths', async () => {
    await expect(saveGeneratedMediaAs({ mediaId: '../source.mp4' })).rejects.toThrow(/ID was invalid/i)
    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
  })

  it('returns a path-free cancellation receipt without copying media', async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: true, filePath: undefined })
    await expect(saveGeneratedMediaAs({ mediaId: 'a'.repeat(64) })).resolves.toEqual({ ok: true, canceled: true })
    expect(await fs.readdir(root)).toEqual(['source.mp4'])
  })

  it('refuses to export media that fails integrity verification', async () => {
    mocks.verifyGeneratedMediaIntegrity.mockResolvedValue({ ok: false, reason: 'hash-mismatch' })
    await expect(saveGeneratedMediaAs({ mediaId: 'a'.repeat(64) })).rejects.toThrow(/integrity/i)
    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
  })

  it('atomically exports volatile recovery bytes without returning a path', async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(root, 'recovered.exe') })
    await expect(saveGeneratedMediaBytesAs({
      bytes: Buffer.from('recovered-image'),
      mimeType: 'image/png',
      suggestedName: '../unsafe.exe',
    })).resolves.toEqual({ ok: true, canceled: false, filename: 'recovered.png', bytes: 15 })
    await expect(fs.readFile(path.join(root, 'recovered.png'), 'utf8')).resolves.toBe('recovered-image')
  })

  it('removes destination temporary files when the copy fails', async () => {
    mocks.resolveGeneratedMedia.mockResolvedValue({ path: path.join(root, 'missing.mp4'), mimeType: 'video/mp4' })
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(root, 'failed.mp4') })
    await fs.writeFile(path.join(root, 'failed.mp4'), 'existing')
    await expect(saveGeneratedMediaAs({ mediaId: 'a'.repeat(64) })).rejects.toThrow()
    expect((await fs.readdir(root)).filter((entry) => entry.includes('.tmp-'))).toEqual([])
    await expect(fs.readFile(path.join(root, 'failed.mp4'), 'utf8')).resolves.toBe('existing')
  })
})
