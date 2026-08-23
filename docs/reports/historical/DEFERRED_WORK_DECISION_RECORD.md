# Deferred Work Decision Record

This document records the engineering decisions required to unblock externally deferred roadmap items.

## VF-FSM-003 Semantic Media Classifiers

* **Current blocker:** Requires a selected ML backend for semantic classification.
* **Required decision:** Which provider/local model to integrate into `registerClassifierBackend`.
* **Recommended path:** 
  Integrate a local WebNN/ONNX model (e.g., a MobileNetV2-based NSFW detector) to preserve privacy. Given the local-first nature of Venice Forge, a local ML runtime is strongly recommended for images to avoid sending generated media to a third party. If a cloud API is chosen, Google Cloud Vision API (images) and Video Intelligence API (video) are robust alternatives.
* **Implementation estimate:** 2 weeks for local ONNX integration, 3 days for cloud provider.
* **Risks:** Local model integration increases the application package size (e.g., 5-20MB for model weights), requires CPU/GPU resources, and may have different false positive/negative rates compared to cloud APIs.

---

## VF-IMAGE-SEARCH-001 Reverse Image Matching

* **Current blocker:** Explicit provider/product decision for reverse image matching (e.g., Google Cloud Vision Web Detection or Bing Visual Search).
* **Required decision:** Select a provider and establish a user consent flow for transmitting local images to third parties.
* **Recommended path:**
  - **Provider:** Google Cloud Vision Web Detection or Bing Visual Search.
  - **Abstraction:** Create a `ReverseImageSearchProvider` interface in `src/services/imageSearch/`.
  - **Credentials:** Store API keys in the main process secure storage (`desktopBridge.getSecureConfig()`), never in the renderer.
  - **Consent:** Implement a mandatory one-time per-session or per-image dialog in the UI warning the user that the image will be uploaded to a third party, requiring explicit opt-in.
  - **Allowlist:** Add the chosen provider's endpoint to `electron/services/guardPipeline.ts` or CSP.
* **Implementation estimate:** 1 week (including consent flow, provider integration, and response normalization).
* **Risks:** High privacy implication. Users may unknowingly upload sensitive images (e.g., local photos) to cloud providers. Strong consent boundaries are required to maintain user trust.

---

## VF-VERIFY-005 External Release Acceptance

* **Current blocker:** Requires externally provisioned credentials, physical devices, and authorized paid API accounts.
* **Required decision:** Designate a release engineer with the required credentials to perform the manual checks, or provision CI with the necessary secrets.
* **Recommended path:** 
  The codebase is already hardened to support these flows. The required release acceptance matrix consists of:
  - macOS signed build (requires Apple Developer ID).
  - Windows signed build (requires Windows signing certificate).
  - Clean install validation.
  - Upgrade migration validation.
  - Paid media generation validation (requires paid Venice API key).
  - Restart recovery verification.
  - Screen reader accessibility validation.
* **Implementation estimate:** 1 day of manual QA by an authorized release engineer.
* **Risks:** Bypassing this manual QA matrix could lead to unsigned releases or broken production generation flows that CI cannot catch.
