// @vitest-environment node

import { describe, it, expect, beforeEach, vi } from 'vitest'
import os from 'os'

vi.mock("electron", () => ({
  app: {
    getPath: vi.fn(() => os.tmpdir()),
  },
  safeStorage: {
    isEncryptionAvailable: vi.fn(() => true),
    encryptString: vi.fn((val: string) => Buffer.from(`enc:${val}`)),
    decryptString: vi.fn((buf: Buffer) => buf.toString("utf-8").replace("enc:", "")),
  },
}));

vi.mock("./windowsCredentialStore", () => ({
  isWindowsCredentialStoreAvailable: vi.fn(() => false),
  readWindowsCredential: vi.fn(),
  writeWindowsCredential: vi.fn(),
  deleteWindowsCredential: vi.fn(),
}));

import {
  setProviderCredential,
  getProviderCredential,
  deleteProviderCredential,
  isProviderCredentialConfigured,
  __clearCacheForTests,
} from './secureStore'

describe('structured provider credentials', () => {
  beforeEach(() => {
    __clearCacheForTests()
  })

  it('round-trips an Azure config', () => {
    const cred = {
      providerId: 'azure_openai' as const,
      resourceName: 'res',
      deploymentName: 'dep',
      apiVersion: '2024-10-21',
      apiKey: 'key',
    }
    setProviderCredential('azure_openai', cred)
    const stored = getProviderCredential('azure_openai')
    expect(stored).toEqual(cred)
    expect(isProviderCredentialConfigured('azure_openai')).toBe(true)
    deleteProviderCredential('azure_openai')
    expect(isProviderCredentialConfigured('azure_openai')).toBe(false)
  })
})
