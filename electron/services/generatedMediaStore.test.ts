// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const root = path.join(os.tmpdir(), 'vf-generated-media-test')
vi.mock('electron', () => ({ 
  app: { getPath: () => root },
  net: {
    fetch: async (url: string, init: any) => {
      const filePath = new URL(url).pathname;
      const stat = await fs.stat(filePath);
      const totalSize = stat.size;
      const rangeHeader = init?.headers?.Range || init?.headers?.range;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, "").split("-");
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : totalSize - 1;

        if (start >= totalSize || end >= totalSize || start > end) {
          return new Response(null, {
            status: 416,
            headers: {
              'Content-Range': `bytes */${totalSize}`,
              'Accept-Ranges': 'bytes'
            }
          });
        }
        
        const chunksize = (end - start) + 1;
        const fileHandle = await fs.open(filePath, 'r');
        const buffer = Buffer.alloc(chunksize);
        await fileHandle.read(buffer, 0, chunksize, start);
        await fileHandle.close();

        return new Response(buffer, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${totalSize}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunksize.toString()
          }
        });
      }

      const data = await fs.readFile(filePath);
      return new Response(data, {
        status: 200,
        headers: {
          'Content-Length': totalSize.toString(),
          'Accept-Ranges': 'bytes'
        }
      });
    }
  }
}))

import {
  auditGeneratedMediaIntegrity,
  classifyGeneratedMediaPersistenceError,
  createGeneratedMediaResponse,
  persistGeneratedMedia,
  recoverPendingGeneratedMediaWrites,
  retryGeneratedMediaPersistence,
  resolveGeneratedMedia,
  verifyGeneratedMediaIntegrity,
} from './generatedMediaStore'

