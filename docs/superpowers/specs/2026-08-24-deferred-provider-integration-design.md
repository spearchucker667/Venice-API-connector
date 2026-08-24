# Deferred Provider Integration Design

**Date:** 2026-08-24  
**Topic:** Implement Replicate, AWS Bedrock, Google Vertex AI, Azure OpenAI, Hugging Face, and Cohere as production fallback providers in Venice Forge.  
**Governing work order:** User-supplied 25-phase mission brief (treated as the approved product specification).  
**Repository state:** `main` @ `f14c31b1cba6185fbff82c864ec7ea7da53e5552`, clean working tree.

---

## 1. Scope and Decomposition

The project delivers six independent provider vertical slices. Each slice must pass the same acceptance gate before the provider is removed from `DEFERRED_PROVIDER_IDS`:

1. Typed provider-specific configuration and credential custody.
2. Validated model catalog or live discovery contract.
3. Provider adapter implementing every declared capability route.
4. Request transformation, transport, streaming (where declared), and response normalization.
5. Provider-specific error normalization and redaction.
6. Capability-aware fallback routing eligibility.
7. Connection/configuration test.
8. Settings UI with accurate capability badges and secure credential entry.
9. i18n coverage for all new user-facing strings.
10. Automated tests for adapter, settings store, IPC validation, and contract verifier.
11. Updated documentation and provider matrix.

Providers are implemented in **priority order** that front-loads quick wins and de-risks cloud-provider complexity:

1. **Cohere** — partial adapter already exists; audit and complete chat, then add embeddings/rerank if consumers exist.
2. **Hugging Face** — serverless Inference API has a clear REST contract; limited to chat/text for the initial slice.
3. **Azure OpenAI** — deployment-based chat; API-key auth first, Entra ID documented as future work.
4. **Replicate** — async predictions for image/video; reuse existing background-task infrastructure.
5. **AWS Bedrock** — AWS SDK SigV4 `Converse`/`ConverseStream`; chat-only initial slice.
6. **Google Vertex AI** — GCP service-account or OAuth path; `generateContent`/`streamGenerateContent`; chat-only initial slice.

This ordering lets the contract verifier and routing layer mature with simpler providers before cloud signing and async lifecycles are added.

---

## 2. Shared Infrastructure Changes

### 2.1 Provider Configuration Type Extension

`src/types/provider.ts` retains `ProviderCapability` (`feature`, `route`, `implemented`, `modelDiscovery`). A new typed configuration area is added for providers that need more than a single API key:

```ts
export interface AzureOpenAiConfig {
  resourceName: string;      // non-secret
  deploymentName: string;    // non-secret
  apiVersion: string;        // non-secret, default "2024-10-21"
  apiKey: string;            // secret
}

export interface AwsBedrockConfig {
  region: string;            // non-secret
  accessKeyId: string;       // secret
  secretAccessKey: string;   // secret
  sessionToken?: string;     // secret
}

export interface GoogleVertexConfig {
  projectId: string;         // non-secret
  location: string;          // non-secret, e.g. "us-central1"
  apiKey?: string;           // secret (API-key auth path)
  serviceAccountJson?: string; // secret (OAuth service-account path)
}

export interface HuggingFaceConfig {
  apiKey: string;            // secret
}

export interface ReplicateConfig {
  apiToken: string;          // secret
}

export interface CohereConfig {
  apiKey: string;            // secret
}
```

These config types are consumed by the IPC layer, the secure store, and the adapter layer. They are **never** persisted as a single flattened string in renderer state.

### 2.2 Secure Credential Storage for Structured Credentials

`electron/services/secureStore.ts` currently stores one encrypted string per provider via `setProviderApiKey`. For structured cloud credentials we introduce `setProviderCredential(providerId, credential)` and `getProviderCredential(providerId)` that encrypt/decrypt a JSON-serialized credential object using the same `safeStorage` path. The renderer continues to see only an opaque `configured: boolean` flag.

Rules:
- Secret fields are encrypted individually or the whole object is encrypted; the on-disk format stores the encrypted blob under a namespaced key (`${providerId}Credential`).
- Non-secret routing configuration may also be stored encrypted for simplicity, or in `provider-settings.json` if the team prefers separation. This design keeps it encrypted to avoid accidental leakage.
- AWS session tokens, Google service-account JSON, and Azure API keys are all treated as secrets.

### 2.3 Adapter Contract Evolution

`electron/services/providerAdapters.ts` keeps the `ProviderRoute` shape but extends it so an adapter can return a factory that receives the full typed credential object, not only a single API-key string:

