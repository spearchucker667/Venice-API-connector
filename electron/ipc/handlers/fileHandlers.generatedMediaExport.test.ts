// @vitest-environment node
// VERIFY-144: generated-media export is main-frame-only and accepts no renderer path.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  handlers: new Map<string, (...args: unknown[]) => Promise<unknown>>(),
  fromWebContents: vi.fn(),
  saveGeneratedMediaAs: vi.fn(),
  saveGeneratedMediaBytesAs: vi.fn(),
  persistGeneratedMedia: vi.fn(),
  retainGeneratedMediaForRecovery: vi.fn(),
  retryGeneratedMediaRecovery: vi.fn(),
  getGeneratedMediaRecovery: vi.fn(),
}))

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp') },
  BrowserWindow: { fromWebContents: mocks.fromWebContents },
  dialog: { showOpenDialog: vi.fn(), showSaveDialog: vi.fn() },
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
}))
vi.mock('./common', () => ({
  registerIpcChannel: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => mocks.handlers.set(channel, handler),
  registerPrivilegedIpcChannel: (channel: string, handler: (...args: unknown[]) => Promise<unknown>) => mocks.handlers.set(channel, handler),
}))
vi.mock('../../services/generatedMediaExport', () => ({
  saveGeneratedMediaAs: mocks.saveGeneratedMediaAs,
  saveGeneratedMediaBytesAs: mocks.saveGeneratedMediaBytesAs,
}))
vi.mock('../../services/generatedMediaStore', () => ({
  classifyGeneratedMediaPersistenceError: (error: unknown) => ({
    kind: 'unknown', retryable: false, message: error instanceof Error ? error.message : 'save failed',
  }),
  persistGeneratedMedia: mocks.persistGeneratedMedia,
}))
vi.mock('../../services/generatedMediaRecoveryQueue', () => ({
  retainGeneratedMediaForRecovery: mocks.retainGeneratedMediaForRecovery,
  retryGeneratedMediaRecovery: mocks.retryGeneratedMediaRecovery,
  getGeneratedMediaRecovery: mocks.getGeneratedMediaRecovery,
}))
vi.mock('../../services/mediaService', () => ({
  exportMedia: vi.fn(), generateMediaThumb: vi.fn(), importMediaFromPath: vi.fn(), readMediaMeta: vi.fn(), revealMediaInFolder: vi.fn(),
}))
vi.mock('../../services/characterImageCache', () => ({
  clearCharacterImageCache: vi.fn(), getCachedCharacterImage: vi.fn(), getCharacterImageCacheInventory: vi.fn(),
}))

import { registerFileHandlers } from './fileHandlers'

