// @vitest-environment node
// VERIFY-144: native generated-media Save As accepts an ID, derives the extension, and returns no path.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
  let root = ''
  let source = ''

  beforeEach(async () => {
    vi.clearAllMocks()
    root = await fs.mkdtemp(path.join(os.tmpdir(), 'vf-export-'))
    source = path.join(root, 'source.mp4')
    await fs.writeFile(source, Buffer.from('video'))
    mocks.verifyGeneratedMediaIntegrity.mockResolvedValue({ ok: true })
    mocks.resolveGeneratedMedia.mockResolvedValue({ path: source, mimeType: 'video/mp4' })
  })

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true })
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
    const pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(root, 'recovered.exe') })
    await expect(saveGeneratedMediaBytesAs({
      bytes: pngBytes,
      mimeType: 'image/png',
      suggestedName: '../unsafe.exe',
    })).resolves.toEqual({ ok: true, canceled: false, filename: 'recovered.png', bytes: pngBytes.length })
    expect(await fs.readFile(path.join(root, 'recovered.png'))).toEqual(pngBytes)
  })

  it.each([
    { mimeType: 'audio/mpeg', bytes: Buffer.from('ID3audio'), extension: 'mp3' },
    { mimeType: 'audio/wav', bytes: Buffer.from('RIFF\x00\x00\x00\x00WAVEaudio', 'binary'), extension: 'wav' },
    { mimeType: 'audio/flac', bytes: Buffer.from('fLaCaudio'), extension: 'flac' },
    { mimeType: 'audio/ogg', bytes: Buffer.from('OggSaudio'), extension: 'ogg' },
    { mimeType: 'audio/opus', bytes: Buffer.from('OggSOpusHead'), extension: 'opus' },
    { mimeType: 'audio/aac', bytes: Buffer.from([0xff, 0xf1, 0x50, 0x80]), extension: 'aac' },
    { mimeType: 'audio/mp4', bytes: Buffer.from('\x00\x00\x00\x18ftypM4A audio', 'binary'), extension: 'm4a' },
  ])('preserves supported $mimeType bytes with the canonical extension', async ({ mimeType, bytes, extension }) => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(root, 'chosen.any') })
    const result = await saveGeneratedMediaBytesAs({ bytes, mimeType, suggestedName: '音声 sample.tmp' })
    expect(mocks.showSaveDialog).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: `音声 sample.${extension}` }))
    expect(result.filename).toBe(`chosen.${extension}`)
    expect(await fs.readFile(path.join(root, result.filename!))).toEqual(bytes)
  })

  it('rejects empty, unsupported, and MIME-mismatched media before showing a dialog', async () => {
    await expect(saveGeneratedMediaBytesAs({ bytes: Buffer.alloc(0), mimeType: 'audio/mpeg' })).rejects.toThrow(/empty/i)
    await expect(saveGeneratedMediaBytesAs({ bytes: Buffer.from('ID3audio'), mimeType: 'audio/x-unknown' })).rejects.toThrow(/type/i)
    await expect(saveGeneratedMediaBytesAs({ bytes: Buffer.from('ID3audio'), mimeType: 'image/png' })).rejects.toThrow(/MIME/i)
    expect(mocks.showSaveDialog).not.toHaveBeenCalled()
  })

  it('sanitizes reserved and very long filenames while preserving Unicode', async () => {
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: path.join(root, 'ignored.tmp') })
    const bytes = Buffer.from('ID3audio')
    await saveGeneratedMediaBytesAs({ bytes, mimeType: 'audio/mpeg', suggestedName: 'CON.mp3' })
    expect(mocks.showSaveDialog).toHaveBeenLastCalledWith(expect.objectContaining({ defaultPath: '_CON.mp3' }))
    await saveGeneratedMediaBytesAs({ bytes, mimeType: 'audio/mpeg', suggestedName: `${'界'.repeat(200)}.mp3` })
    const defaultPath = mocks.showSaveDialog.mock.calls.at(-1)?.[0].defaultPath as string
    expect(defaultPath).toMatch(/^界+\.mp3$/)
    expect([...defaultPath.replace(/\.mp3$/, '')]).toHaveLength(120)
  })

  it('atomically replaces an existing destination only after the new bytes are ready', async () => {
    const destination = path.join(root, 'existing.mp3')
    await fs.writeFile(destination, 'old')
    mocks.showSaveDialog.mockResolvedValue({ canceled: false, filePath: destination })
    const bytes = Buffer.from('ID3replacement')
    await saveGeneratedMediaBytesAs({ bytes, mimeType: 'audio/mpeg', suggestedName: 'existing.mp3' })
    expect(await fs.readFile(destination)).toEqual(bytes)
  })

  it('preserves large media and embedded image metadata byte-for-byte', async () => {
    const largeMp3 = Buffer.concat([Buffer.from('ID3'), Buffer.alloc(8 * 1024 * 1024, 0x5a)])
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: path.join(root, 'large.mp3') })
    const largeResult = await saveGeneratedMediaBytesAs({ bytes: largeMp3, mimeType: 'audio/mpeg', suggestedName: 'large.mp3' })
    expect(largeResult.bytes).toBe(largeMp3.length)
    expect((await fs.readFile(path.join(root, 'large.mp3'))).equals(largeMp3)).toBe(true)

    const jpegWithExif = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe1, 0x00, 0x0a]),
      Buffer.from('Exif\0\0meta', 'binary'),
      Buffer.from([0xff, 0xd9]),
    ])
    mocks.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: path.join(root, 'metadata.jpg') })
    await saveGeneratedMediaBytesAs({ bytes: jpegWithExif, mimeType: 'image/jpeg', suggestedName: 'metadata.jpg' })
    expect(await fs.readFile(path.join(root, 'metadata.jpg'))).toEqual(jpegWithExif)
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