```ts
type AdapterFn = (
  model: string,
  credential: string | Record<string, unknown>,
  originalPath: string,
  originalBody: Record<string, unknown>,
  profileId?: string,
) => ProviderRoute | null;
```

For backward compatibility, simple-key providers (Together, Groq, etc.) continue to receive a string. New cloud providers receive their typed credential object. A small credential dispatcher in `resolveProviderRoute` decides which form to pass.

Adapters also gain an optional `testConnection` factory so each provider can define a cheap, safe credential-validation request.

### 2.4 Model Catalog Strategy

`src/config/provider-models.ts` currently holds static `FALLBACK_MODELS`. The strategy per provider:

- **Cohere:** static catalog for `command-r-plus`, `command-r`, `command-light`, plus embedding/rerank models if those capabilities are implemented.
- **Hugging Face:** static catalog of a small number of chat/instruct models known to work through the serverless Inference API (e.g. `meta-llama/Llama-3.1-70B-Instruct`).
- **Azure OpenAI:** static catalog is intentionally **empty**; models are deployment-defined. A new `"deployment"` model-discovery mode is added so the UI can prompt for deployment name instead of selecting from a catalog. Capability declaration uses `modelDiscovery: "deployment"`.
- **Replicate:** static catalog of image/video models with explicit version IDs, or `modelDiscovery: "live"` against `/models` if the adapter supports it. Initial slice uses a curated static list.
- **AWS Bedrock:** static catalog of Anthropic Claude and Amazon Nova models available in Bedrock; users are warned that regional availability varies.
- **Google Vertex:** static catalog of Gemini models on Vertex (`gemini-1.5-pro`, `gemini-1.5-flash`); project/location configured separately.

A new `modelDiscovery` value `"deployment"` is added to `ProviderCapability` for Azure OpenAI.

### 2.5 Connection Testing

A new IPC channel `providerApiKey:test` accepts `{ providerId }` and invokes the provider-specific `testConnection` factory. Each test uses the cheapest safe request (list models, no-op chat with tiny max_tokens, or deployment metadata). Tests return `{ ok, status, message, connectivity }` in the existing `ApiConnectivityStatus` shape.

---

## 3. Provider-Specific Designs

### 3.1 Cohere

**Capabilities:** chat (initial), embeddings and rerank only if end-to-end consumers exist at implementation time.

**Adapter:** audit existing `/v2/chat` adapter. Fix message role mapping, tool-call support, finish reason, and usage normalization. Add tests for current V2 SSE events (`content-delta`, `message-end`).

**Models:** `command-r-plus`, `command-r`, `command-light`.

**Credential:** single API key.

**Tests:** adapter request/response/stream; settings-store enablement; IPC validation; contract verifier.

### 3.2 Hugging Face

**Capabilities:** chat via serverless Inference API (`https://api-inference.huggingface.co/models/{model}`) or the newer Inference Providers/OpenAI-compatible endpoint. The implemented contract is **serverless Inference API with chat templates**; this is documented explicitly so the integration does not claim undefined behavior.

**Adapter:** route to `api-inference.huggingface.co/v1/{model}` with `Authorization: Bearer {apiKey}`. Normalize the response into OpenAI-compatible `choices/message/usage` shape. Streaming uses SSE if supported by the endpoint.

**Models:** `meta-llama/Llama-3.1-70B-Instruct`, `mistralai/Mistral-7B-Instruct-v0.3`.

**Credential:** single API key.

### 3.3 Azure OpenAI

**Capabilities:** chat.

**Adapter:** build `https://{resourceName}.openai.azure.com/openai/deployments/{deploymentName}/{route}?api-version={apiVersion}`. Route is `chat/completions`. Auth header is `api-key: {apiKey}`. Validate resource name against strict HTTPS host policy (no IP, no localhost, no custom scheme). Normalize streaming and non-streaming responses.

**Models:** deployment-defined; catalog is empty. Model ID in requests is the deployment name. UI exposes a deployment-name input rather than a model picker.

**Credential:** structured `{ resourceName, deploymentName, apiVersion, apiKey }`.

### 3.4 Replicate

**Capabilities:** image and video generation.

**Adapter:** create prediction at `https://api.replicate.com/v1/models/{owner}/{name}/predictions` with `Authorization: Token {apiToken}`. Normalize start → processing → succeeded/failed/canceled. Use the existing background-task queue for polling. Output URLs are downloaded and persisted by the main process, not passed as durable renderer results.

**Models:** curated static list with owner/name/version (e.g. `black-forest-labs/flux-schnell`).

**Credential:** single API token.

### 3.5 AWS Bedrock

**Capabilities:** chat.

