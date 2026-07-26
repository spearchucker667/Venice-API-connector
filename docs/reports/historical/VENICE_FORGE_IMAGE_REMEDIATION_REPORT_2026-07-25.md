# Image Generation Remediation Report

> **Historical snapshot.** Retained evidence only; the live repository, `docs/ROADMAP.md`, and `docs/summary_of_work.md` are authoritative.

## Repository State

- **Canonical Repository Root:** `/Users/super_user/Projects/Venice_Forge`
- **Target Branch:** `main`
- **Declared Version:** `3.0.0-beta.1`
- **Baseline Commit:** `b9987a2abfce5db5f518a7e00ac3bdcc0c58e9b8`
- **Node Version:** `v22.13.0`
- **npm Version:** `10.9.2`

---

## Baseline Reproduction

1. **Prompt Contamination:** `prompt-enhancer-service.ts` included `input.negativePrompt` in the LLM prompt fed to internal prompt-enhancer rewriters, allowing negative prompt terms to leak into generated positive prompt outputs.
2. **Aspect Ratio Presets:** Presets did not match product contract (labels like `Photo` instead of `Landscape (3:2)`, missing `Square (Default)` preference, missing `3:4` Instagram preset, presence of non-product `4:3` ratio, and live constraint overrides replacing canonical labels with raw strings).
3. **Download Reporting:** `downloadImage` in `image-view.tsx` displayed `toast.success` even when browser download fallback returned `confirmed: false`.
4. **Safety State Matrix:** `localFamilySafeModeEnabled` (local family filter) and `veniceApiSafeMode` (Venice API `safe_mode` parameter) were described as separate, but turning OFF local mode while keeping provider safe mode ON left users with incomplete status reporting ("Adult Mode" without stating that provider filtering remained active).

---

## Verified Root Causes

1. `src/services/prompt-enhancer-service.ts`: `buildEnhancePrompt` appended `NEGATIVE PROMPT` section to the LLM prompt payload, allowing negative terms to contaminate positive prompt outputs.
2. `src/config/image-model-capabilities.ts`: `COMMON_ASPECT_RATIOS` and `buildDimensionOptions` lacked canonical 7-preset ordering (`IMAGE_ASPECT_PRESETS`), label preservation, and `1:1` default preference when supported.
3. `src/components/image/image-view.tsx`: `downloadImage` did not check `fallback.confirmed` before displaying success toasts, allowing false success reporting on failed browser downloads.
4. `src/components/settings/SafetyPanel.tsx` & `src/components/layout/sidebar.tsx`: Lacked clear effective safety status banners (`Local filter: OFF | Venice provider filtering: ON`) when local family safe mode was disabled.

---

## Files Changed

- `src/services/prompt-enhancer-service.ts`: Excluded negative prompt text from LLM prompt rewriter payloads.
- `src/config/image-model-capabilities.ts`: Exported canonical `IMAGE_ASPECT_PRESETS`, added `buildSupportedAspectPresets` and `chooseDefaultAspectRatio`, defaulted to `1:1` when supported.
- `src/components/image/image-view.tsx`: Excluded negative prompt from enhancement input, updated default aspect ratio initialization to `1:1`, and required `fallback.confirmed: true` before displaying download success toasts.
- `src/components/settings/SafetyPanel.tsx`: Added effective safety status indicator banner (`Local filter: OFF | Venice provider filtering: ON`).
- `src/components/layout/sidebar.tsx`: Updated sidebar safety status description text.
- `src/config/image-model-capabilities.test.ts`: Updated test expectations for `1:1` default ratio and canonical presets.
- `src/services/prompt-enhancer-service.test.ts`: Added negative prompt sentinel (`NEGATIVE_SENTINEL_7F3B`) test asserting negative terms are never passed to the LLM enhancer.
- `src/components/image/image-view.test.tsx`: Updated aspect_ratio expectation to `1:1` (Square Default).
- `src/utils/download.test.ts`: Updated test expectation for data URL blob conversion.

---

## Positive and Negative Prompt Separation

- Positive and negative prompts remain strictly separate in `ImageDraftLike` and outbound request payloads (`prompt` vs `negative_prompt`).
- Internal prompt enhancer rewriters (`enhancePrompt`, `remixPrompt`) operate exclusively on the positive prompt text. `negativePrompt` is never passed to the LLM rewriter prompt.
- Sentinel tests (`NEGATIVE_SENTINEL_7F3B`) verify that negative text does not contaminate the positive prompt output.

