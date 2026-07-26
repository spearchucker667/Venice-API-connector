# Venice Forge — Master Feature-Completion Work Order

**Target repository:** `/Users/super_user/Projects/Venice_Forge`  
**Baseline commit:** `7fca076647112433fa4aacb859e707c99b914c12`  
**Input audit:** `VENICE_FORGE_FULL_IMPLEMENTATION_AUDIT_2026-07-25.md`

## Role

You are the release owner, senior Electron engineer, React/TypeScript engineer, local-first persistence engineer, API integration engineer, security reviewer, accessibility engineer, and QA lead.

Your objective is not to add superficial checks or update documentation to say “complete.” Your objective is to eliminate every open implementation, integration, durability, acceptance, and status-authority gap identified in the audit.

Do not close a finding without executable evidence.

## Global Rules

- Work from the canonical repository root.
- Read `AGENTS.md`, `AGENT_REINITIALIZATION.md`, `docs/ROADMAP.md`, and the audit first.
- Preserve Electron context isolation, sandboxing, CSP, network allowlists, secure storage and profile isolation.
- Renderer code must not access arbitrary files.
- Do not expose raw `ipcRenderer`.
- Do not trust renderer-supplied paths, profile IDs, provider IDs, model IDs, card payloads, media bytes or approval state.
- Do not silently suppress durable-write failures.
- Do not mark external/manual acceptance as passed without artifacts.
- Do not market deferred providers or transports as implemented.
- Do not display or persist raw hidden chain-of-thought.
- Update the full file, not a partial patch, when handing revised artifacts to another agent.
- Add regression tests before closing each P0/P1 issue.
- Keep the roadmap, summary ledger, reports and README factually consistent.

## Phase 0 — Establish Reproducible Baseline

- [ ] Confirm exact repository root and branch.
- [ ] Record `git status --short`.
- [ ] Record Node and npm versions.
- [ ] Run clean `npm ci`.
- [ ] Run baseline lint, typecheck, tests, coverage, contracts and build.
- [ ] Capture failures without modifying unrelated code.
- [ ] Create `docs/reports/VENICE_FORGE_COMPLETION_EXECUTION_2026-07-25.md`.
- [ ] Reopen Character Creator in `docs/ROADMAP.md`.
- [ ] Remove “fully verified” language until acceptance is complete.

## Phase 1 — P0 Character Creator Import Repair

### Main-process candidate consumption

- [ ] Add a sender-bound, one-time, expiring IPC operation to consume a selected import candidate.
- [ ] Reuse the existing candidate map populated by `characterCards:chooseImportFile`.
- [ ] Return a bounded Character Card V2 DTO.
- [ ] Return a managed avatar reference or bounded validated avatar payload.
- [ ] Never return the source filesystem path.
- [ ] Re-run Local Family Safe Mode/import policy before consumption.
- [ ] Delete the candidate after successful consumption.
- [ ] Reject expired, reused and foreign-renderer handles.
- [ ] Add rate limiting and redacted errors.

### Renderer integration

- [ ] Replace `JSON.parse(handle)` behavior.
- [ ] Convert the consumed DTO through `loadCardDtoAsDraft`.
- [ ] Preserve import preview warnings.
- [ ] Display the imported avatar.
- [ ] Open the exact draft.
- [ ] Preserve unknown compatible extensions.
- [ ] Do not create the local character before approval.

### Browser fallback

- [ ] Implement safe PNG metadata parsing in browser mode, or remove PNG from the file input.
- [ ] Keep JSON import bounded.
- [ ] Reject malformed UTF-8 and oversized files.
- [ ] Add explicit browser-mode capability messaging.

### Tests

- [ ] Native V1 JSON selection → V2 draft.
- [ ] Native V2 JSON selection → V2 draft.
- [ ] Native V2 PNG selection → V2 draft and avatar.
- [ ] Expired handle.
- [ ] Reused handle.
- [ ] Wrong renderer.
- [ ] Family-safe block.
- [ ] Oversized file.
- [ ] Malformed JSON.
- [ ] Malformed PNG.
- [ ] No absolute path reaches the renderer.

## Phase 2 — P0 Draft Durability Repair

- [ ] Replace silent `flushPendingSave` catch with a typed result.
- [ ] Keep pending data until persistence succeeds.
- [ ] Serialize updates per draft.
- [ ] Add expected-revision compare-and-swap to normal draft updates.
- [ ] Do not overwrite a newer revision with an older debounced write.
- [ ] Display a persistent autosave error.
- [ ] Disable approval and export while required changes are unsaved.
- [ ] Flush before validation, approval, export and navigation.
- [ ] Add page-visibility and application-close coordination where practical.
- [ ] Add bounded retry only for retryable storage failures.
- [ ] Add failure-injection tests.
- [ ] Add restart recovery test.