describe('generatedMediaStore', () => {
  const blobRoot = path.join(root, 'media', 'blobs', 'sha256')
  beforeEach(async () => { await fs.rm(root, { recursive: true, force: true }) })

  it('atomically persists and resolves an MP4 by content hash', async () => {
    const bytes = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from('ftypisom'), Buffer.from([0, 0, 0, 0])])
    const saved = await persistGeneratedMedia(bytes, 'video/mp4')
    expect(saved.url).toBe(`venice-media://${saved.sha256}`)
    const resolved = await resolveGeneratedMedia(saved.id)
    expect(resolved?.mimeType).toBe('video/mp4')
    expect(await fs.readFile(resolved!.path)).toEqual(bytes)
  })

  it('rejects empty, unsupported, and signature-mismatched media', async () => {
    await expect(persistGeneratedMedia(Buffer.alloc(0), 'audio/mpeg')).rejects.toThrow(/empty/i)
    await expect(persistGeneratedMedia(Buffer.from('x'), 'text/plain')).rejects.toThrow(/unsupported/i)
    await expect(persistGeneratedMedia(Buffer.from('not-mp4'), 'video/mp4')).rejects.toThrow(/did not match/i)
  })

  it('classifies persistence failures without exposing filesystem paths', () => {
    expect(classifyGeneratedMediaPersistenceError(Object.assign(new Error('/private/full'), { code: 'ENOSPC' }))).toMatchObject({
      kind: 'storage-full', retryable: false,
    })
    expect(classifyGeneratedMediaPersistenceError(Object.assign(new Error('/private/busy'), { code: 'EBUSY' }))).toMatchObject({
      kind: 'storage-busy', retryable: true,
    })
    expect(classifyGeneratedMediaPersistenceError(Object.assign(new Error('/private/denied'), { code: 'EACCES' })).message).not.toContain('/private')
    expect(classifyGeneratedMediaPersistenceError(Object.assign(new Error('/Volumes/offline'), { code: 'EIO' }))).toMatchObject({
      kind: 'storage-unavailable', retryable: false,
    })
  })

  it.runIf(process.platform !== 'win32')('classifies a real read-only media directory without changing app data', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    await fs.mkdir(blobRoot, { recursive: true, mode: 0o700 })
    await fs.chmod(blobRoot, 0o500)
    try {
      const error = await persistGeneratedMedia(png, 'image/png').catch((value) => value)
      expect(classifyGeneratedMediaPersistenceError(error)).toMatchObject({ kind: 'permission-denied', retryable: false })
    } finally {
      await fs.chmod(blobRoot, 0o700)
    }
  })

  it('retries transient persistence failures and stops after success', async () => {
    const operation = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('busy'), { code: 'EBUSY' }))
      .mockRejectedValueOnce(Object.assign(new Error('again'), { code: 'EAGAIN' }))
      .mockResolvedValue('saved')

    await expect(retryGeneratedMediaPersistence(operation)).resolves.toBe('saved')
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it('verifies size and content hash and reports tampering during audit', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const saved = await persistGeneratedMedia(png, 'image/png')
    await expect(verifyGeneratedMediaIntegrity(saved.id)).resolves.toMatchObject({ ok: true })

    const resolved = await resolveGeneratedMedia(saved.id)
    await fs.writeFile(resolved!.path, Buffer.from('tampered'))
    await expect(verifyGeneratedMediaIntegrity(saved.id)).resolves.toMatchObject({ ok: false, reason: 'size-mismatch' })
    await expect(auditGeneratedMediaIntegrity()).resolves.toEqual({ checked: 1, healthy: 0, failed: 1 })
  })

  it('recovers a journaled image write after restart', async () => {
    const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
    const sha256 = (await import('node:crypto')).createHash('sha256').update(png).digest('hex')
    const temporaryName = `.incoming-${'a'.repeat(24)}.tmp`
    await fs.mkdir(blobRoot, { recursive: true })
    await fs.writeFile(path.join(blobRoot, temporaryName), png)
    await fs.writeFile(path.join(blobRoot, `.pending-${sha256}.json`), JSON.stringify({
      version: 1,
      temporaryName,
      mimeType: 'image/png',
      byteCount: png.length,
      sha256,
      createdAt: Date.now(),
    }))

    await expect(recoverPendingGeneratedMediaWrites()).resolves.toEqual({ recovered: 1, failed: 0 })
    await expect(verifyGeneratedMediaIntegrity(sha256)).resolves.toMatchObject({ ok: true })
    await expect(fs.stat(path.join(blobRoot, `.pending-${sha256}.json`))).rejects.toMatchObject({ code: 'ENOENT' })
  })

  // VERIFY-143: app-owned generated video supports browser media range reads.
  it('serves byte ranges for durable video playback and rejects invalid ranges', async () => {
    const bytes = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from('ftypisom'), Buffer.from('video-payload')])
    const saved = await persistGeneratedMedia(bytes, 'video/mp4')

    const access = { isDev: true, origin: null, referrer: '', rendererRoot: '' }
    const partial = await createGeneratedMediaResponse(saved.id, { headers: { range: 'bytes=4-11' } } as any, access)
    expect(partial.status).toBe(206)
    expect(partial.headers.get('accept-ranges')).toBe('bytes')
    expect(partial.headers.get('content-range')).toBe(`bytes 4-11/${bytes.length}`)
    expect(Buffer.from(await partial.arrayBuffer())).toEqual(bytes.subarray(4, 12))
    // CORS headers are emitted alongside byte-range metadata. The Vite dev
    // origin is the only `Access-Control-Allow-Origin` value released in dev.
    expect(partial.headers.get('access-control-allow-origin')).toBe('http://localhost:5173')
    expect(partial.headers.get('vary')).toBe('Origin')

    const invalid = await createGeneratedMediaResponse(saved.id, { headers: { range: `bytes=${bytes.length}-` } } as any, access)
    expect(invalid.status).toBe(416)
    expect(invalid.headers.get('content-range')).toBe(`bytes */${bytes.length}`)
  })

  // VERIFY-155: foreign origins must never reach generated-media bytes.
  it('rejects generated-media requests from forbidden origins', async () => {
    const bytes = Buffer.concat([Buffer.from([0, 0, 0, 20]), Buffer.from('ftypisom'), Buffer.from('video-payload')])
    const saved = await persistGeneratedMedia(bytes, 'video/mp4')

    const blocked = await createGeneratedMediaResponse(
      saved.id,
      { headers: { range: 'bytes=4-11' } } as any,
      { isDev: true, origin: 'https://evil.example', referrer: 'https://evil.example/app', rendererRoot: '' },
    )
    expect(blocked.status).toBe(403)
    expect(blocked.headers.get('access-control-allow-origin')).toBeNull()
  })
})
