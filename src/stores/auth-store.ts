import { create } from 'zustand'
import { desktopApiKey, desktopJinaApiKey, desktopProviderApiKey, desktopProviderCredential, desktopProviderSettings } from '../services/desktopBridge' // TARGET Bridge
import { PROVIDER_REGISTRY, requiresStructuredCredential, type ProviderId } from '../types/provider'
import { redactErrorMessage } from '../shared/redaction'
import { invalidateModelQueries } from '../services/modelQueryCoordinator'
import { useModelCatalogRuntimeStore } from './model-catalog-runtime-store'
import type { ApiKeyConfigurationStatus, ApiKeyValidationStatus, CredentialFailureCode, CredentialStorageMode } from '../types/api-connectivity'

export type AuthHydrationStatus = 'idle' | 'checking' | 'ready' | 'error'

/** Outcome of `setApiKey` — separates secure-store persistence from
 *  Venice connectivity validation so the dialog can show an honest
 *  message for each failure mode (P1-003). */
export type SetApiKeyOutcome =
  | { stored: true; validation: "valid" }
  | { stored: true; validation: "invalid" }
  | { stored: true; validation: "network-error" }
  | { stored: true; validation: "unknown" }
  | { stored: false; code: CredentialFailureCode; safeMessage: string }
  | { stored: false; code: "INVALID_INPUT"; safeMessage: string }

export interface AuthState {
  apiKey: string | null
  hasEncrypted: boolean
  isConfigured: boolean
  jinaApiKey: string | null
  jinaIsConfigured: boolean
  hydrationStatus: AuthHydrationStatus
  hydrationError: string | null
  credentialState: ApiKeyConfigurationStatus['state']
  credentialStorageMode: CredentialStorageMode
  credentialFailureCode: CredentialFailureCode | null
  credentialSafeMessage: string | null
  /** Last Venice API key validation outcome. Updated whenever `setApiKey` or
   *  a manual test runs. Used by the Privacy dashboard to surface a
   *  per-provider status without re-querying the network. */
  veniceLastValidationStatus: ApiKeyValidationStatus
  veniceLastValidationAt: string | null
  jinaLastValidationStatus: ApiKeyValidationStatus
  jinaLastValidationAt: string | null
  /** Per-fallback-provider validation status, keyed by provider id. */
  providerLastValidationStatus: Record<string, ApiKeyValidationStatus>
  providerLastValidationAt: Record<string, string | null>
  checkConfiguration: () => Promise<void>
  /**
   * Saves a Venice API key, then validates it against Venice. The
   * returned outcome distinguishes:
   *   - secure-store write failures (stored=false)
   *   - validation failures after a successful save (stored=true, validation
   *     = "invalid" | "network-error" | "unknown")
   *   - successful save + validation (stored=true, validation="valid")
   *
   * Never throws for connectivity-class failures; the dialog can present
   * the right message and leave the key stored for retry.
   */
  setApiKey: (key: string, remember?: { passphrase?: string }) => Promise<SetApiKeyOutcome>
  /**
   * Removes a stored Venice API key (idempotent). Throws only on
   * unrecoverable secure-store errors so the caller can surface them.
   */
  clearApiKey: () => Promise<void>
  /**
   * Re-runs Venice validation against the currently stored key without
   * re-saving it. Returns the new validation status. Safe to call from
   * the dialog "Test" button or any "Re-test connection" affordance.
   */
  validateStoredVeniceKey: () => Promise<ApiKeyValidationStatus>
  setJinaApiKey: (key: string) => Promise<void>
  clearJinaApiKey: () => Promise<void>

  configuredProviders: Record<string, boolean>
  setProviderApiKey: (providerId: string, key: string) => Promise<void>
  clearProviderApiKey: (providerId: string) => Promise<void>
  setProviderCredential: (providerId: ProviderId, credential: import('../types/provider').ProviderCredential) => Promise<void>
  clearProviderCredential: (providerId: ProviderId) => Promise<void>
  /** Records a successful or failed validation against a provider key. The
   *  Privacy dashboard and ConfigPanel read from this so users can see when
   *  a stored key was last proven good without re-running the test. */
  recordProviderValidation: (providerId: string, status: ApiKeyValidationStatus, at?: string) => void
  recordJinaValidation: (status: ApiKeyValidationStatus, at?: string) => void
}

/** True when Venice requests can authenticate without exposing a persisted key. */
export function selectHasVeniceKey(state: Pick<AuthState, 'apiKey' | 'isConfigured'>): boolean {
  return state.isConfigured || Boolean(state.apiKey)
}