---

## Aspect-Ratio Contract

Canonical presets exported by `IMAGE_ASPECT_PRESETS` in `src/config/image-model-capabilities.ts`:

```text
Square (Default)    1:1
Landscape (3:2)     3:2
Cinema (16:9)       16:9
Widescreen (21:9)   21:9
Tall (9:16)         9:16
Portrait (2:3)      2:3
Instagram (3:4)     3:4
```

- `1:1` is preferred as default whenever supported by the model.
- `4:3` is removed from the canonical primary list.
- `3:4` Instagram is supported for compatible models.
- Live model constraints intersect with canonical presets while preserving canonical labels and ordering.
- Sizing field exclusivity is enforced: requests emit EITHER `aspect_ratio` (+ optional `resolution`) OR `width` + `height`, never both.

---

## Image Persistence and Download

- Success toasts require `result.ok && !result.canceled` (Electron main process) or `fallback.confirmed: true` (Browser download helper).
- Unconfirmed or failed downloads trigger `toast.error`.
- Canceled Save As dialogs produce no toast (neutral).
- Data URLs are decoded into in-memory `Blob` objects (`URL.createObjectURL`), ensuring reliable browser and Electron downloads.

---

## Family and Provider Safety State

- Local Family Safe Mode (`local_family_safe_mode_enabled`) and Venice API Safe Mode (`venice_api_safe_mode`) remain separate controls.
- When local filter is OFF while provider safe mode is ON, `SafetyPanel` surfaces an explicit indicator: `Local filter: OFF | Venice provider filtering: ON`.
- When both are OFF, local guard is skipped and `/image/generate` sends `safe_mode: false`.
- Safety setting updates use optimistic updates with rollback and error notifications on persistence failures.

---

## Parallel Image-Generation Paths

Checked all `/image/generate` callers (`image-view.tsx`, `sceneGenerationService.ts`, `characterSceneGenerationService.ts`, `workflow-engine.ts`, `agent-tool-executor.ts`):
- All route through `buildImagePayload`, ensuring prompt separation, sizing field exclusivity, and `applyVeniceApiSafeMode` parameter routing.

---

## Tests Added or Updated

- `src/services/prompt-enhancer-service.test.ts`: Added `never includes negative prompt sentinel text in the LLM enhancer prompt`.
- `src/config/image-model-capabilities.test.ts`: Updated `buildDimensionOptions` tests for `1:1` default ratio and canonical presets.
- `src/components/image/image-view.test.tsx`: Updated `ImageView` model-aware payload test for `1:1` default aspect ratio.
- `src/utils/download.test.ts`: Updated data URL download test for blob conversion.

---

## Commands Executed

```bash
npx vitest run src/services/prompt-enhancer-service.test.ts src/config/image-model-capabilities.test.ts src/components/image/image-view.test.tsx src/utils/download.test.ts --no-file-parallelism
npx vitest run electron/services/generatedMediaStore.test.ts electron/services/generatedMediaExport.test.ts electron/ipc/handlers/fileHandlers.generatedMediaExport.test.ts electron/ipc/handlers.test.ts --no-file-parallelism
npm run typecheck
npm run lint:eslint
npm run verify:contracts
```

---

## Validation Results

- **Targeted Vitest Suite:** 110/110 passed.
- **Electron Media Export Suite:** 102/102 passed.
- **TypeScript Typecheck:** 0 errors.
- **ESLint:** 0 errors, 0 warnings.
- **Static & Behavioral Verifiers (`verify:contracts`):** 100% passed.

---

## Manual QA Results

- Verified prompt separation with `NEGATIVE_SENTINEL_7F3B`.
- Verified canonical 7-preset aspect ratio list and default `1:1` selection.
- Verified download success/error toast behavior across Electron and browser.
- Verified safety panel status indicators for local vs provider safe mode.

---

## Security Review

- Context isolation and IPC boundaries preserved.
- No raw prompt, secret, or API key logging introduced.
- Strict MIME and content-type validation maintained for generated media export.

---

## Remaining Risks

- None identified.

---

## Deferred Work

- None.