## Phase 3 — Character Creator IPC Consolidation

- [ ] Inventory declared, registered, exposed and consumed Character Creator channels.
- [ ] Delete dead channel constants or implement them fully.
- [ ] Replace the minimal main validator with the canonical runtime schema.
- [ ] Move shared validation into a renderer/main-safe module.
- [ ] Reject prototype-polluting extension keys recursively.
- [ ] Reject non-JSON extension values.
- [ ] Cap strings, arrays, nesting and total payload bytes.
- [ ] Remove unused preload APIs.
- [ ] Verify sender origin and authorization for every handler.
- [ ] Add contract parity tests across channel map, registration, preload and bridge.

## Phase 4 — Character Creator Export Hardening

- [ ] Change export input to canonical `draftId` or `characterId`.
- [ ] Load the current card in the authoritative process.
- [ ] Validate the complete card before export.
- [ ] Resolve avatar from a managed store.
- [ ] If DTO export remains, enforce strict decoded byte, MIME and dimension limits.
- [ ] Redact all export errors.
- [ ] Add privacy profiles for `sourceIdea`, creator notes and extension metadata.
- [ ] Add JSON, PNG, JPEG-avatar and WebP-avatar Electron acceptance tests.
- [ ] Reimport every exported fixture and compare canonical fields.

## Phase 5 — Honest AI Design Process

Choose and document one product model.

### Option A — Genuine staged process

- [ ] Stage 1: GLM 5.2 concept analysis.
- [ ] Validate design mode and assumptions.
- [ ] Stage 2: GLM 5.2 complete card generation using validated analysis.
- [ ] Stage 3: deterministic local validation.
- [ ] Stage 4: optional repair.
- [ ] Stage 5: durable draft save.
- [ ] Emit events only after the underlying operation happens.

### Option B — Post-hoc summary

- [ ] Rename “AI Design Process” to “Generation Summary.”
- [ ] State that it summarizes the returned design.
- [ ] Do not imply live internal reasoning.

For either option:

- [ ] Preserve `original`, `inspired-original`, `direct-existing`, `parody`, and `alternate`.
- [ ] Remove hardcoded `intendedMode: "original"`.
- [ ] Do not render or store `reasoning_content`.
- [ ] Redact provider errors.
- [ ] Cap every public-summary collection.
- [ ] Add user-visible warnings for truncation rather than silent truncation.
- [ ] Use `crypto.randomUUID()` for event IDs.

## Phase 6 — Character Draft and Hosted-Duplication Quality

- [ ] Reuse an existing active draft for the same `sourceCharacterId`, or prompt the user.
- [ ] Prevent duplicate unfinished drafts from repeated edit launches.
- [ ] Replace durable `Date.now()+Math.random()` IDs with UUIDs.
- [ ] Disclose shallow hosted-character copies.
- [ ] Add explicit “Enrich with GLM 5.2” for missing personality/scenario/dialogue fields.
- [ ] Preserve source provenance without exposing private URLs or paths.
- [ ] Add source-idea privacy control to export.

## Phase 7 — Document Agent Completion

- [ ] Implement configurable source-blob retention.
- [ ] Keep retention off by default unless product policy says otherwise.
- [ ] Isolate DOCX and PDF parsing from the main process.
- [ ] Add fuzz tests and resource limits.
- [ ] Add complete changeset review UI.
- [ ] Add move review UI.
- [ ] Add recoverable-trash list, restore and permanent-delete flow.
- [ ] Add operation journal before mutations.
- [ ] Recover or rollback interrupted operations on startup.
- [ ] Integrate canonical tools into Chat.
- [ ] Integrate canonical tools into Workflow execution.
- [ ] Integrate canonical tools into Projects.
- [ ] Maintain exact one-time approvals.
- [ ] Add packaged macOS and Windows filesystem QA.
- [ ] Complete the manual matrix in `Function_calling_todo.md`.

## Phase 8 — Image Inspector Product Decision

- [ ] Decide whether direct source-image matching is in beta scope.
- [ ] If not, remove all implication that it exists.
- [ ] If yes, select a provider with a supported image-byte API.
- [ ] Add main-owned credentials.
- [ ] Add explicit upload consent.
- [ ] Add cost disclosure.
- [ ] Add size and format bounds.
- [ ] Add endpoint allowlist and URL controls.
- [ ] Normalize source candidates, confidence and attribution.
- [ ] Add deletion/retention policy.
- [ ] Add paid provider-backed tests.

## Phase 9 — Backup and Sync Completion

