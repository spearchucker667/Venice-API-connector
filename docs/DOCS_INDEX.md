# Venice Forge Documentation Index

This is the canonical source-of-truth navigation map for all documentation in this repository. Documents are organized by the [Diátaxis](https://diataxis.fr) framework: **tutorials** (learning), **how-to guides** (task), **reference** (information), and **explanation** (understanding).

---

## Start Here

- [README.md](../README.md) — Repository landing page, features, setup, and architecture overview.
- [ABOUT.md](ABOUT.md) — What Venice Forge is, goals, architecture, data flow, and tab overview.
- [FAQ.md](FAQ.md) — Frequently asked questions about privacy, credentials, safety, storage, and compatibility.
- [SUPPORT.md](../SUPPORT.md) — Where to get help and how to report issues.

---

## Tutorials (Learning-Oriented)

> Step-by-step walkthroughs that teach a workflow and produce a meaningful result.

- [user/ST_CARD_STUDIO.md](user/ST_CARD_STUDIO.md) — Import, edit, draft, chat, and export a character card.
- [DEVELOPMENT/building.md](DEVELOPMENT/building.md) — Local development, packaging, and validation across Windows and macOS.
- [DEVELOPMENT/macos.md](DEVELOPMENT/macos.md) — macOS-specific development setup, permissions, signing, and troubleshooting.

---

## How-To Guides (Task-Oriented)

> Direct, actionable steps to solve a specific real-world problem.

### Development

- [DEVELOPMENT/troubleshooting.md](DEVELOPMENT/troubleshooting.md) — Solutions for common dev environment or build failures.
- [DEVELOPMENT/testing.md](DEVELOPMENT/testing.md) — Run targeted test shards, measure durations, and understand regression escalation.
- [DEVELOPMENT/i18n-tooling.md](DEVELOPMENT/i18n-tooling.md) — `i18n:extract`, `i18n:sync-catalogs`, `i18n:coverage` workflow.
- [DEVELOPMENT/performance-baselines.md](DEVELOPMENT/performance-baselines.md) — Profile bundle size and render performance before monolith refactors.
- [DEVELOPMENT/CONFIG.md](DEVELOPMENT/CONFIG.md) — Configure local YAML options and import secure keys.

### Backup & Sync

- [user/backup-and-sync.md](user/backup-and-sync.md) — Create encrypted backups, import existing backups, and set up sync folders.
- [user/sync-troubleshooting.md](user/sync-troubleshooting.md) — Safe recovery from passphrase loss, conflicts, and two-device problems.
- [DEVELOPMENT/sync-testing.md](DEVELOPMENT/sync-testing.md) — Automated fixture tests and manual two-device QA protocol.

### Media & Images

- [user/IMAGE_INSPECTOR.md](user/IMAGE_INSPECTOR.md) — Analyze local images, extract prompts, and understand source discovery.
- [user/chat-model-selection.md](user/chat-model-selection.md) — Select models per conversation, configure provider defaults, and reconcile fallbacks.

### Release

- [RELEASE/release.md](RELEASE/release.md) — Release requirements, versioning, and publishing checklist.
- [RELEASE/signing-and-notarization.md](RELEASE/signing-and-notarization.md) — Set up certificates and resolve macOS app quarantine.

### Translation

- [i18n/TRANSLATION_GUIDE.md](i18n/TRANSLATION_GUIDE.md) — Translation guidelines, conventions, and contribution workflow.

---

## Reference (Information-Oriented)

> Precise, systematic descriptions of interfaces, formats, and configuration.

### API & Network Contracts

- [reference/Venice_swagger_api.yaml](reference/Venice_swagger_api.yaml) — Authoritative local OpenAPI snapshot (`20260821.193530`) for Venice API requests/responses.
- [reference/Venice_api_LLM_info.md](reference/Venice_api_LLM_info.md) — Venice-provided LLM integration reference.
- [reference/VENICE_API_SYSTEM_PROMPT.md](reference/VENICE_API_SYSTEM_PROMPT.md) — Core system prompt for AI agents integrating with the Venice API.
- [reference/VENICE_API_SOURCE_MANIFEST.md](reference/VENICE_API_SOURCE_MANIFEST.md) — Upstream API documentation mirror provenance and sync contract.
- [reference/seedance-2-0-api-guide.md](reference/seedance-2-0-api-guide.md) — Seedance video generation API reference.
- [reference/seedance-face-consent-api-guide.md](reference/seedance-face-consent-api-guide.md) — Seedance face-consent API reference.

### Formats & Compatibility

- [reference/CHARACTER_CARD_V2_COMPATIBILITY.md](reference/CHARACTER_CARD_V2_COMPATIBILITY.md) — Supported Tavern/CCv2 formats, mappings, limits, and runtime semantics.
- [developer/CHARACTER_CARD_CODEC.md](developer/CHARACTER_CARD_CODEC.md) — Character Card V2 PNG codec limits, verification, and chunk contract.
- [developer/CHARACTER_CARD_MAPPINGS.md](developer/CHARACTER_CARD_MAPPINGS.md) — Tavern/V2 DTO to internal card and character-book mappings.
- [testing/CHARACTER_CARD_FIXTURES.md](testing/CHARACTER_CARD_FIXTURES.md) — Synthetic fixture policy and validation commands.
- [architecture/data-export-format.md](architecture/data-export-format.md) — Authenticated `.vfbackup` envelope, portability, and compatibility contract.
- [design/LOADING_AND_SURFACE_CONTRACT.md](design/LOADING_AND_SURFACE_CONTRACT.md) — Semantic loading, reduced-motion, mesh structure, and interactive-border rules.
- [design/THEME_SYSTEM.md](design/THEME_SYSTEM.md) — CSS custom property tokens, contrast checking, and YAML palette integration.

### Architecture Specifications

- [DEVELOPMENT/FILE_TREE.md](DEVELOPMENT/FILE_TREE.md) — Directory structure reference.
- [DEVELOPMENT/platform-support.md](DEVELOPMENT/platform-support.md) — Desktop OS compatibility matrices.
- [DEVELOPMENT/storage-policy.md](DEVELOPMENT/storage-policy.md) — IndexedDB storage configuration, encryption, and folder layouts.
- [DEVELOPMENT/BRIDGE.md](DEVELOPMENT/BRIDGE.md) — Headless loopback bridge specifications.
- [DEVELOPMENT/JINA_PROVIDER.md](DEVELOPMENT/JINA_PROVIDER.md) — Jina-backed search and scrape integration reference.
- [DEVELOPMENT/image-model-capabilities.md](DEVELOPMENT/image-model-capabilities.md) — Image model capability registry and Seedream model reference.
- [DEVELOPMENT/sync-architecture.md](DEVELOPMENT/sync-architecture.md) — Main/renderer trust boundary, packet lifecycle, conflicts, tombstones, and recovery.
- [DEVELOPMENT/sync-provider-interface.md](DEVELOPMENT/sync-provider-interface.md) — Fail-closed contract for deferred WebDAV/S3-compatible transports.
- [developer/image-inspector-architecture.md](developer/image-inspector-architecture.md) — Image Inspector ingestion, IPC, structured analysis, error and privacy contracts.
- [design/MEDIA_STUDIO.md](design/MEDIA_STUDIO.md) — Media Studio command center actions, visual diffs, and lineage trees.

### Threat Models & Security

- [security/ST_CARD_IMPORT_THREAT_MODEL.md](security/ST_CARD_IMPORT_THREAT_MODEL.md) — Card/PNG/IPC/AI trust boundaries and logging rules.
- [security/security-model.md](security/security-model.md) — Credential, IPC, safety, and portable-data boundaries.
- [security/sync-threat-model.md](security/sync-threat-model.md) — Attacker model and mitigations for untrusted sync folders.

### Internationalization

- [i18n/GLOSSARY.md](i18n/GLOSSARY.md) — Internationalization terminology glossary.
- [i18n/translation-status.json](i18n/translation-status.json) — Machine-readable structural, runtime-surface, and linguistic-review metadata (schema v4).
- [i18n/native-review-status.json](i18n/native-review-status.json) — Per-locale qualified-review state and production-completion input.

### Release & Legal

- [RELEASE/SIGNED_ARTIFACT_EVIDENCE.md](RELEASE/SIGNED_ARTIFACT_EVIDENCE.md) — Cryptographic verification hashes of released binaries.
- [RELEASE/repository-settings.md](RELEASE/repository-settings.md) — GitHub environments and branch protections.
- [RELEASE/ST_CARD_STUDIO_MIGRATION.md](RELEASE/ST_CARD_STUDIO_MIGRATION.md) — Character schema, draft, import/export, sync, and compatibility migration notes.
- [legal/PRIVACY.md](legal/PRIVACY.md) — Detailed technical privacy and local credential storage model.
- [legal/DISCLAIMER.md](legal/DISCLAIMER.md) — Liability exclusions and warranty waivers.
- [legal/NOTICE.md](legal/NOTICE.md) — Copyright attributions and third-party notices.
- [legal/THIRD_PARTY_NOTICES.md](legal/THIRD_PARTY_NOTICES.md) — Dependency licenses and brand attributions.
- [legal/TRADEMARKS.md](legal/TRADEMARKS.md) — Venice.ai and external trademark nominative-use notices.

### Source Code Contracts

- [`../src/shared/chatMediaReferenceContracts.ts`](../src/shared/chatMediaReferenceContracts.ts) — Canonical `ChatMediaReference` parity contract between renderer and main.
- [`../src/shared/promptLimits.ts`](../src/shared/promptLimits.ts) — Unicode code-point budgets and dynamic-limit helper.
- [`../inactive-features/research-browser/README.md`](../inactive-features/research-browser/README.md) — Inactive archive boundary for the former embedded Research Browser.

---

## Explanation (Understanding-Oriented)

> Why the system behaves as it does, how concepts relate, and design rationale.

### Architecture & Design

- [architecture/memory-isolation.md](architecture/memory-isolation.md) — Conversation-scoped memory retrieval, exclusions, and preview lifecycle.
- [design/DESIGN.md](design/DESIGN.md) — Product design principles and interaction guidance.
- [design/CHARACTER_RP.md](design/CHARACTER_RP.md) — Local Character RP architecture and memory boundaries.
- [design/ST_CARD_STUDIO.md](design/ST_CARD_STUDIO.md) — ST Card Studio compatibility decisions, trust boundaries, and phase gates.
- [design/MEMORY.md](design/MEMORY.md) — Semantic memory store structure and injection disclosures.
- [design/LOREBOOKS.md](design/LOREBOOKS.md) — Lorebook JSON formats and key trigger injection.
- [design/SCENE_GENERATION.md](design/SCENE_GENERATION.md) — Dynamic scene-generation rules and background asset maps.
- [design/REPOSITORY_TREE.md](design/REPOSITORY_TREE.md) — Codebase layout and design rationale.
- [DEVELOPMENT/rp-token-counting.md](DEVELOPMENT/rp-token-counting.md) — Compiled prompt estimates and over-budget save behavior.
- [features/DOCUMENT_AGENT.md](features/DOCUMENT_AGENT.md) — Limited Documents, workspace grants, approval integrity, and path security.

### Design History & Reports

- [design/PUBLIC_PROFILE_DISCOVERY.md](design/PUBLIC_PROFILE_DISCOVERY.md) — Platform-specific site query logic.
- [design/VENICE_UI_EXTRACTION.md](design/VENICE_UI_EXTRACTION.md) — Internal UI extraction/reference notes; implementation remains authoritative.
- [design/pastel-theme-pack-report.md](design/pastel-theme-pack-report.md) — Pastel Aqua/Pink Theme Pack implementation report.

### Discovery & Planning

- [discovery/DISCOVERY_DOCUMENT_AGENT.md](discovery/DISCOVERY_DOCUMENT_AGENT.md) — Repository reconciliation and Phase 0 architecture evidence.
- [superpowers/specs/2026-08-23-semantic-image-prompt-enhancer-design.md](superpowers/specs/2026-08-23-semantic-image-prompt-enhancer-design.md) — Implemented semantic grounding, trust-layer, model-context, configuration-migration, and validation contract for Image Studio prompt enhancement/remix.

---

## Developer Onboarding

- [CONTRIBUTING.md](../CONTRIBUTING.md) — Branch conventions, validation commands, and PR checklist.
- [AGENTS.md](../AGENTS.md) — Instructions for AI coding agents and session handoffs.
- [.cursorrules](../.cursorrules) — Thin pointer to AGENTS.md for Cursor-compatible agents.
- [AGENTS/AGENTS.md](AGENTS/AGENTS.md) — Supplementary multi-agent guidance and free-thread agent profiles.
- [AGENTS/agent-reinitialization.md](AGENTS/agent-reinitialization.md) — Agent re-initialization protocol.
- [../scripts/dev-tools/README.md](../scripts/dev-tools/README.md) — Internal development-tool inventory.

---

## Project Governance

### Roadmap & Session Handoff

- [ROADMAP.md](ROADMAP.md) — Canonical current-work-only task ledger.
- [summary_of_work.md](summary_of_work.md) — Active session handoff ledger.

### Audit Evidence

- [../VENICE_FORGE_COMPLETE_AUDIT.md](../VENICE_FORGE_COMPLETE_AUDIT.md) — Current exhaustive repository audit and remediation plan.
- [audits/venice-forge-exhaustive-audit-2026-08-15/00-EXECUTIVE-SUMMARY.md](audits/venice-forge-exhaustive-audit-2026-08-15/00-EXECUTIVE-SUMMARY.md) — Historical exhaustive repository audit verdict and remediation plan.
- [audits/repository-hygiene-audit.md](audits/repository-hygiene-audit.md) — 2026-08-22 repository hygiene audit and reorganization plan.
- [audits/repository-hygiene-final-report.md](audits/repository-hygiene-final-report.md) — 2026-08-22 hygiene execution report.
- [audits/repo-management/](audits/repo-management/) — Historical repository hygiene and reorganization handoffs.

### Historical Reports

- [reports/historical/README.md](reports/historical/README.md) — Guideline for audit history and historical report rules.
- [reports/historical/CANONICAL_REPORT_INDEX.md](reports/historical/CANONICAL_REPORT_INDEX.md) — Navigator for past validation audits.
- [archives/README.md](archives/README.md) — Archive policy and non-authoritative historical-material boundary.

### Retired / Deleted During Hygiene

These files were removed, merged, or archived during the 2026-08-22 repository-wide hygiene pass:
- `CLAUDE.md`, `GEMINI.md`, `.windsurfrules` — Redundant copies of AGENTS.md.
- `docs/SUPPORT.md`, `docs/privacy.md` — Duplicates of root-level files.
- `docs/BUG_HUNTING_AGENT_PROMPT.md` — Internal agent prompt; not user-facing documentation.
- `docs/DEVELOPMENT/BUG_HUNTING_AGENT_PROMPT.md` — Duplicate of the above.
- `docs/audits/CHANGELOG.md` — Duplicate history ledger.
- `scratch/` — Directory added to `.gitignore`.

Leaf nodes `docs/security-model.md`, `docs/data-export-format.md`, `docs/backup-and-sync.md`, `docs/sync-troubleshooting.md`, `docs/chat-model-selection.md`, and `docs/memory-isolation.md` were moved into topic subdirectories during the hygiene pass. The sole authority for current paths is this index.
