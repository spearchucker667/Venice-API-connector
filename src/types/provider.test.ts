import { describe, it, expect } from 'vitest'
import { PROVIDER_CAPABILITIES } from './provider'
import type { ProviderCredential } from './provider'

describe('ProviderCredential types', () => {
  it('accepts a valid Azure config', () => {
    const cred: ProviderCredential = {
      providerId: 'azure_openai',
      resourceName: 'my-resource',
      deploymentName: 'gpt-4o',
      apiVersion: '2024-10-21',
      apiKey: 'secret',
    }
    expect(cred.resourceName).toBe('my-resource')
  })
})

describe('ProviderCapability modelDiscovery', () => {
  it('allows deployment discovery mode for azure_openai', () => {
    expect(PROVIDER_CAPABILITIES.azure_openai).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feature: 'chat', modelDiscovery: 'deployment' })
      ])
    )
  })
})
