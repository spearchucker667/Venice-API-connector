import { describe, it, expect } from 'vitest'
import { PROVIDER_CAPABILITIES } from './provider'

describe('ProviderCapability modelDiscovery', () => {
  it('allows deployment discovery mode for azure_openai', () => {
    expect(PROVIDER_CAPABILITIES.azure_openai).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ feature: 'chat', modelDiscovery: 'deployment' })
      ])
    )
  })
})