**Adapter:** add `@aws-sdk/client-bedrock-runtime` dependency. Use `ConverseCommand` and `ConverseStreamCommand`. SigV4 is handled by the SDK. Model IDs are Bedrock model IDs (`anthropic.claude-3-5-sonnet-20241022-v2:0`, `amazon.nova-pro-v1:0`). Normalize usage, stop reasons, and errors (`AccessDeniedException`, `ThrottlingException`, etc.).

**Credential:** structured `{ region, accessKeyId, secretAccessKey, sessionToken? }`.

**No metadata credential discovery:** the adapter does not read EC2 instance metadata or ambient credentials unless the user explicitly opts in via a future feature.

### 3.6 Google Vertex AI

**Capabilities:** chat.

**Adapter:** endpoint `https://{location}-aiplatform.googleapis.com/v1/projects/{projectId}/locations/{location}/publishers/google/models/{model}:{method}`. Method is `generateContent` or `streamGenerateContent`. Auth can be API key (`key={apiKey}` query param) or service-account OAuth. Initial slice supports API-key auth; service-account auth is documented as future work.

**Models:** `gemini-1.5-pro`, `gemini-1.5-flash`.

**Credential:** structured `{ projectId, location, apiKey }`.

---

## 4. Security Rules

- All provider secrets remain main-process-only. Renderer receives only `configured`/`configuredFields` booleans and configuration errors.
- `providerApiKey:set` is extended to accept a typed config object; validation runs in the main process before storage.
- User-configurable endpoints (Azure resource name, Hugging Face custom endpoint if added later, Replicate webhook URLs) are validated against an allowlist: HTTPS only, no private IP ranges, no localhost, no metadata services.
- Redirects are not followed blindly; authorization headers are stripped on cross-host redirects.
- All errors pass through `redactErrorMessage` and never include credential material.
- Logs redact `Authorization`, `x-api-key`, `api-key`, AWS signatures, and query `key` parameters.
- No provider secret is persisted in renderer stores, logs, telemetry, request inspector exports, or crash reports.

---

## 5. UI/UX Changes

`src/components/settings/ProvidersPanel.tsx` is refactored so each provider renders a capability-specific configuration form:

- Simple-key providers: single password input.
- Azure OpenAI: resource name, deployment name, API version, API key.
- AWS Bedrock: region, access key ID, secret access key, optional session token.
- Google Vertex: project ID, location, API key.
- Replicate: API token.
- Cohere: API key.

The deferred notice is dynamically derived from `DEFERRED_PROVIDER_IDS` so it remains accurate as providers graduate. Capability badges are driven by `PROVIDER_CAPABILITIES`, not hardcoded lists.

---

## 6. Tests and Verification

Each provider adds focused tests in:

- `electron/services/providerAdapters.test.ts` — request transformation, response normalization, streaming, error handling, abort, redaction.
- `electron/services/providerSettingsStore.test.ts` — enablement gating, fallback ordering, structured credential storage.
- `electron/ipc/validation.test.ts` — provider config validation.
- `scripts/verify-provider-adapters.test.ts` — contract rules.
- New per-provider files where complexity justifies isolation (e.g. `electron/services/providers/awsBedrock.test.ts`, `replicate.test.ts`).

The contract verifier is strengthened to reject:
- available provider without adapter;
- implemented capability without matching catalog/discovery mode;
- deferred provider accepting credential input;
- fallback provider without non-empty catalog or valid discovery mode;
- unknown fallback IDs.

---

## 7. Implementation Order

1. Extend `src/types/provider.ts` with config types and `"deployment"` discovery mode.
2. Extend secure store for structured credentials.
3. Refactor adapter signature and `resolveProviderRoute` dispatcher.
4. Implement Cohere (audit, fix, enable).
5. Implement Hugging Face.
6. Implement Azure OpenAI.
7. Implement Replicate (async lifecycle).
8. Implement AWS Bedrock (add SDK, signing).
9. Implement Google Vertex AI.
10. Add connection tests and update UI.
11. Update i18n, docs, and provider matrix.
12. Strengthen contract verifier and run full validation chain.

---

## 8. Risks and External Dependencies

- **AWS SDK dependency** requires lockfile update and bundle-size review.
- **Live acceptance** for cloud providers depends on user-provided credentials and tenant infrastructure; implementation and mocked validation proceed independently.
- **Replicate async lifecycle** must integrate cleanly with the existing background-task store; if the store contract is insufficient, it will be extended minimally.
- **Azure deployments** are tenant-specific; the `"deployment"` discovery mode is the honest representation.
- **Google Vertex service-account auth** is deferred to a follow-up; API-key auth is supported where Vertex permits it.