export const useAuthStore = create<AuthState>()((set) => ({
  apiKey: null,
  hasEncrypted: true, // Managed by OS natively
  isConfigured: false,
  jinaApiKey: null,
  jinaIsConfigured: false,
  hydrationStatus: 'idle',
  hydrationError: null,
  credentialState: 'not-configured',
  credentialStorageMode: 'unavailable',
  credentialFailureCode: null,
  credentialSafeMessage: null,
  veniceLastValidationStatus: 'not-configured',
  veniceLastValidationAt: null,
  jinaLastValidationStatus: 'not-configured',
  jinaLastValidationAt: null,
  providerLastValidationStatus: {},
  providerLastValidationAt: {},
  configuredProviders: {},

  checkConfiguration: async () => {
    set({ hydrationStatus: 'checking', hydrationError: null })
    const providerIds = Object.keys(PROVIDER_REGISTRY) as ProviderId[]
    try {
      const previousConfigured = useAuthStore.getState().isConfigured
      const credentialStatus = await desktopApiKey.getStatus()
      const configured = credentialStatus.configured
      set({
        isConfigured: configured,
        credentialState: credentialStatus.state,
        credentialStorageMode: credentialStatus.storageMode,
        credentialFailureCode: credentialStatus.failureCode ?? null,
        credentialSafeMessage: credentialStatus.safeMessage ?? null,
      })
      if (configured !== previousConfigured) void invalidateModelQueries()

      const jinaConfigured = await desktopJinaApiKey.isConfigured()
      set({ jinaIsConfigured: jinaConfigured })

      await desktopProviderSettings.get()
      const providerConfigs = await Promise.all(
        providerIds.map((id) =>
          requiresStructuredCredential(id)
            ? desktopProviderCredential.isConfigured(id)
            : desktopProviderApiKey.isConfigured(id),
        ),
      )
      const configuredProviders = providerIds.reduce((acc, id, index) => {
        acc[id] = providerConfigs[index]
        return acc
      }, {} as Record<string, boolean>)
      set({ configuredProviders, hydrationStatus: 'ready', hydrationError: null })
    } catch (error) {
      set({ hydrationStatus: 'error', hydrationError: redactErrorMessage(error) })
    }
  },

  setApiKey: async (key): Promise<SetApiKeyOutcome> => {
    if (typeof key !== "string" || key.trim().length === 0) {
      return { stored: false, code: "INVALID_INPUT", safeMessage: "Enter a Venice API key before saving." }
    }
    const result = await desktopApiKey.set(key)
    if (!result.ok) {
      set({
        credentialFailureCode: result.code,
        credentialSafeMessage: result.safeMessage,
      })
      return { stored: false, code: result.code, safeMessage: result.safeMessage }
    }
    // Storage succeeded — record the configuration immediately so the
    // UI shows "key stored" before we even attempt Venice validation.
    set({
      isConfigured: true,
      apiKey: null,
      credentialState: 'configured',
      credentialStorageMode: result.storageMode,
      credentialFailureCode: null,
      credentialSafeMessage: null,
    })
    useModelCatalogRuntimeStore.getState().reset()
    await invalidateModelQueries()

    const validationStatus = await runVeniceValidationAndApply(set)
    if (validationStatus === "valid") {
      return { stored: true, validation: "valid" }
    }
    // runVeniceValidationAndApply returns a wide ApiKeyValidationStatus;
    // for the typed outcome we surface the three post-save classes the
    // dialog differentiates (invalid, network-error, unknown). Other
    // values (not-configured / configured-not-validated / bridge-error)
    // are reported as "unknown" to the caller — the dialog does not
    // distinguish them in the success path.
    if (validationStatus === "invalid" || validationStatus === "network-error" || validationStatus === "unknown") {
      return { stored: true, validation: validationStatus }
    }
    return { stored: true, validation: "unknown" }
  },

  validateStoredVeniceKey: async () => {
    return await runVeniceValidationAndApply(set)
  },

  clearApiKey: async () => {
    const result = await desktopApiKey.delete()
    if (!result.ok) throw new Error(result.safeMessage)
    set({
      isConfigured: false,
      apiKey: null,
      credentialState: 'not-configured',
      credentialStorageMode: result.storageMode,
      credentialFailureCode: null,
      credentialSafeMessage: null,
      veniceLastValidationStatus: 'not-configured',
      veniceLastValidationAt: null,
    })
    useModelCatalogRuntimeStore.getState().reset()
    await invalidateModelQueries()
  },

  setJinaApiKey: async (key) => {
    const result = await desktopJinaApiKey.set(key)
    if (!result.ok) {
      throw new Error("Failed to save Jina API key.")
    }
    set({ jinaIsConfigured: true, jinaApiKey: null })
  },

  clearJinaApiKey: async () => {
    await desktopJinaApiKey.delete()
    set({ jinaIsConfigured: false, jinaApiKey: null, jinaLastValidationStatus: 'not-configured', jinaLastValidationAt: null })
  },

  setProviderApiKey: async (providerId, key) => {
    const result = await desktopProviderApiKey.set(providerId, key)
    if (!result.ok) {
      throw new Error(`Failed to save API key for ${providerId}.`)
    }
    set((s) => ({
      configuredProviders: { ...s.configuredProviders, [providerId]: true }
    }))
  },

  clearProviderApiKey: async (providerId) => {
    await desktopProviderApiKey.delete(providerId)
    set((s) => ({
      configuredProviders: { ...s.configuredProviders, [providerId]: false },
      providerLastValidationStatus: { ...s.providerLastValidationStatus, [providerId]: 'not-configured' },
      providerLastValidationAt: { ...s.providerLastValidationAt, [providerId]: null },
    }))
  },

  setProviderCredential: async (providerId, credential) => {
    const result = await desktopProviderCredential.set(providerId, credential)
    if (!result.ok) {
      throw new Error(`Failed to save credential for ${providerId}: ${result.error ?? 'unknown error'}`)
    }
    set((s) => ({
      configuredProviders: { ...s.configuredProviders, [providerId]: true }
    }))
  },

  clearProviderCredential: async (providerId) => {
    const result = await desktopProviderCredential.delete(providerId)
    if (!result.ok) {
      throw new Error(`Failed to clear credential for ${providerId}: ${result.error ?? 'unknown error'}`)
    }
    set((s) => ({
      configuredProviders: { ...s.configuredProviders, [providerId]: false },
      providerLastValidationStatus: { ...s.providerLastValidationStatus, [providerId]: 'not-configured' },
      providerLastValidationAt: { ...s.providerLastValidationAt, [providerId]: null },
    }))
  },

  recordProviderValidation: (providerId, status, at) => {
    const timestamp = at ?? new Date().toISOString()
    set((s) => ({
      providerLastValidationStatus: { ...s.providerLastValidationStatus, [providerId]: status },
      providerLastValidationAt: { ...s.providerLastValidationAt, [providerId]: timestamp },
    }))
  },

  recordJinaValidation: (status, at) => {
    const timestamp = at ?? new Date().toISOString()
    set({ jinaLastValidationStatus: status, jinaLastValidationAt: timestamp })
  },
}))

