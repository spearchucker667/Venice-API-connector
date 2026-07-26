// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const persistGeneratedMedia = vi.hoisted(() => vi.fn())
vi.mock('./generatedMediaStore', () => ({ persistGeneratedMedia }))

import {
  getGeneratedMediaRecovery,
  resetGeneratedMediaRecoveryQueueForTests,
  retainGeneratedMediaForRecovery,
  retryGeneratedMediaRecovery,
} from './generatedMediaRecoveryQueue'

describe('generatedMediaRecoveryQueue', () => {
  beforeEach(() => {
    resetGeneratedMediaRecoveryQueueForTests()
    persistGeneratedMedia.mockReset()
  })

  it('retains an isolated copy and removes it only after durable retry succeeds', async () => {
    const source = Buffer.from('valid-image-bytes')
    const retained = retainGeneratedMediaForRecovery(source, 'image/png')!
    source.fill(0)
    expect(getGeneratedMediaRecovery(retained.recoveryId)?.bytes.toString()).toBe('valid-image-bytes')

    persistGeneratedMedia.mockResolvedValue({ id: retained.sha256, url: `venice-media://${retained.sha256}` })
    await expect(retryGeneratedMediaRecovery(retained.recoveryId)).resolves.toMatchObject({ id: retained.sha256 })
    expect(getGeneratedMediaRecovery(retained.recoveryId)).toBeNull()
  })

  it('keeps bytes available when a retry still fails', async () => {
    const retained = retainGeneratedMediaForRecovery(Buffer.from('valid-image-bytes'), 'image/png')!
    persistGeneratedMedia.mockRejectedValue(Object.assign(new Error('full'), { code: 'ENOSPC' }))
    await expect(retryGeneratedMediaRecovery(retained.recoveryId)).rejects.toThrow('full')
    expect(getGeneratedMediaRecovery(retained.recoveryId)?.byteCount).toBe(17)
  })

  it('rejects a single entry larger than the bounded queue', () => {
    expect(retainGeneratedMediaForRecovery(Buffer.alloc(128 * 1024 * 1024 + 1), 'image/png')).toBeNull()
  })
})
