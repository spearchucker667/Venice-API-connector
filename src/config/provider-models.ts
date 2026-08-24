import type { VeniceModel } from '../types/venice'
import { ProviderId } from '../types/provider'
import { useSettingsStore } from '../stores/settings-store'

// A static catalog of fallback models mapped to their respective providers.
// These are mocked into the VeniceModel format so the UI components can seamlessly
// render them in the model dropdowns and capability resolvers.

// We wrap the VeniceModel with a local type property so we can filter by ?type=text|image
export type FallbackModelDef = VeniceModel & {
  _type: 'text' | 'image'
  lifecycle?: import('../types/provider').ProviderModelLifecycle
  retirementDate?: string
}

export interface FallbackCatalogStatus {
  source: 'live' | 'bundled-static'
  stale: boolean
  diagnostic: string | null
}

export function getFallbackCatalogStatus(providerId: ProviderId): FallbackCatalogStatus {
  if (providerId === 'venice') return { source: 'live', stale: false, diagnostic: null }
  return {
    source: 'bundled-static',
    stale: true,
    diagnostic: 'Bundled model catalog may be stale; verify the model with the provider before a paid request.',
  }
}

const FALLBACK_MODEL_CATALOG_TIMESTAMP = 0

export const FALLBACK_MODELS: Record<ProviderId, FallbackModelDef[]> = {
  venice: [], // Venice is the primary provider; its models come from the live /models API.
  google_gemini: [
    {
      id: 'google_gemini:gemini-2.5-pro',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'google_gemini',
      _type: 'text',
      model_spec: {
        name: 'Gemini 2.5 Pro',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    }
  ],
  together: [
    {
      id: 'together:meta-llama/Llama-3-70b-chat-hf',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'together',
      _type: 'text',
      model_spec: {
        name: 'Llama 3 70B (Together)',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    },
    {
      id: 'together:black-forest-labs/FLUX.1-schnell-Free',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'together',
      _type: 'image',
      model_spec: {
        name: 'Flux Schnell (Together)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    }
  ],
  groq: [
    {
      id: 'groq:llama3-70b-8192',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'groq',
      _type: 'text',
      model_spec: {
        name: 'Llama 3 70B (Groq)',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    },
    {
      id: 'groq:mixtral-8x7b-32768',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'groq',
      _type: 'text',
      model_spec: {
        name: 'Mixtral 8x7B (Groq)',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    }
  ],
  anthropic: [
    {
      id: 'anthropic:claude-3-5-sonnet-latest',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'anthropic',
      _type: 'text',
      model_spec: {
        name: 'Claude 3.5 Sonnet',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    },
    {
      id: 'anthropic:claude-3-opus-latest',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'anthropic',
      _type: 'text',
      model_spec: {
        name: 'Claude 3 Opus',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    }
  ],
  fireworks: [
    {
      id: 'fireworks:accounts/fireworks/models/llama-v3p1-70b-instruct',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'fireworks',
      _type: 'text',
      model_spec: {
        name: 'Llama 3.1 70B (Fireworks)',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    }
  ],
  replicate: [
    {
      id: 'replicate:black-forest-labs/flux-schnell',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'replicate',
      _type: 'image',
      model_spec: {
        name: 'FLUX Schnell (Replicate)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    }
  ],
  aws_bedrock: [
    {
      id: 'aws_bedrock:openai.gpt-oss-20b',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'aws_bedrock',
      _type: 'text',
      model_spec: {
        name: 'GPT-OSS 20B (Bedrock Mantle)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'aws_bedrock:openai.gpt-oss-120b',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'aws_bedrock',
      _type: 'text',
      model_spec: {
        name: 'GPT-OSS 120B (Bedrock Mantle)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'aws_bedrock:anthropic.claude-3-5-sonnet-20241022-v2:0',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'aws_bedrock',
      _type: 'text',
      model_spec: {
        name: 'Claude 3.5 Sonnet (Bedrock)',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    }
  ],
  google_vertex: [
    {
      id: 'google_vertex:gemini-2.5-flash',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'google_vertex',
      _type: 'text',
      model_spec: {
        name: 'Gemini 2.5 Flash (Vertex Express Mode)',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    },
    {
      id: 'google_vertex:gemini-2.5-pro',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'google_vertex',
      _type: 'text',
      model_spec: {
        name: 'Gemini 2.5 Pro (Vertex Express Mode)',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    }
  ],
  azure_openai: [],
  huggingface: [
    {
      id: 'huggingface:deepseek-ai/DeepSeek-R1:fastest',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'huggingface',
      _type: 'text',
      model_spec: {
        name: 'DeepSeek R1 (HF Inference Providers)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'huggingface:meta-llama/Meta-Llama-3.1-70B-Instruct:fastest',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'huggingface',
      _type: 'text',
      model_spec: {
        name: 'Llama 3.1 70B Instruct (HF Inference Providers)',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    },
    {
      id: 'huggingface:Qwen/Qwen2.5-72B-Instruct:fastest',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'huggingface',
      _type: 'text',
      model_spec: {
        name: 'Qwen 2.5 72B Instruct (HF Inference Providers)',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    }
  ],
  mistral: [
    {
      id: 'mistral:mistral-large-latest',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'mistral',
      _type: 'text',
      model_spec: {
        name: 'Mistral Large',
        capabilities: { supportsVision: false, supportsFunctionCalling: true },
      }
    }
  ],
  perplexity: [
    {
      id: 'perplexity:llama-3-sonar-large-32k-online',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'perplexity',
      _type: 'text',
      model_spec: {
        name: 'Sonar Large Online',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    }
  ],
  cohere: [
    // Active Command A family (V2 chat API).
    {
      id: 'cohere:command-a-plus-05-2026',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command A Plus (05-2026)',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    },
    {
      id: 'cohere:command-a-03-2025',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command A (03-2025)',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    },
    {
      id: 'cohere:command-r7b-12-2024',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command R7B (12-2024)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'cohere:command-a-translate-08-2025',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command A Translate (08-2025)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'cohere:command-a-reasoning-08-2025',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command A Reasoning (08-2025)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false, supportsReasoning: true },
      }
    },
    {
      id: 'cohere:command-a-vision-07-2025',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command A Vision (07-2025)',
        capabilities: { supportsVision: true, supportsFunctionCalling: true },
      }
    },
    {
      id: 'cohere:command-r-08-2024',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command R (08-2024)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'cohere:command-r-plus-08-2024',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'active',
      _type: 'text',
      model_spec: {
        name: 'Command R Plus (08-2024)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    // Legacy Command family — deprecated/retiring 2025-09-15 per Cohere docs.
    {
      id: 'cohere:command-r-plus',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'deprecated',
      retirementDate: '2025-09-15',
      _type: 'text',
      model_spec: {
        name: 'Command R+ (legacy)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'cohere:command-r',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'deprecated',
      retirementDate: '2025-09-15',
      _type: 'text',
      model_spec: {
        name: 'Command R (legacy)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'cohere:command-light',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'deprecated',
      retirementDate: '2025-09-15',
      _type: 'text',
      model_spec: {
        name: 'Command Light (legacy)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    },
    {
      id: 'cohere:command',
      object: 'model',
      created: FALLBACK_MODEL_CATALOG_TIMESTAMP,
      owned_by: 'cohere',
      lifecycle: 'deprecated',
      retirementDate: '2025-09-15',
      _type: 'text',
      model_spec: {
        name: 'Command (legacy)',
        capabilities: { supportsVision: false, supportsFunctionCalling: false },
      }
    }
  ]
}

/**
 * Merges live Venice models with models from enabled fallback providers.
 * Assigns `owned_by` so the provider adapter can route the request correctly.
 */
export function getEnabledProviderModels(type?: string): VeniceModel[] {
  const enabledProviders = useSettingsStore.getState().enabledProviders
  const models: VeniceModel[] = []

  const normalizedType = type === 'chat' ? 'text' : type;

  if (normalizedType && normalizedType !== 'text' && normalizedType !== 'image') return []

  for (const [providerId, modelsForProvider] of Object.entries(FALLBACK_MODELS)) {
    if (enabledProviders[providerId]) {
      const catalogStatus = getFallbackCatalogStatus(providerId as ProviderId)
      for (const m of modelsForProvider) {
        if (!normalizedType || m._type === normalizedType) {
          const baseName = m.model_spec?.name || m.id
          const lifecycleWarning = m.lifecycle && m.lifecycle !== 'active'
            ? ` · ${m.lifecycle}${m.retirementDate ? ` (retires ${m.retirementDate})` : ''}`
            : ''
          const description = [
            catalogStatus.diagnostic ?? m.model_spec?.description,
            lifecycleWarning || undefined,
          ].filter(Boolean).join('')
          models.push({
            ...m,
            // ModelInfo-compatible display fields ensure every production
            // picker surfaces the bundled-catalog warning.
            name: `${baseName}${lifecycleWarning} · bundled static; verify before paid request`,
            source: 'fallback',
            isFallback: true,
            model_spec: {
              ...m.model_spec,
              name: `${baseName}${lifecycleWarning} · bundled static; verify before paid request`,
              description: description || undefined,
            },
          } as VeniceModel)
        }
      }
    }
  }

  return models
}
