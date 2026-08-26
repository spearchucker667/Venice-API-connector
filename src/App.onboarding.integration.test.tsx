// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import React from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the heavy dependencies before importing App
vi.mock('./services/desktopBridge', async (importOriginal) => {
  const actual: any = await importOriginal()
  return {
    ...actual,
    isElectron: () => false,
    desktopProfilePassword: { activate: vi.fn(async () => ({ ok: true, verified: true })) },
    desktopMasterPassword: { isSet: vi.fn(async () => false) },
    desktopSync: { setSyncFolder: vi.fn(async () => ({ ok: true })) },
    initDesktopBridge: vi.fn(async () => {}),
  }
})

import { App } from './App'
import { useProfileStore } from './stores/profile-store'
import { useAuthStore } from './stores/auth-store'

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  )
}

describe('App onboarding integration', () => {
  beforeEach(() => {
    localStorage.clear()
    useProfileStore.setState({
      profiles: [{ id: 'default', name: 'Default Profile', onboardingCompleted: false }],
      activeProfileId: 'default',
      masterPasswordSet: false,
      globalOnboardingCompleted: false,
    })
    useAuthStore.setState({ apiKey: '', isConfigured: false })
  })
  afterEach(() => {
    localStorage.clear()
  })

  it('shows FirstRunModal first, then OnboardingSplash, Continue advances state', async () => {
    renderWithProviders(<App />)

    // FirstRunModal should be visible
    await waitFor(() => {
      expect(screen.getByText(/18\+ Age Requirement/i)).toBeInTheDocument()
    })

    // Click acknowledge to dismiss FirstRunModal
    const ackButton = screen.getByRole('button', { name: /agree|acknowledge|continue|18/i })
    fireEvent.click(ackButton)

    // OnboardingSplash should appear
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Welcome to Venice Forge' })).toBeInTheDocument()
    })

    // Now the Continue button should be visible
    const continueBtn = await screen.findByRole('button', { name: /continue/i })
    expect(continueBtn).toBeInTheDocument()

    // Click Continue - state should advance
    fireEvent.click(continueBtn)

    // Profile step should show
    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 3, name: 'Profiles' })).toBeInTheDocument()
    }, { timeout: 1000 })
  })
})
