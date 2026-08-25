import { translateRuntime } from "../i18n/runtimeTranslator";
export type ProviderId =
  | "venice"
  | "together"
  | "groq"
  | "fireworks"
  | "replicate"
  | "aws_bedrock"
  | "google_vertex"
  | "google_gemini"
  | "azure_openai"
  | "huggingface"
  | "mistral"
  | "anthropic"
  | "perplexity"
  | "cohere";

export interface ProviderConfig {
  id: ProviderId;
  enabled: boolean;
  label: string;
  description?: string;
  // For UI settings, to indicate if the credentials exist in the main process
  hasCredential?: boolean;
}

export interface ProviderDefinition {
  id: ProviderId;
  label: string;
  description: string;
  docsUrl?: string;
  supportedTypes: Array<
    "chat" | "image" | "video" | "audio" | "embeddings" | "rerank" | "vision"
  >;
  unavailable?: boolean;
}

export type ProviderFeature =
  "chat" | "image" | "video" | "audio" | "embeddings" | "rerank" | "vision";

export interface AzureOpenAiConfig {
  resourceName: string;
  deploymentName: string;
  apiVersion: string;
  apiKey: string;
}

export interface AwsBedrockConfig {
  region: string;
  apiKey: string;
}

export type GoogleVertexConfig =
  | { authMode: "express"; apiKey: string }
  | { authMode: "full"; projectId: string; location: string; credentialsJson: string };

export type ProviderCredential =
  | ({ providerId: "azure_openai" } & AzureOpenAiConfig)
  | ({ providerId: "aws_bedrock" } & AwsBedrockConfig)
  | ({ providerId: "google_vertex" } & GoogleVertexConfig);

/** Providers whose credential storage is structured rather than a single API key. */
export const STRUCTURED_CREDENTIAL_PROVIDER_IDS = [
  "azure_openai",
  "aws_bedrock",
  "google_vertex",
] as const satisfies readonly ProviderId[];

export function requiresStructuredCredential(providerId: ProviderId): boolean {
  return (STRUCTURED_CREDENTIAL_PROVIDER_IDS as readonly ProviderId[]).includes(providerId);
}

export interface ProviderCapability {
  feature: ProviderFeature;
  route: string;
  implemented: boolean;
  modelDiscovery: "live" | "static" | "deployment" | "none";
}

/** Lifecycle state of a provider model as understood by Venice Forge.
 *  Used to drive picker warnings, fallback eligibility, and deprecation UI. */
export type ProviderModelLifecycle =
  | "active"
  | "deprecated"
  | "retiring"
  | "unavailable"
  | "unknown";

export interface ProviderModel {
  id: string;
  name: string;
  provider: ProviderId;
  capabilities: Partial<Record<ProviderFeature, boolean>>;
  lifecycle: ProviderModelLifecycle;
  retirementDate?: string;
  region?: string;
  deploymentRequired?: boolean;
  contextLength?: number;
  pricing?: { input?: number; output?: number };
  toolSupport?: boolean;
  structuredOutput?: boolean;
  providerAvailability?: string[];
}

export interface ProviderModelCatalogResult {
  providerId: ProviderId;
  models: ProviderModel[];
  fetchedAt: number;
  stale: boolean;
  source: "live" | "cached" | "bundled";
  error?: string;
}

/** Normalized provider failure taxonomy. Provider-specific errors are mapped
 *  into this shape before crossing the IPC boundary so the renderer never has
 *  to parse raw upstream envelopes. */
export type ProviderFailureKind =
  | "authentication"
  | "authorization"
  | "configuration"
  | "model-not-found"
  | "deployment-not-found"
  | "rate-limit"
  | "quota"
  | "timeout"
  | "network"
  | "provider-unavailable"
  | "invalid-request"
  | "content-policy"
  | "unknown";

/** Canonical endpoint-granular capability contract used by UI, catalogs, routing tests, and diagnostics. */
export const PROVIDER_CAPABILITIES: Record<
  ProviderId,
  readonly ProviderCapability[]
> = {
  venice: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "live",
    },
    {
      feature: "image",
      route: "/images/generations",
      implemented: true,
      modelDiscovery: "live",
    },
    {
      feature: "video",
      route: "/video/queue",
      implemented: true,
      modelDiscovery: "live",
    },
    {
      feature: "audio",
      route: "/audio/queue",
      implemented: true,
      modelDiscovery: "live",
    },
    {
      feature: "embeddings",
      route: "/embeddings",
      implemented: true,
      modelDiscovery: "live",
    },
  ],
  together: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
    {
      feature: "image",
      route: "/images/generations",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  groq: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  fireworks: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  google_gemini: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  mistral: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  anthropic: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  perplexity: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  replicate: [
    {
      feature: "image",
      route: "/predictions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  aws_bedrock: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "live",
    },
  ],
  google_vertex: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
  azure_openai: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "deployment",
    },
  ],
  huggingface: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "live",
    },
  ],
  cohere: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: true,
      modelDiscovery: "static",
    },
  ],
};

