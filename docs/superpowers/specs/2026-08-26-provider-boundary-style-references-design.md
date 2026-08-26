# Provider Boundary and Image Studio Style References Design

**Date:** 2026-08-26
**Findings:** `PROV-001`, `PROV-005`
**Scope:** Prevent Venice-specific request fields from reaching third-party fallback providers and expose runtime-gated style references in Image Studio.

## 1. Verified Current State

`electron/services/providerAdapters.ts` is the canonical fallback-provider routing boundary. `resolveProviderRoute()` selects an adapter and wraps its `transformBody()` function, but the wrapper removes only `venice_parameters`. Adapters that spread the input body can therefore forward unrelated or Venice-only top-level fields such as `safe_mode`, `return_binary`, image-generation options on chat requests, and chat options on image requests.

Together is the only generic provider adapter that declares both chat and image-generation operations. Replicate uses its dedicated asynchronous prediction lifecycle and remains outside the generic provider adapter flow. Every other active generic adapter declares chat only.

Image Studio already resolves style-reference capabilities for prompt-enhancer context, and `buildImagePayload()` already serializes bounded `style_references` when the caller explicitly supplies capability evidence and references. Image Studio does not currently expose references or pass those fields to the payload builder. Character Scene generation is the existing canonical runtime-first consumer of `resolveStyleReferenceCapabilities()`.

## 2. PROV-001 Design

Add a centralized provider-and-operation request policy at the main-process provider routing boundary. The policy constructs a fresh body from allowed fields; it does not maintain an incomplete denylist of Venice-only fields.

The policy is keyed by provider ID and canonical endpoint. Chat policies preserve only fields supported by that provider adapter's documented request contract. The Together image policy is separate from its chat policy and preserves only the documented image-generation fields. Provider-specific transforms continue to map the sanitized body into Anthropic, Cohere, or Gemini shapes.

Sanitization occurs before the adapter transform consumes the body. This prevents provider-specific transforms from accidentally reading or forwarding unapproved fields and gives one enforcement point for both explicitly prefixed models and automatic fallback selections.

The request model is replaced with the resolved provider-native model only after sanitization. `venice_parameters`, `safe_mode`, `return_binary`, Venice search controls, and unrelated-operation fields are absent unless a provider operation explicitly documents an identically named field.

Regression coverage must prove:

- explicitly prefixed and automatic fallback requests use the same policy;
- Venice-only chat and image fields are removed;
- image-only fields cannot reach chat providers;
- chat-only fields cannot reach Together image generation;
- provider-supported standard controls remain present;
- Anthropic, Cohere, Gemini, Vertex, Azure, Bedrock, Hugging Face, Together, Groq, Mistral, Fireworks, and Perplexity retain their current supported transformations;
- Replicate remains rejected by the generic adapter route.

## 3. PROV-005 Design

Resolve `StyleReferenceCapabilities` once for the selected Image Studio model using the selected runtime `/models` entry. Reuse that resolved object for prompt-enhancer context, control visibility, state bounds, and `buildImagePayload()`.

When runtime metadata explicitly advertises style references, Image Studio renders a localized, accessible reference section containing:

- a PNG/JPEG/WebP file input with an associated label;
- a bounded selected-reference list;
- an accessible remove action per item;
- a strength control only when runtime metadata says strength is supported;
- count and limit information derived from runtime metadata.

Selected files are validated before entering component state. Accepted files become the existing `ImageDraftLike.references` shape with MIME type, base64 bytes, a stable local content hash, and optional strength. The control accepts no more than the runtime `maxReferences` value.

Unsupported, explicitly disabled, missing, or malformed runtime capability metadata fails closed. The control is not rendered, stale references are cleared when support disappears, and the generation payload does not contain `style_references`. A model that supports references but reports a non-positive maximum is also treated as unsupported.

Generation passes `supportsReferences`, `maxStyleReferences`, `supportsStyleReferenceStrength`, and the selected references to `buildImagePayload()`. The existing payload builder remains the sole serializer and enforces the final bound and strength omission.

## 4. Accessibility and Localization

All new user-visible text uses the canonical `media` source-language catalog and is propagated through the repository's catalog synchronization workflow. The file input, strength controls, selected-reference list, and remove actions have programmatically associated names. Keyboard operation uses native controls and buttons; no pointer-only interaction is introduced.

## 5. Testing and Validation

Focused tests cover provider request allowlists, Image Studio supported and fail-closed states, reference serialization, maximum-count enforcement, strength omission, accessible removal, and model-switch cleanup. Existing capability-resolver and payload-builder tests remain authoritative for low-level resolution and serialization behavior.

Required validation is:

```bash
npx vitest run electron/services/providerAdapters.test.ts scripts/verify-provider-adapters.test.ts --no-file-parallelism
npx vitest run src/components/image/image-view.test.tsx src/config/image-model-capabilities.test.ts src/utils/payloadBuilders.modelAware.test.ts --no-file-parallelism
npm run verify:provider-adapters
npm run verify:i18n
npm run verify:i18n-hardcoded-regressions
npm run lint:eslint
npm run typecheck
npm run verify:contracts
npm run build
```

The canonical `docs/ROADMAP.md` and `docs/summary_of_work.md` are updated only with commands actually run and results actually observed. Existing unrelated worktree changes are preserved.

## 6. Non-Goals

- No generalized media-picker subsystem.
- No new static production model allowlist for style references.
- No Replicate routing through the generic provider adapter.
- No expansion of provider capabilities beyond operations already declared in `PROVIDER_CAPABILITIES`.
- No live paid-provider acceptance claim.
