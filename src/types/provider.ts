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
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
}

export interface GoogleVertexConfig {
  projectId: string;
  location: string;
  apiKey?: string;
}

export interface HuggingFaceConfig {
  apiKey: string;
}

export interface ReplicateConfig {
  apiToken: string;
}

export interface CohereConfig {
  apiKey: string;
}

export type ProviderCredential =
  | ({ providerId: "azure_openai" } & AzureOpenAiConfig)
  | ({ providerId: "aws_bedrock" } & AwsBedrockConfig)
  | ({ providerId: "google_vertex" } & GoogleVertexConfig)
  | ({ providerId: "huggingface" } & HuggingFaceConfig)
  | ({ providerId: "replicate" } & ReplicateConfig)
  | ({ providerId: "cohere" } & CohereConfig);

export interface ProviderCapability {
  feature: ProviderFeature;
  route: string;
  implemented: boolean;
  modelDiscovery: "live" | "static" | "deployment" | "none";
}

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
  replicate: [],
  aws_bedrock: [],
  google_vertex: [],
  azure_openai: [
    {
      feature: "chat",
      route: "/chat/completions",
      implemented: false,
      modelDiscovery: "deployment",
    },
  ],
  huggingface: [],
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
        "runtimeGenerated.types.provider.metadata.notImplementedNoCredentialsOrRequestsAreAccepted",
        "Not implemented. No credentials or requests are accepted.",
      );
    },
    supportedTypes: implementedFeatures("replicate"),
    unavailable: true,
  },
  aws_bedrock: {
    id: "aws_bedrock",
    // i18n-allow-next-line: provider-defined proper name
    label: "AWS Bedrock",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.notImplementedNoCredentialsOrRequestsAreAccepted",
        "Not implemented. No credentials or requests are accepted.",
      );
    },
    supportedTypes: implementedFeatures("aws_bedrock"),
    unavailable: true,
  },
  google_vertex: {
    id: "google_vertex",
    // i18n-allow-next-line: provider-defined proper name
    label: "Google Vertex AI",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.notImplementedNoCredentialsOrRequestsAreAccepted",
        "Not implemented. No credentials or requests are accepted.",
      );
    },
    supportedTypes: implementedFeatures("google_vertex"),
    unavailable: true,
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
        "runtimeGenerated.types.provider.metadata.notImplementedNoCredentialsOrRequestsAreAccepted",
        "Not implemented. No credentials or requests are accepted.",
      );
    },
    supportedTypes: implementedFeatures("azure_openai"),
    unavailable: true,
  },
  huggingface: {
    id: "huggingface",
    // i18n-allow-next-line: provider-defined proper name
    label: "Hugging Face",
    get description() {
      return translateRuntime(
        "runtimeGenerated.types.provider.metadata.notImplementedNoCredentialsOrRequestsAreAccepted",
        "Not implemented. No credentials or requests are accepted.",
      );
    },
    supportedTypes: implementedFeatures("huggingface"),
    unavailable: true,
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
export const DEFERRED_PROVIDER_IDS = [
  "replicate",
  "aws_bedrock",
  "google_vertex",
  "azure_openai",
  "huggingface",
] as const satisfies readonly ProviderId[];

/** Non-primary providers with implemented adapters, catalogs, and secure key custody. */
export const AVAILABLE_FALLBACK_PROVIDER_IDS = Object.values(PROVIDER_REGISTRY)
  .filter(
    (provider) => provider.id !== "venice" && provider.unavailable !== true,
  )
  .map((provider) => provider.id);
