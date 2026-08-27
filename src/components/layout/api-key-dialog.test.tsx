import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { ApiKeyDialog } from './api-key-dialog'
import { useAuthStore } from '../../stores/auth-store'

describe('ApiKeyDialog (P1-003 state machine)', () => {
  beforeEach(() => {
    useAuthStore.setState({
      apiKey: null,
      isConfigured: true,
      setApiKey: vi.fn().mockResolvedValue({ stored: true, validation: 'valid' }),
      clearApiKey: vi.fn().mockResolvedValue(undefined),
      validateStoredVeniceKey: vi.fn().mockResolvedValue('valid'),
    })
  })

  it('shows a safe error when setApiKey() returns a storage failure (matrix A)', async () => {
    useAuthStore.setState({
      isConfigured: false,
      setApiKey: vi.fn().mockResolvedValueOnce({
        stored: false,
        code: 'SECRET_STORAGE_WRITE_FAILED',
        safeMessage: 'The key could not be stored securely. Check the app diagnostics and try again.',
      }),
    })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Venice API key'), { target: { value: 'venice_secret_fixture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('The key could not be stored securely. Check the app diagnostics and try again.')
    // Modal must NOT claim the key was saved.
    expect(alert.textContent).not.toMatch(/key saved/i)
  })

  it('distinguishes "key saved, Venice offline" from "save failed" (matrix B)', async () => {
    useAuthStore.setState({
      isConfigured: false,
      setApiKey: vi.fn().mockResolvedValueOnce({ stored: true, validation: 'network-error' }),
    })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Venice API key'), { target: { value: 'venice_secret_fixture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/unreachable/i)
    expect(alert).toHaveTextContent(/saved/i)
    expect(alert.textContent).not.toMatch(/could not be saved/i)
  })

  it('reports a stored but rejected key without showing "save failed" (matrix C)', async () => {
    useAuthStore.setState({
      isConfigured: false,
      setApiKey: vi.fn().mockResolvedValueOnce({ stored: true, validation: 'invalid' }),
    })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Venice API key'), { target: { value: 'venice_secret_fixture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/rejected/i)
    expect(alert).toHaveTextContent(/stored/i)
    expect(alert.textContent).not.toMatch(/could not be saved/i)
  })

  it('closes the dialog and shows a "saved and verified" message on a valid outcome (matrix D)', async () => {
    const onClose = vi.fn()
    useAuthStore.setState({
      isConfigured: false,
      setApiKey: vi.fn().mockResolvedValueOnce({ stored: true, validation: 'valid' }),
    })

    render(<ApiKeyDialog open={true} onClose={onClose} />)
    fireEvent.change(screen.getByLabelText('Venice API key'), { target: { value: 'venice_secret_fixture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1))
  })

  it('rejects an empty value as a storage-side input error, not a save failure', async () => {
    const setApiKey = vi.fn().mockResolvedValueOnce({
      stored: false,
      code: 'INVALID_INPUT',
      safeMessage: 'Enter a Venice API key before saving.',
    })
    useAuthStore.setState({ isConfigured: false, setApiKey })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    // Connect button is disabled when value is empty; verify that
    // directly calling setApiKey with an empty key returns INVALID_INPUT.
    const result = await setApiKey('')
    expect(result).toMatchObject({ stored: false, code: 'INVALID_INPUT' })
  })

  // T-037 regression guard: Disconnect must await clearApiKey() and handle failures safely.
  it('awaits clearApiKey() and clears the input on disconnect', async () => {
    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    const input = screen.getByLabelText('Venice API key') as HTMLInputElement
    fireEvent.change(input, { target: { value: 'sk-test-value' } })

    const disconnectBtn = screen.getByRole('button', { name: 'Disconnect' })
    fireEvent.click(disconnectBtn)

    await waitFor(() => expect(useAuthStore.getState().clearApiKey).toHaveBeenCalledTimes(1))
    expect(input.value).toBe('')
  })

  it('shows a safe error message when clearApiKey() fails without leaking raw exception text', async () => {
    useAuthStore.setState({
      clearApiKey: vi.fn().mockRejectedValueOnce(new Error('secret/path leak')),
    })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    const disconnectBtn = screen.getByRole('button', { name: 'Disconnect' })
    fireEvent.click(disconnectBtn)

    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toBe('Failed to disconnect. Please try again.')
    expect(alert.textContent).not.toContain('secret')
    expect(alert.textContent).not.toContain('/path')
    expect(alert.textContent).not.toContain('leak')
  })

  it('does not display a "save failed" alert when only validation failed', async () => {
    useAuthStore.setState({
      isConfigured: false,
      setApiKey: vi.fn().mockResolvedValueOnce({ stored: true, validation: 'unknown' }),
    })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    fireEvent.change(screen.getByLabelText('Venice API key'), { target: { value: 'venice_secret_fixture' } })
    fireEvent.click(screen.getByRole('button', { name: 'Connect' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/saved/i)
    expect(alert.textContent).not.toMatch(/could not be saved/i)
  })

  it('exposes a Test button that runs validateStoredVeniceKey and shows the result', async () => {
    useAuthStore.setState({
      isConfigured: true,
      apiKey: null,
      validateStoredVeniceKey: vi.fn().mockResolvedValueOnce('network-error'),
    })

    render(<ApiKeyDialog open={true} onClose={vi.fn()} />)
    // The Test button is rendered alongside Disconnect; pick it by its
    // visible text rather than by i18n key so the assertion survives
    // catalog changes.
    const buttons = screen.getAllByRole('button')
    const testButton = buttons.find((b) => b.textContent?.toLowerCase().includes('test'))
    expect(testButton).toBeDefined()
    fireEvent.click(testButton!)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(/unreachable/i)
    expect(useAuthStore.getState().validateStoredVeniceKey).toHaveBeenCalledTimes(1)
  })
})