/** Runs Venice validation against the currently stored key and applies the
 *  result to the auth store. Returns the normalized validation status.
 *
 *  Behaviour rules (P1-003):
 *  - "invalid" (provider auth rejected) — the key stays stored. The
 *    product policy is explicit: the user can re-test or deliberately
 *    delete via the dialog. We no longer silently roll back storage.
 *  - "network-error" — the key stays stored; UI says "saved, offline".
 *  - "unknown" — the key stays stored; UI says "couldn't verify".
 *  - "valid" — refresh model catalog, mark connected.
 */
async function runVeniceValidationAndApply(
  set: (partial: Partial<AuthState> | ((state: AuthState) => Partial<AuthState>)) => void,
): Promise<ApiKeyValidationStatus> {
  const verification = await desktopApiKey.test()
  const timestamp = new Date().toISOString()
  if (verification.ok) {
    set({
      credentialFailureCode: null,
      credentialSafeMessage: null,
      veniceLastValidationStatus: 'valid',
      veniceLastValidationAt: timestamp,
    })
    return 'valid'
  }
  const kind = verification.connectivity?.kind
  const code: CredentialFailureCode = kind === 'invalid-api-key'
    ? 'PROVIDER_AUTH_REJECTED'
    : kind === 'network-failure' || kind === 'bridge-unavailable'
      ? 'NETWORK_ERROR'
      : 'UNKNOWN_ERROR'
  const connectivitySafeMessage = verification.connectivity && !verification.connectivity.ok
    ? verification.connectivity.safeMessage
    : undefined
  const safeMessage = connectivitySafeMessage
    ?? (code === 'PROVIDER_AUTH_REJECTED'
      ? 'Venice rejected this API key. Check the key and try again.'
      : code === 'NETWORK_ERROR'
        ? 'The key was stored, but Venice could not be reached. Check the network and retry.'
        : 'The key was stored, but Venice connectivity could not be verified.')
  const validationStatus: ApiKeyValidationStatus = code === 'PROVIDER_AUTH_REJECTED'
    ? 'invalid'
    : code === 'NETWORK_ERROR'
      ? 'network-error'
      : 'unknown'
  set({
    credentialFailureCode: code,
    credentialSafeMessage: safeMessage,
    veniceLastValidationStatus: validationStatus,
    veniceLastValidationAt: timestamp,
  })
  return validationStatus
}
