#!/usr/bin/env node
/**
 * verify-scene-references.cjs
 *
 * Phase 7 Scene References contract guard (VERIFY-082 through VERIFY-086).
 * Fails if any of the following invariants are violated:
 *
 *  1. `src/config/image-model-capabilities.ts` declares `supportsReferences`
 *     and `referenceLimit` on `ImageModelCapabilities` and exports them.
 *  2. `src/utils/payloadBuilders.ts` accepts `references` on `ImageDraftLike`
 *     and emits the documented `style_references: [{ image, strength }]`
 *     array only when `supportsReferences` is true (P1-004).
 *  3. `src/services/sceneReferencePlanner.ts` exports `buildSceneReferencePlan`
 *     and `SceneReferencePlan` references carry `data`, `mimeType`, and
 *     `contentHash`.
 *  4. `src/services/sceneReferenceResolver.ts` exports
 *     `buildSceneReferenceEntities` and builds entities from character cards
 *     and personas.
 *  5. `src/services/characterSceneGenerationService.ts` wires the reference
 *     plan into the image draft passed to `buildImagePayload`, with support
 *     gated on runtime `/models` metadata (P1-004/P3-001).
 *  6. `src/components/scenes/SceneComposerView.tsx` renders the reference
 *     preview panel (`SceneReferencePanel`) and exposes
 *     `data-testid="scene-reference-panel"`.
 *
 * Usage:
 *   node scripts/verify-scene-references.cjs
 *
 * Exit 0 on success; non-zero on any violation.
 */
"use strict";

const fs = require("fs");
const path = require("path");

const REPO = path.resolve(__dirname, "..");
const CAPS_FILE = path.join(REPO, "src/config/image-model-capabilities.ts");
const PAYLOAD_FILE = path.join(REPO, "src/utils/payloadBuilders.ts");
const PLANNER_FILE = path.join(REPO, "src/services/sceneReferencePlanner.ts");
const RESOLVER_FILE = path.join(REPO, "src/services/sceneReferenceResolver.ts");
const SERVICE_FILE = path.join(REPO, "src/services/characterSceneGenerationService.ts");
const VIEW_FILE = path.join(REPO, "src/components/scenes/SceneComposerView.tsx");
const VIEW_TEST_FILE = path.join(REPO, "src/components/scenes/SceneComposerView.test.tsx");
const PLANNER_TEST_FILE = path.join(REPO, "src/services/sceneReferencePlanner.test.ts");
const PAYLOAD_TEST_FILE = path.join(REPO, "src/utils/payloadBuilders.modelAware.test.ts");
const SERVICE_TEST_FILE = path.join(REPO, "src/services/characterSceneGenerationService.test.ts");

let failures = 0;
function check(label, ok, detail) {
  const tag = ok ? "PASS" : "FAIL";
  if (!ok) failures += 1;
  const tail = detail ? ` — ${detail}` : "";
  console.log(`  [${tag}] ${label}${tail}`);
}

function read(rel) {
  return fs.readFileSync(rel, "utf8");
}

function mustContain(file, label, fragments) {
  let text = "";
  try {
    text = read(file);
  } catch {
    check(label, false, `file not found: ${file}`);
    return;
  }
  for (const f of fragments) {
    check(`${label} → ${JSON.stringify(f)}`, text.includes(f));
  }
}

console.log("Phase 7 Scene References contract guard (VERIFY-082..VERIFY-086)");
console.log("");

// 1. Capability contract.
mustContain(CAPS_FILE, "image-model-capabilities reference flags", [
  "supportsReferences",
  "referenceLimit",
  "export function getImageModelCapabilities",
]);

// 2. Payload builder contract. P1-004: the image-generate wire shape is the
// documented `style_references: [{ image, strength }]` array;
// `reference_image_urls` is NOT a GenerateImageRequest property and must
// never be emitted by the image builder (it remains a video-queue field).
const payloadText = read(PAYLOAD_FILE);
mustContain(PAYLOAD_FILE, "payloadBuilders reference support", [
  "references?:",
  "style_references",
  "supportsReferences",
  "supportsStyleReferenceStrength",
  "maxStyleReferences",
]);
if (payloadText.includes("reference_image_urls")) {
  check("payloadBuilders never emits reference_image_urls on image generate", false, "found reference_image_urls in image payload builder (P1-004)");
}

// 3. Planner contract.
mustContain(PLANNER_FILE, "sceneReferencePlanner exports", [
  "export function buildSceneReferencePlan",
  "contentHash: string",
  "data: string",
  "model-unsupported",
  "reference-limit",
]);

// 4. Resolver contract.
mustContain(RESOLVER_FILE, "sceneReferenceResolver exports", [
  "export function buildSceneReferenceEntities",
  "SceneReferenceSource",
  "CharacterCardV1",
  "UserPersonaV1",
]);

// 5. Service integration. P1-004/P3-001: reference support is resolved from
// runtime `/models` metadata (`resolveStyleReferenceCapabilities`) and fails
// closed when metadata is absent;
const serviceText = read(SERVICE_FILE);
mustContain(SERVICE_FILE, "characterSceneGenerationService reference wiring", [
  "buildSceneReferencePlan",
  "buildSceneReferenceEntities",
  "getSceneReferenceSource",
  "references: referencePlan.references",
  "resolveStyleReferenceCapabilities",
  "getRuntimeModelSpec",
  "supportsStyleReferenceStrength: styleRefCaps.supportsStrength",
]);
if (serviceText.includes("supportsReferences: caps.supportsReferences === true")) {
  check("service gates references on runtime metadata", false, "static-capability reference gating remains (P1-004)");
}

// 6. UI preview panel.
mustContain(VIEW_FILE, "SceneComposerView reference panel", [
  "function SceneReferencePanel",
  "scene-reference-panel",
  "scene-reference-included",
  "scene-reference-omitted",
  "buildSceneReferenceEntities",
  "buildSceneReferencePlan",
]);

// 7. Regression tests use the assigned VERIFY IDs.
mustContain(PLANNER_TEST_FILE, "planner tests reference VERIFY-082", [
  "VERIFY-082",
]);
mustContain(PAYLOAD_TEST_FILE, "payload tests reference VERIFY-082", [
  "VERIFY-082",
]);
mustContain(SERVICE_TEST_FILE, "service tests reference VERIFY-084", [
  "VERIFY-084",
]);
mustContain(VIEW_TEST_FILE, "view tests reference VERIFY-085", [
  "VERIFY-085",
]);

console.log("");
if (failures === 0) {
  console.log("All Scene References contract checks passed.");
  process.exit(0);
} else {
  console.error(`${failures} contract violation${failures === 1 ? "" : "s"} detected.`);
  process.exit(1);
}
