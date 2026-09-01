# Theme Engine V2 & CI/Packaging Hardening Design

> **Source:** Consolidated agent handoff dated 2026-08-31. This document distills the architecture, contracts, and acceptance criteria for implementation planning.

## Goal

1. Replace the flat single-mode theme architecture with a `ThemeFamily` model where every shipping theme has intentional light and dark variants.
2. Safely harden CI script coverage, packaged-build verification, and release-staging cleanup without regressing the currently green pipeline.

## Theme Engine V2 Architecture

### Old model

```text
Theme
├── id
├── name
├── mode
└── tokens
```

Light/dark switching is implemented by swapping the selected theme ID to a generic `builtin-light`/`builtin-dark`, which destroys branded-theme identity.

### New model

```text
ThemeFamily
├── schemaVersion: 2
├── id          // e.g. "midnight-velvet"
├── name        // e.g. "Midnight Velvet"
├── variants
│   ├── light: ThemeVariant
│   └── dark:  ThemeVariant
└── aliases?: string[]

ResolvedTheme
├── id          // family id
├── name
├── mode        // effective "light" | "dark"
└── tokens      // fully resolved variant tokens
```

### Lifecycle

```text
Theme source (built-in / custom / YAML)
    ↓
validator
    ↓
normalizer/compiler
    ↓
complete ThemeFamily
    ↓
resolveTheme(family, appearanceMode, systemAppearance)
    ↓
ResolvedTheme
    ↓
applyTheme(ResolvedTheme)  // sets CSS variables + data attributes only
```

### Persistence

Durable state stores:

```json
{
  "selectedThemeId": "midnight-velvet",
  "appearanceMode": "system"
}
```

`appearanceMode` is one of `light`, `dark`, or `system`. The family ID never changes because of mode changes.

Legacy IDs (`builtin-light`, `builtin-dark`, `builtin-solarized-dark`, `builtin-solarized-light`, custom single-mode themes) migrate through deterministic aliases.

### YAML V2 Format

```yaml
schemaVersion: 2
id: midnight-velvet
name: Midnight Velvet
variants:
  light:
    tokens:
      background: "#..."
      surface: "#..."
      accent: "#..."
  dark:
    tokens:
      background: "#..."
      surface: "#..."
      accent: "#..."
```

Optional shared `base.tokens` is allowed if inheritance is deterministic and documented.

### YAML Security Requirements

- Reject invalid YAML atomically; active theme remains unchanged.
- Allowlisted token-name → CSS-variable mapping only.
- Reject arbitrary CSS property injection.
- Reject dangerous object keys (`__proto__`, `prototype`, `constructor`).
- Validate color formats before normalization.
- Enforce built-in ID protection.
- Duplicate custom IDs require explicit overwrite/rename policy.

### ThemeMaker V2 UX

```text
Theme: Midnight Velvet
[ Light ] [ Dark ]

<Light variant controls>
<Dark  variant controls>
```

- Mode tabs edit the corresponding family variant.
- Preview resolves `family + preview mode`.
- Save/Apply persists the whole `ThemeFamily`.
- Cancel restores previous state exactly.

### CSS Boundary

`applyTheme.ts` receives only a `ResolvedTheme`. It must:

- set CSS variables
- set `data-theme`
- set `data-theme-mode`
- set relevant semantic metadata

It must not parse YAML, persist settings, repair themes, or choose variants.

## CI / Packaging Hardening Architecture

### Baseline

- HEAD: `5ee33ab4950f1ec059f9f7ebf5492848833e8ac1`
- CI run 857: successful
- CodeQL for same commit: successful
- Therefore changes are hardening, not repair of a red pipeline.

### Script Coverage

- New `script-coverage` job runs `npm run test:coverage:scripts`.
- `build` job `needs` includes `script-coverage`.
- `scripts/verify-ci-contract.cjs` enforces the dependency.

### Release Cleanup Decision

Before enabling any cleanup step, prove:

1. What electron-builder generates (installers, unpacked apps, metadata, staging).
2. What `verify-dist.cjs` consumes.
3. What packaged smoke tests consume.

Cleanup may only remove directories proven to be disposable staging. If no such paths exist, omit cleanup and document the rationale.

If cleanup is implemented, it must be:

- idempotent
- cross-platform
- path-safe (refuses release root, repo root, filesystem root, traversal)
- explicit allowlist of removable directories
- covered by tests
- placed at the correct lifecycle stage (typically after verification/smoke, or before only if downstream consumers do not need the removed paths)

### Workflow Invariants

- Node version from `.nvmrc`.
- Pinned action SHAs preserved.
- `npm audit --omit=dev --audit-level=moderate` and `npm audit --audit-level=critical` retained unless policy explicitly changes.
- No workflow references a nonexistent script.
- Platform packaging jobs depend on core CI success.

## Acceptance Criteria

### Theme

- [ ] Theme identity independent of appearance mode.
- [ ] Every shipping family has intentional light and dark variants.
- [ ] Light/dark switching never changes family ID.
- [ ] System mode never changes family ID.
- [ ] Runtime themes fully resolved before DOM application.
- [ ] Invalid YAML rejected atomically.
- [ ] YAML cannot inject arbitrary CSS properties.
- [ ] One authoritative durable theme representation.
- [ ] Built-ins, custom, and YAML themes use the same validator.
- [ ] ThemeMaker uses the same resolver as runtime.
- [ ] Legacy IDs migrate deterministically.
- [ ] Existing valid user themes preserved.
- [ ] Missing variants never silently map to unrelated generic themes.
- [ ] CSS-variable application allowlisted through semantic tokens.
- [ ] `verify:theme-tokens` enforced by hosted CI.

### CI / Release

- [ ] Node version `.nvmrc`-driven.
- [ ] `script-coverage` job implemented and required by `build`.
- [ ] Audit policy intentionally preserved or documented.
- [ ] Release output structure documented.
- [ ] `verify-dist` artifact dependencies documented.
- [ ] Electron smoke artifact dependencies documented.
- [ ] `clean-release-staging.cjs` safely implemented and tested, or omitted with documented rationale.
- [ ] Cleanup cannot remove required packaged apps.
- [ ] Cleanup path safety tests pass.
- [ ] Platform smoke topology preserved.
- [ ] No references to nonexistent scripts.

### Full Acceptance

- [ ] Typecheck passes.
- [ ] Lint passes.
- [ ] Unit/integration tests pass.
- [ ] Coverage passes.
- [ ] Script coverage passes.
- [ ] Contracts pass.
- [ ] Theme tests pass.
- [ ] ThemeMaker tests pass.
- [ ] Theme verification passes.
- [ ] Production build passes.
- [ ] Relevant packaged artifact verification passes.
- [ ] Relevant Electron smoke tests pass.
- [ ] Documentation matches implementation.
- [ ] Manual light/dark theme matrix completed.
- [ ] Hosted CI remains green after publication (if authorized).
- [ ] Hosted CodeQL remains green after publication (if authorized).

## Remaining Risks

- Manual visual acceptance is required for every theme family in both modes.
- Hosted CI/CodeQL must be validated after publication; local green does not guarantee hosted green.
- Release cleanup may be unsafe if smoke tests depend on unpacked app directories.