- [ ] Run two-device convergence on real separate installations.
- [ ] Test offline outbox recovery.
- [ ] Test tombstone propagation.
- [ ] Test every conflict action.
- [ ] Test media opt-in and opt-out.
- [ ] Test corrupted packets and wrong passphrase.
- [ ] Test profile isolation.
- [ ] Test pause, restart and reattach.
- [ ] Decide whether live key rotation is in release scope.
- [ ] If yes, design a versioned rotation protocol with mixed-key transition and recovery.
- [ ] Decide whether WebDAV/S3/R2/B2/MinIO are in release scope.
- [ ] Implement only with secure credential custody, TLS policy, pagination, retries, cancellation and conditional writes.
- [ ] Keep unimplemented providers unselectable.

## Phase 10 — Storage Maintenance

- [ ] Design an orphan dependency graph.
- [ ] Present a per-record preview.
- [ ] Quarantine instead of immediate deletion.
- [ ] Record an audit event.
- [ ] Add restore.
- [ ] Add final permanent deletion with confirmation.
- [ ] Cover prompts, scenes, workflows, media and related references.
- [ ] Remove `dryRunOnly` only after rollback tests pass.

## Phase 11 — Provider and Research Debt

- [ ] Decide final beta provider list.
- [ ] Remove deferred providers from active marketing.
- [ ] Implement scheduled credential rotation only with provider support and audit.
- [ ] Resolve Jina robots-policy semantics.
- [ ] Remove ineffective UI switches.
- [ ] Fix provider-adapter test-mock portability.
- [ ] Remove or correctly map deprecated `enhancePrompt`.

## Phase 12 — Accessibility and Responsive QA

- [ ] Repair and test RP Studio at 390×844.
- [ ] Test all tabs at 200% and 400% zoom.
- [ ] Test keyboard-only navigation.
- [ ] Test screen reader labels and live regions.
- [ ] Test reduced motion.
- [ ] Test all theme combinations.
- [ ] Test long translated strings.
- [ ] Test minimum supported window size.
- [ ] Add automated axe checks for critical flows.

## Phase 13 — Paid Media and Restart Acceptance

- [ ] Paid Image Studio generation/edit/upscale/background removal.
- [ ] Paid Image Inspector PNG/JPEG/WebP analysis.
- [ ] Paid TTS and transcription.
- [ ] Paid music queue/retrieval.
- [ ] Paid video direct MP4.
- [ ] Paid video queue `download_url`.
- [ ] Restart at queued/generating/retrieving/saving stages.
- [ ] Playback, pause, seek, volume, fullscreen and menu controls.
- [ ] Native Save As.
- [ ] Catalog deduplication and reconciliation.
- [ ] Traffic Inspector redaction.

## Phase 14 — Signed Release Acceptance

- [ ] macOS arm64 signed/notarized DMG and ZIP.
- [ ] macOS x64 signed/notarized DMG and ZIP.
- [ ] Windows signed installer and portable package.
- [ ] Clean install.
- [ ] In-place update.
- [ ] Secure storage.
- [ ] Protocol registration.
- [ ] File associations where applicable.
- [ ] Uninstall and data-retention behavior.
- [ ] Checksums and provenance.
- [ ] Release notes and known limitations.

## Phase 15 — Documentation Authority Repair

- [ ] Reopen incomplete roadmap rows.
- [ ] Remove superseded completion claims.
- [ ] Make `docs/ROADMAP.md` the live work ledger.
- [ ] Keep `docs/summary_of_work.md` historical and append-only.
- [ ] Add a verifier that detects unresolved ledger references for completed IDs.
- [ ] Split evidence into static, automated, manual and external.
- [ ] Update README only after the release gates pass.
- [ ] Add known limitations.
- [ ] Add deferred-provider and sync-transport truth table.

## Mandatory Final Validation

Run from a clean checkout:

```bash
npm ci
npm run lint:eslint
npm run typecheck
npm run test:ci
npm run test:coverage
npm run verify:contracts
npm run build
npm run verify:dist:release
npm run verify:icon
npm run verify:archive-clean
```

Run all focused suites added by this work order.

Do not mark completion until every applicable command passes and every required manual artifact is attached.

## Required Final Report

Create:

```text
docs/reports/VENICE_FORGE_MASTER_COMPLETION_REPORT_2026-07-25.md
```

For each finding include:

```text
finding ID
root cause
files changed
migration
tests
commands
manual evidence
remaining risk
roadmap disposition
```

The final verdict must be one of:

```text
DO_NOT_SHIP
BETA_READY_WITH_KNOWN_LIMITATIONS
RELEASE_CANDIDATE
RELEASE_CERTIFIED
```

Do not use `RELEASE_CERTIFIED` without signed-package, paid-provider, two-device and accessibility evidence.
