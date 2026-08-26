import { describe, it, expect } from 'vitest'


import {
  AVAILABLE_FALLBACK_PROVIDER_IDS,
  DEFERRED_PROVIDER_IDS,
  PROVIDER_CAPABILITIES,
  PROVIDER_REGISTRY,
  type ProviderCredential,
} from '../src/types/provider'
import { providerAdapters } from '../electron/services/providerAdapters'
import { FALLBACK_MODELS } from '../src/config/provider-models'
import { validateProviderCredential } from '../electron/ipc/validation'

function testCredentialFor(providerId: string): ProviderCredential | string {
  switch (providerId) {
    case 'azure_openai':
      return {
        providerId: 'azure_openai',
        resourceName: 'venice-forge-test',
        deploymentName: 'gpt-4o',
        apiVersion: '2024-08-01-preview',
        apiKey: 'test-key',
      }
    case 'aws_bedrock':
      return {
        providerId: 'aws_bedrock',
        region: 'us-east-1',
        apiKey: 'test-key',
      }
    case 'google_vertex':
      return {
        providerId: 'google_vertex',
        authMode: 'express',
        apiKey: 'test-key',
      }
    case 'generic_openai':
      return {
        providerId: 'generic_openai',
        baseUrl: 'https://openrouter.ai/api/v1',
        apiKey: 'test-key',
      }
    case 'replicate':
      // Replicate is registered but routed through a dedicated async prediction
      // lifecycle rather than the generic chat/image adapter.
      return 'test-key'
    default:
      return 'test-key'
  }
}

/** Providers that are intentionally present in the registry but do not expose a
 *  generic adapter because they use a dedicated main-process handler. */
const ADAPTER_EXCLUDED_PROVIDER_IDS: string[] = ['replicate']

describe('Provider Adapters Contract', () => {
  it('should have an adapter for every non-venice provider except dedicated-lifecycle providers', () => {
    const providers = Object.values(PROVIDER_REGISTRY)
      .filter(p => p.id !== 'venice' && !ADAPTER_EXCLUDED_PROVIDER_IDS.includes(p.id))

    for (const provider of providers) {
      expect(providerAdapters).toHaveProperty(provider.id)
      expect(typeof providerAdapters[provider.id]).toBe('function')
    }
  })

  it('keeps deferred providers fail-closed and out of the advertised fallback catalog', () => {
    expect(DEFERRED_PROVIDER_IDS).toEqual([])
    for (const providerId of DEFERRED_PROVIDER_IDS) {
      expect(PROVIDER_REGISTRY[providerId].unavailable).toBe(true)
      expect(FALLBACK_MODELS[providerId]).toEqual([])
    }
  })

  it('gives every advertised fallback provider a real adapter and model catalog', () => {
    for (const providerId of AVAILABLE_FALLBACK_PROVIDER_IDS) {
      expect(PROVIDER_REGISTRY[providerId].unavailable).not.toBe(true)
      if (!ADAPTER_EXCLUDED_PROVIDER_IDS.includes(providerId)) {
        expect(typeof providerAdapters[providerId]).toBe('function')
      }
      // Deployment-discovered providers (Azure) do not ship a static catalog;
      // the deployment name is the authoritative model identity.
      const discovery = PROVIDER_CAPABILITIES[providerId].find((c) => c.implemented)?.modelDiscovery
      if (discovery !== 'deployment') {
        expect(FALLBACK_MODELS[providerId].length).toBeGreaterThan(0)
      }
    }
  })

  it('routes every advertised fallback capability through a real adapter and matching catalog type', () => {
    for (const providerId of AVAILABLE_FALLBACK_PROVIDER_IDS) {
      for (const capability of PROVIDER_CAPABILITIES[providerId]) {
        expect(capability.implemented).toBe(true)
        expect(PROVIDER_REGISTRY[providerId].supportedTypes).toContain(capability.feature)
        if (!ADAPTER_EXCLUDED_PROVIDER_IDS.includes(providerId)) {
          expect(providerAdapters[providerId]('model', testCredentialFor(providerId), capability.route, {})).not.toBeNull()
        }
        // Deployment-discovered providers have no static catalog; the adapter is
        // the only source of truth for model routing.
        if (capability.modelDiscovery === 'deployment') continue
        const expectedType = capability.feature === 'chat' ? 'text' : capability.feature
        expect(FALLBACK_MODELS[providerId].some((model) => model._type === expectedType)).toBe(true)
      }
    }
  })

  it('does not advertise deferred or unsupported endpoint capabilities', () => {
    for (const providerId of DEFERRED_PROVIDER_IDS) {
      const implemented = PROVIDER_CAPABILITIES[providerId].filter((c) => c.implemented)
      expect(implemented).toEqual([])
      expect(PROVIDER_REGISTRY[providerId].supportedTypes).toEqual([])
    }
    expect(PROVIDER_REGISTRY.groq.supportedTypes).toEqual(['chat'])
    expect(PROVIDER_REGISTRY.fireworks.supportedTypes).toEqual(['chat'])
    expect(PROVIDER_REGISTRY.google_gemini.supportedTypes).toEqual(['chat'])
    expect(PROVIDER_REGISTRY.mistral.supportedTypes).toEqual(['chat'])
    expect(PROVIDER_REGISTRY.anthropic.supportedTypes).toEqual(['chat'])
    expect(PROVIDER_REGISTRY.cohere.supportedTypes).toEqual(['chat'])
  })

  it('rejects credential storage for deferred providers', () => {
    for (const providerId of DEFERRED_PROVIDER_IDS) {
      expect(() => validateProviderCredential(providerId, { apiKey: 'test' })).toThrow()
    }
  })

  it('has no duplicate provider IDs in the registry', () => {
    const ids = Object.values(PROVIDER_REGISTRY).map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('only includes known, available providers in the fallback list', () => {
    for (const providerId of AVAILABLE_FALLBACK_PROVIDER_IDS) {
      expect(PROVIDER_REGISTRY[providerId]).toBeDefined()
      expect(PROVIDER_REGISTRY[providerId].unavailable).not.toBe(true)
    }
  })

  it('does not list deferred providers as fallback-eligible', () => {
    for (const providerId of DEFERRED_PROVIDER_IDS) {
      expect(AVAILABLE_FALLBACK_PROVIDER_IDS).not.toContain(providerId)
    }
  })

  it('matches implemented capabilities to the registry supportedTypes for every provider', () => {
    for (const [providerId, capabilities] of Object.entries(PROVIDER_CAPABILITIES)) {
      const implemented = capabilities.filter((c) => c.implemented).map((c) => c.feature)
      const supported = PROVIDER_REGISTRY[providerId as keyof typeof PROVIDER_REGISTRY].supportedTypes
      expect(new Set(implemented)).toEqual(new Set(supported))
    }
  })

  // We could add more contract tests per provider here
})