describe('app:media:save-generated', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.handlers.clear()
    registerFileHandlers()
    mocks.saveGeneratedMediaAs.mockResolvedValue({ ok: true, canceled: false, filename: 'video.mp4', bytes: 12 })
    mocks.persistGeneratedMedia.mockResolvedValue({
      id: 'a'.repeat(64), url: `venice-media://${'a'.repeat(64)}`, mimeType: 'image/png', byteCount: 68, sha256: 'a'.repeat(64),
    })
    mocks.retainGeneratedMediaForRecovery.mockReturnValue({ recoveryId: '11111111-1111-4111-8111-111111111111' })
  })

  it('rejects a subframe sender before opening the native export boundary', async () => {
    const sender = { mainFrame: { id: 1 } }
    mocks.fromWebContents.mockReturnValue({})
    const handler = mocks.handlers.get('app:media:save-generated')!
    await expect(handler({ sender, senderFrame: { id: 2 } }, { mediaId: 'a'.repeat(64) })).resolves.toMatchObject({ ok: false })
    expect(mocks.saveGeneratedMediaAs).not.toHaveBeenCalled()
  })

  it('forwards only a media ID and sanitized optional name from the main frame', async () => {
    const mainFrame = { id: 1 }
    const sender = { mainFrame }
    mocks.fromWebContents.mockReturnValue({})
    const handler = mocks.handlers.get('app:media:save-generated')!
    await handler({ sender, senderFrame: mainFrame }, { mediaId: 'a'.repeat(64), suggestedName: 'clip', sourcePath: '/secret/video.mp4' })
    expect(mocks.saveGeneratedMediaAs).toHaveBeenCalledWith({ mediaId: 'a'.repeat(64), suggestedName: 'clip' })
  })

  it('validates and persists generated image bytes without accepting renderer paths', async () => {
    const mainFrame = { id: 1 }
    const sender = { mainFrame }
    mocks.fromWebContents.mockReturnValue({})
    const handler = mocks.handlers.get('app:media:persist-generated-image')!
    const dataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='

    const result = await handler(
      { sender, senderFrame: mainFrame },
      { dataUrl, sourcePath: '/private/generated.png' },
    )

    expect(result).toMatchObject({ ok: true, media: { mimeType: 'image/png' } })
    expect(mocks.persistGeneratedMedia).toHaveBeenCalledWith(expect.any(Buffer), 'image/png')
  })

  it('rejects subframes and MIME-signature mismatches before persistence', async () => {
    const mainFrame = { id: 1 }
    const sender = { mainFrame }
    mocks.fromWebContents.mockReturnValue({})
    const handler = mocks.handlers.get('app:media:persist-generated-image')!

    await expect(handler(
      { sender, senderFrame: { id: 2 } },
      { dataUrl: 'data:image/png;base64,aGVsbG8=' },
    )).resolves.toMatchObject({ ok: false })
    await expect(handler(
      { sender, senderFrame: mainFrame },
      { dataUrl: 'data:image/png;base64,aGVsbG8=' },
    )).resolves.toMatchObject({ ok: false })
    expect(mocks.persistGeneratedMedia).not.toHaveBeenCalled()
  })

  it('retains validated bytes for retry when durable persistence fails', async () => {
    const mainFrame = { id: 1 }
    const sender = { mainFrame }
    mocks.fromWebContents.mockReturnValue({})
    mocks.persistGeneratedMedia.mockRejectedValue(Object.assign(new Error('full'), { code: 'ENOSPC' }))
    const handler = mocks.handlers.get('app:media:persist-generated-image')!
    const result = await handler(
      { sender, senderFrame: mainFrame },
      { dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==' },
    )
    expect(mocks.retainGeneratedMediaForRecovery).toHaveBeenCalledWith(expect.any(Buffer), 'image/png')
    expect(result).toMatchObject({ ok: false, recoveryId: '11111111-1111-4111-8111-111111111111' })
  })

  it('retries and exports only opaque main-process recovery IDs', async () => {
    const mainFrame = { id: 1 }
    const sender = { mainFrame }
    const recoveryId = '11111111-1111-4111-8111-111111111111'
    mocks.fromWebContents.mockReturnValue({})
    mocks.retryGeneratedMediaRecovery.mockResolvedValue({ id: 'a'.repeat(64), url: `venice-media://${'a'.repeat(64)}` })
    mocks.getGeneratedMediaRecovery.mockReturnValue({ bytes: Buffer.from('image'), mimeType: 'image/png' })
    mocks.saveGeneratedMediaBytesAs.mockResolvedValue({ ok: true, canceled: false, filename: 'saved.png', bytes: 5 })

    await mocks.handlers.get('app:media:retry-generated-image')!({ sender, senderFrame: mainFrame }, { recoveryId, sourcePath: '/secret' })
    expect(mocks.retryGeneratedMediaRecovery).toHaveBeenCalledWith(recoveryId)
    await mocks.handlers.get('app:media:save-generated-recovery')!({ sender, senderFrame: mainFrame }, { recoveryId, suggestedName: '../safe', sourcePath: '/secret' })
    expect(mocks.saveGeneratedMediaBytesAs).toHaveBeenCalledWith({ bytes: expect.any(Buffer), mimeType: 'image/png', suggestedName: '../safe' })
  })
})