function implementedFeatures(providerId: ProviderId): ProviderFeature[] {
  return PROVIDER_CAPABILITIES[providerId]
    .filter((capability) => capability.implemented)
    .map((capability) => capability.feature);
}

export const PROVIDER_REGISTRY: Record<ProviderId, ProviderDefinition> = {
  venice: {
    id: "venice",
    // i18n-allow-next-line: provider-defined proper name
    label: "Venice AI",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.primaryPrivateLocalFirstMultimodalPlatform",
        "Primary, private, local-first multimodal platform.",
      );
    },
    supportedTypes: implementedFeatures("venice"),
  },
  together: {
    id: "together",
    // i18n-allow-next-line: provider-defined proper name
    label: "Together AI",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.fastOpenSourceModelInference",
        "Fast, open-source model inference.",
      );
    },
    supportedTypes: implementedFeatures("together"),
  },
  groq: {
    id: "groq",
    // i18n-allow-next-line: provider-defined proper name
    label: "Groq",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.ultraFastLpuInferenceEngine",
        "Ultra-fast LPU inference engine.",
      );
    },
    supportedTypes: implementedFeatures("groq"),
  },
  fireworks: {
    id: "fireworks",
    // i18n-allow-next-line: provider-defined proper name
    label: "Fireworks AI",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.highPerformanceLlmApis",
        "High-performance LLM APIs.",
      );
    },
    supportedTypes: implementedFeatures("fireworks"),
  },
  replicate: {
    id: "replicate",
    // i18n-allow-next-line: provider-defined proper name
    label: "Replicate",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.replicateAsyncMediaPredictions",
        "Async media generation via Replicate predictions.",
      );
    },
    supportedTypes: implementedFeatures("replicate"),
  },
  aws_bedrock: {
    id: "aws_bedrock",
    // i18n-allow-next-line: provider-defined proper name
    label: "AWS Bedrock",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.awsBedrockMantleOpenAiCompatibleInference",
        "AWS Bedrock Mantle OpenAI-compatible inference.",
      );
    },
    supportedTypes: implementedFeatures("aws_bedrock"),
  },
  google_vertex: {
    id: "google_vertex",
    // i18n-allow-next-line: provider-defined proper name
    label: "Google Vertex AI",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.googleVertexAiExpressModeApiKey",
        "Google Vertex AI Express Mode (API-key authentication).",
      );
    },
    supportedTypes: implementedFeatures("google_vertex"),
  },
  google_gemini: {
    id: "google_gemini",
    // i18n-allow-next-line: provider-defined proper name
    label: "Google Gemini (Developer API)",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.geminiDeveloperApiAiStudio",
        "Gemini Developer API (AI Studio).",
      );
    },
    supportedTypes: implementedFeatures("google_gemini"),
  },
  azure_openai: {
    id: "azure_openai",
    // i18n-allow-next-line: provider-defined proper name
    label: "Azure OpenAI",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.azureOpenAiDeploymentBasedChatCompletions",
        "Azure OpenAI deployment-based chat completions.",
      );
    },
    supportedTypes: implementedFeatures("azure_openai"),
  },
  huggingface: {
    id: "huggingface",
    // i18n-allow-next-line: provider-defined proper name
    label: "Hugging Face",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.huggingFaceOpenSourceInferenceProviders",
        "Open-source model inference via Hugging Face Inference Providers.",
      );
    },
    supportedTypes: implementedFeatures("huggingface"),
  },
  mistral: {
    id: "mistral",
    // i18n-allow-next-line: provider-defined proper name
    label: "Mistral API",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.mistralAiModelsAndEndpoints",
        "Mistral AI models and endpoints.",
      );
    },
    supportedTypes: implementedFeatures("mistral"),
  },
  anthropic: {
    id: "anthropic",
    // i18n-allow-next-line: provider-defined proper name
    label: "Anthropic API",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.claudeAndOtherSafeFoundationModels",
        "Claude and other safe foundation models.",
      );
    },
    supportedTypes: implementedFeatures("anthropic"),
  },
  perplexity: {
    id: "perplexity",
    // i18n-allow-next-line: provider-defined proper name
    label: "Perplexity API",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.searchGroundedAndFastLlmApis",
        "Search-grounded and fast LLM APIs.",
      );
    },
    supportedTypes: implementedFeatures("perplexity"),
  },
  cohere: {
    id: "cohere",
    // i18n-allow-next-line: provider-defined proper name
    label: "Cohere",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.cohereEnterpriseReadyMultilingualModels",
        "Enterprise-ready multilingual models.",
      );
    },
    supportedTypes: implementedFeatures("cohere"),
  },
};

/** Providers intentionally deferred in this release. They accept no keys or traffic. */
export const DEFERRED_PROVIDER_IDS: readonly ProviderId[] = [] as const;

/** Non-primary providers with implemented adapters, catalogs, and secure key custody. */
export const AVAILABLE_FALLBACK_PROVIDER_IDS = Object.values(PROVIDER_REGISTRY)
  .filter(
    (provider) => provider.id !== "venice" && provider.unavailable !== true,
  )
  .map((provider) => provider.id);
