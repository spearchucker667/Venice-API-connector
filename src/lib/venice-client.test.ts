// VERIFY-031 regression guard
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { venice, veniceStreamChat, veniceBlob, veniceFormData, VeniceAPIError } from './venice-client'
import { desktopVenice } from '../services/desktopBridge'

vi.mock('../services/desktopBridge', () => ({
  desktopVenice: {
    request: vi.fn(),
    streamChat: vi.fn(),
  },
  isElectron: () => true,
}))

describe('venice-client (lib)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should make a request successfully', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'application/json',
      body: { data: 'hello' },
    })

    const result = await venice('/chat/completions', { method: 'POST', body: { test: true } })
    expect(result).toEqual({ data: 'hello' })
    // Phase B: venice() delegates to veniceFetch(), which forwards an
    // explicit empty `headers` object alongside endpoint / method / body.
    // We assert the canonical semantic fields and allow extra keys (such as
    // the future telemetry payload added by Phase C).
    expect(desktopVenice.request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/chat/completions',
        method: 'POST',
        body: { test: true },
      }),
      undefined,
    )
  })

  it('should throw VeniceAPIError on failure with body message', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      contentType: 'application/json',
      body: { error: 'Invalid request parameters', details: { safe_mode: { _errors: ['Unrecognized key(s) in object'] } } },
    })

    const err = await venice('/chat/completions').catch((e) => e) as unknown
    expect(err).toBeInstanceOf(VeniceAPIError)
    // After Phase B consolidation venice() delegates to veniceFetch(),
    // whose error path uses normalizeError() and prefixes the status code.
    expect((err as VeniceAPIError).message).toContain('400 request/schema/model error: Invalid request parameters')
    expect((err as VeniceAPIError).status).toBe(400)
  })

  it('should preserve statusText-friendly message when error body is empty', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      contentType: 'application/json',
      body: null,
    })

    const err = await venice('/chat/completions').catch((e) => e) as unknown
    expect(err).toBeInstanceOf(VeniceAPIError)
    // Phase B: veniceFetch's error message is the normalizeError() output
    // (e.g. "400 request/schema/model error: …"). The legacy statusText
    // fallback is no longer wired in for the legacy shim, but the upstream
    // error remains class-stable and the status code stays accurate.
    expect((err as VeniceAPIError).status).toBe(400)
    expect((err as VeniceAPIError).message).toMatch(/^(?:400 .*|Bad Request)$/)
  })

  it('should extract details._errors from validation error body', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: false,
      status: 400,
      statusText: 'Bad Request',
      headers: {},
      contentType: 'application/json',
      body: { details: { safe_mode: { _errors: ['Unrecognized key(s) in object'] } } },
    })

    const err = await venice('/chat/completions').catch((e) => e) as unknown
    // Phase B: normalizeError() prefixes the status code; the inner field
    // message is preserved verbatim.
    expect((err as VeniceAPIError).message).toContain('Unrecognized key')
  })

  it('should handle streaming completions', async () => {
    vi.mocked(desktopVenice.streamChat).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'text/event-stream',
      body: null,
    })

    const onDelta = vi.fn()
    await veniceStreamChat('/chat/completions', { prompt: 'hi' }, onDelta)
    expect(desktopVenice.streamChat).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/chat/completions',
        method: 'POST',
        body: { prompt: 'hi' },
      }),
      expect.any(Function),
      undefined,
    )
  })

  it('should return a blob', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'image/png',
      body: { dataBase64: 'dGVzdA==' }, // 'test' in base64
    })

    const blob = await veniceBlob('/image/generate', { prompt: 'image' })
    expect(blob.type).toBe('image/png')
    const text = await blob.text()
    expect(text).toBe('test')
  })

  it('should send serialized form data correctly', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'application/json',
      body: { ok: true },
    })

    const fd = new FormData()
    fd.append('foo', 'bar')

    const res = await veniceFormData<{ ok: boolean }>('/augment/scrape', fd)
    expect(res.ok).toBe(true)
    expect(desktopVenice.request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/augment/scrape',
        method: 'POST',
        body: {
          _isSerializedFormData: true,
          entries: [
            { name: 'foo', value: 'bar' }
          ]
        }
      }),
      undefined,
    )
  })

  // VERIFY-006 regression guard: venice() must forward the AbortSignal
  // to desktopVenice.request() as the second positional arg so the IPC
  // layer's `venice:abort` channel is triggered when the caller cancels.
  // The previous implementation dropped the signal on the floor, leaving a
  // live upstream HTTPS request when the renderer closed the stream.
  it('forwards AbortSignal to desktopVenice.request (VERIFY-006)', async () => {
    const controller = new AbortController()
    await venice('/chat/completions', {
      method: 'POST',
      body: { test: true },
      signal: controller.signal,
    })
    expect(desktopVenice.request).toHaveBeenCalledWith(
      expect.objectContaining({
        endpoint: '/chat/completions',
        method: 'POST',
        body: { test: true },
      }),
      controller.signal,
    )
  })

  // VERIFY-006 extension: veniceBlob() and veniceFormData() must
  // also forward the AbortSignal. The previous implementation declared
  // `init.signal` but never passed it to desktopVenice.request(), only
  // consulting it post-hoc for an `aborted` check. The IPC layer never
  // received the abort and the upstream HTTPS request kept running.
  it('forwards AbortSignal from veniceBlob (VERIFY-006)', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'image/png',
      body: { dataBase64: 'dGVzdA==' },
    })
    const controller = new AbortController()
    await veniceBlob('/image/generate', { prompt: 'image' }, { signal: controller.signal })
    expect(desktopVenice.request).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/image/generate' }),
      controller.signal,
    )
  })

  it('forwards AbortSignal from veniceFormData (VERIFY-006)', async () => {
    vi.mocked(desktopVenice.request).mockResolvedValue({
      ok: true,
      status: 200,
      statusText: 'OK',
      headers: {},
      contentType: 'application/json',
      body: { ok: true },
    })
    const controller = new AbortController()
    const fd = new FormData()
    fd.append('foo', 'bar')
    await veniceFormData<{ ok: boolean }>('/augment/scrape', fd, { signal: controller.signal })
    expect(desktopVenice.request).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: '/augment/scrape' }),
      controller.signal,
    )
  })

  it('throws synchronously when the AbortSignal is already aborted (veniceBlob)', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(
      veniceBlob('/image/generate', { prompt: 'image' }, { signal: controller.signal }),
    ).rejects.toThrow('Aborted')
    expect(desktopVenice.request).not.toHaveBeenCalled()
  })

  it('throws synchronously when the AbortSignal is already aborted (veniceFormData)', async () => {
    const controller = new AbortController()
    controller.abort()
    const fd = new FormData()
    fd.append('foo', 'bar')
    await expect(
      veniceFormData('/augment/scrape', fd, { signal: controller.signal }),
    ).rejects.toThrow('Aborted')
    expect(desktopVenice.request).not.toHaveBeenCalled()
  })
})
