# Venice Forge — Local Master Config

> Document revision: 2026-07-16. Product version is sourced from `package.json`.

Venice Forge reads a small, optional set of YAML files at startup to let
developers and power users configure behavior without using the UI. API keys
remain **secure by default**: plaintext keys in the YAML are imported into
OS-level secure storage (`safeStorage`) on startup and then redacted from
the file.

## TL;DR

```bash
# Copy the example templates and start editing
npm run config:init

# Validate the file from the CLI (no Electron required)
npm run config:validate

# Print the sanitized effective config
npm run config:print

# Or open the live config folder from the app:
#   Settings → Local Config → Open Config Folder
```

## File Locations

| Mode | Path |
|------|------|
| Env override | `VENICE_FORGE_CONFIG_FILE=/abs/path/config.yaml` |
| Env override | `VENICE_FORGE_THEMES_FILE=/abs/path/themes.yaml` |
| Development (repo-local) | `<repo>/.config/config.local.yaml` |
| Development (repo-local) | `<repo>/.config/themes.local.yaml` |
| Packaged desktop | `<app.getPath("userData")>/.config/config.yaml` |
| Packaged desktop | `<app.getPath("userData")>/.config/themes.yaml` |
| Built-in default | `src/config/defaultConfig.ts` (code) |

Precedence is **env override > repo-local > userData > built-in default**.

In dev, the repo-local `.config/` folder is preferred. In packaged builds,
the userData path is the canonical writable location; signed macOS bundles
and Windows install directories may be read-only and are not used.

## Schema (v1)

```yaml
version: 1

app:
  config_name: "default"          # string, 1..128 chars
  profile: "default"              # string, 1..32 chars
  auto_open_devtools: false       # boolean
  check_for_updates: true         # boolean

secrets:
  # Leave blank by default.
  # If provided, plaintext keys are imported into OS secure storage on
  # startup and redacted from this file (unless keep_plaintext_keys=true).
  venice_api_key: ""
  jina_api_key: ""
  keep_plaintext_keys: false      # default: false (redact after import)

theme:
  active: "builtin-dark"          # built-in id or local theme name
  themes_file: ""                 # optional: path to a local themes overlay

models:
  chat: ""                        # empty = use UI default
  image: ""
  video: ""
  audio: ""
  music: ""
  embedding: ""
  upscale: ""

chat:
  system_prompt: ""               # 8,192 estimated-token max; 32,768-code-point fallback ceiling
  temperature: 0.7                # clamped to [0, 2]
  top_p: 1                        # clamped to [0, 1]
  max_tokens: 4096                # clamped to [1, 200000]
  include_venice_system_prompt: true
  enable_web_search: "off"        # "off" | "on" | "auto"
  enable_web_scraping: false
  enable_web_citations: false
  strip_thinking_response: false
  disable_thinking: false
  # Character chat scene generation is currently controlled from the UI
  # (Settings → Defaults & Behavior). It defaults to disabled with a manual
  # mode; an automatic mode generates a scene when the assistant emits the
  # <venice_forge_scene_request> marker. These settings are not exposed in
  # YAML because the feature is scoped per-user and is toggled at runtime.

memory:
  enable_memory_retrieval: true
  show_pulled_context_before_sending: false

research:
  default_provider: "venice"      # "venice" | "jina" | "auto"
  enable_jina: false
  enable_social_discovery: false

characters:
  enabled: true
  include_adult_characters: true        # defaults on; user can opt out in Settings
  default_character_slug: ""

safety:
  local_family_safe_mode_enabled: false # false = Adult Mode; skips only the optional family layer
  venice_api_safe_mode: false           # provider-side safe_mode, independent

developer:
  verbose_config_logging: false
  allow_config_key_import: true   # if false, plaintext keys in YAML are ignored
  force_import_keys: false        # overwrite secure-store keys on every startup
  force_apply_config: false       # if true, config overrides UI-saved settings
```

## Themes Overlay (`themes.yaml`)

Venice Forge ships with 15 YAML-backed themes that are discovered at runtime and appear in the ThemeMaker selector without any code changes. On desktop startup, `configService.loadMergedThemes()` parses the active `themes.yaml`, validates each entry, converts snake_case tokens to camelCase via `yamlThemeToTheme()`, and caches the resulting `Theme` objects in `useConfigStore.yamlThemes`.

### Shipped YAML Themes (15)

| ID | Name | Mode | Accent | Description |
|----|------|------|--------|-------------|
| `aurora-boreal` | Aurora Boreal | dark | `#4ff0b6` | Deep space black with vibrant mint-green aurora accent |
| `sakura-terminal` | Sakura Terminal | light | `#ff7eb3` | Warm cream with soft pink cherry-blossom accent |
| `basalt-noir` | Basalt Noir | dark | `#ff4d6d` | Charcoal-black basalt with bold rose-red accent |
| `solar-ash` | Solar Ash | light | `#ff9f43` | Warm desert sand with burnt-orange sunburst accent |
| `cyber-orchid` | Cyber Orchid | dark | `#d946ef` | Midnight electric-blue with vivid magenta orchid accent |
| `arctic-glass` | Arctic Glass | light | `#0ea5e9` | Crisp ice-blue glass with cool cyan accent |
| `desert-copperfield` | Desert Copperfield | dark | `#e67e22` | Warm terracotta with rich copper-orange accent |
| `toxic-limewire` | Toxic LimeWire | dark | `#39ff14` | Pitch black with neon-lime toxic accent (high contrast) |
| `midnight-velvet` | Midnight Velvet | dark | `#a78bfa` | Deep midnight blue with soft lavender velvet accent |
| `porcelain-daybreak` | Porcelain Daybreak | light | `#f59e0b` | Clean porcelain white with warm amber daybreak accent |
| `synthwave-harbor` | Synthwave Harbor | dark | `#ff2a6d` | Dark neon harbor with hot-pink synthwave accent |
| `moss-circuit` | Moss Circuit | dark | `#84cc16` | Deep forest green with bright lime-green circuit accent |
| `ember-monastery` | Ember Monastery | dark | `#f97316` | Dark stone with warm burnt-orange ember accent |
| `glacial-ink` | Glacial Ink | dark | `#22d3ee` | Near-black with sharp cyan glacial accent (high contrast) |
| `ultraviolet-rain` | Ultraviolet Rain | dark | `#8b5cf6` | Dark violet with electric purple ultraviolet accent |

YAML themes are stored in `.config/themes.local.yaml` (dev) or `userData/.config/themes.yaml` (packaged). They override built-in themes by matching ID. The ThemeMaker selector shows them in a dedicated "YAML Themes" section.

### Example Overlay Format

```yaml
version: 1

themes:
  my-team-dark:
    display_name: "My Team Dark"
    mode: "dark"                   # "dark" | "light"
    tokens:
      background: "#0d1117"
      surface: "#161b22"
      surface_elevated: "#1c2330"
      surface_muted: "#11161d"
      border: "#2a3140"
      border_strong: "#6b7686"
      foreground: "#e6edf3"
      foreground_muted: "#9aa7b8"
      foreground_subtle: "#7d8999"
      accent: "#1a6fd6"
      accent_foreground: "#ffffff"
      success: "#3fb950"
      success_foreground: "#0d1117"
      warning: "#d29922"
      warning_foreground: "#0d1117"
      danger: "#f85149"
      danger_foreground: "#0d1117"
      input_background: "#1c2330"
      input_foreground: "#e6edf3"
      placeholder: "#7d8999"
      disabled_foreground: "#6b7686"
      button_primary_background: "#1a6fd6"
      button_primary_foreground: "#ffffff"
      button_secondary_background: "#1c2330"
      button_secondary_foreground: "#e6edf3"
      link: "#58a6ff"
      focus_ring: "#4c93f8"
      selection_background: "#1a6fd6"
      selection_foreground: "#ffffff"
```

Built-in themes load first. Local themes override built-ins by exact name.
Invalid entries are skipped with a redacted warning in the Settings UI.
Token names may be written in snake_case (recommended for YAML) or camelCase. Missing semantic roles inherit compatibility-safe values from the selected base theme.

## Security Model (Non-Negotiable)

| Rule | Enforcement |
|------|-------------|
| Renderer never sees raw API keys | IPC returns `secrets.has_venice_api_key: boolean` only |
| Default config files contain no real keys | Templates ship with empty strings |
| Plaintext keys imported to `safeStorage` on startup | `electron/services/configService.ts` → `setApiKey/setJinaApiKey` |
| Plaintext keys redacted after import | `redactKeysInYaml` mutates the parsed YAML document, then an awaited temp-file + rename atomically rewrites the file unless `keep_plaintext_keys: true` |
| Existing secure-store key is not overwritten | Default: import skipped if key already present |
| Force overwrite requires explicit flag | `developer.force_import_keys: true` |
| Remote URLs are rejected | `looksLikeUrl()` returns a `ConfigWarning` and falls back to default |
| Local secret files are gitignored | `.config/*.yaml` ignored, `!.config/*.example.yaml` re-included |
| Generic patches cannot set plaintext keys | `writeSanitizedConfig()` strips `secrets.*` regardless of input |
| Raw keys never logged | `electron/services/logger.ts` redacts `api_key`, `vn-`, etc. |
| Export template contains no raw keys | `exportConfigTemplate()` builds a sanitized `YamlConfig` |
| Optional safety controls remain independent | `safety.local_family_safe_mode_enabled` controls the optional family layer; `safety.venice_api_safe_mode` controls only Venice's provider parameter; both default to `false`. The mandatory child-exploitation guard is always active and is not configurable. |

## Family Safe Mode and Adult Mode

Family Safe Mode is an optional local family-oriented layer. It defaults to `false` (Adult Mode) so the app does not silently impose an application-authored content-policy layer on top of the user's choices and Venice's own provider-side controls. The mandatory child-exploitation guard remains active in both modes and cannot be disabled.

Venice API Safe Mode remains provider-side and is controlled separately by `venice_api_safe_mode`. It also defaults to `false` and must be enabled explicitly by the user.

> Optional filters default off. Mandatory child-safety, credential, IPC, filesystem, and provider access controls remain enforced.

## Precedence

For runtime settings:

1. Explicit UI/user setting saved after first run.
2. YAML config value (only when `developer.force_apply_config: true`).
3. Built-in default.

For API keys:

1. Existing secure-store key.
2. YAML secret imported into secure store if secure store key missing
   (or `developer.force_import_keys: true`).
 3. No key configured.

## Internal Prompt Enhancer

```yaml
internal_prompt_enhancer:
  enabled: true
  model: "venice-uncensored-1-2"
  enhanceTemperature: 0.2
  remixTemperature: 0.4
  maxTokens: 350
  systemPrompt: ""
  remixSystemPrompt: ""
```

The internal prompt-enhancer is a hidden under-app LLM helper used
exclusively for image prompt **Enhance** and **Remix** in Image Studio
and the gallery inspector. It is **not** a user-chat-accessible model
and the model id is **not** exposed in the normal chat / model
selector. Application-owned mandatory protocols first understand and
preserve the original subject, named entity, franchise/source, subject
count, intentional reinterpretations, and explicit constraints before
adding detail. Those protocols also own the one-plain-text-prompt output
contract. Existing safety guards and upstream provider controls remain
authoritative outside the rewriter.

- `enabled: false` disables the **Enhance** and **Remix** buttons in
  Image Studio and the gallery inspector (with a tooltip explaining
  why).
- `model` is a verified Venice model id (e.g. `venice-uncensored-1-2`).
  The default is verified against the live `/models` endpoint.
- `enhanceTemperature` defaults to `0.2`; `remixTemperature` defaults to
  `0.4`. Both are clamped to `[0, 2]` during configuration normalization.
  The deprecated legacy `temperature` key remains presence-aware input
  compatibility: when supplied alone, it sets both mode temperatures; a
  mode-specific key overrides it only for that mode. Fresh generated config
  writes only the two mode-specific keys.
- `maxTokens` is clamped to `[1, 4000]`.
- `systemPrompt` and `remixSystemPrompt` are additive custom preferences,
  not replacement system prompts. They are strongly delimited as untrusted,
  lower-priority data and cannot disable semantic grounding, substitute a
  named identity/franchise, reveal or alter hidden instructions, or change
  the output format. Empty string means no additional preference.

Both Enhance and Remix receive the selected downstream image-model ID,
verified capability facts from the runtime model record and canonical image
capability registry, applicable dimensions, selected style, generation mode,
and bounded reference context. The internal text model configured above stays
distinct from the target image model. Negative prompts, seeds, raw reference
bytes, data/object URLs, local paths, signed URLs, and secrets are not included
in the positive enhancer request.

Enhance may add concrete composition, lighting, atmosphere, material, camera,
and rendering detail while preserving the original idea. Remix may vary only
details the user did not fix; it cannot vary named identity, franchise/source,
subject count, or explicit character, clothing, setting, medium, style, pose,
expression, color, text, reference, or exclusion constraints.

`IMAGE_PROMPT_MAX_CHARS` remains the application ceiling. A reliable lower
runtime model limit becomes the effective ceiling, but the limit is never a
target for verbosity. Response validation rejects only high-confidence
syntactic envelopes such as labelled JSON, explicit reasoning plus a separate
answer, unmistakable refusals, or clearly labelled multiple alternatives.
Missing, rejected, empty, or failed responses fall back to the original prompt.
The candidate is still previewed and changes the stored prompt only after the
user explicitly accepts it; cancellation keeps the original.

## Examples

### Bootstrap a key for a fresh dev environment

```yaml
# .config/config.local.yaml
version: 1
secrets:
  venice_api_key: "vn-abc...your-key"
  jina_api_key: ""
  keep_plaintext_keys: false  # redacted after first run
```

### Lock in some defaults for the team

```yaml
version: 1
chat:
  temperature: 0.3
  enable_web_search: "auto"
memory:
  enable_memory_retrieval: true
```

### Add a custom theme overlay

`themes.local.yaml`:

```yaml
version: 1
themes:
  forge-graphite-extra:
    display_name: "Graphite (extra contrast)"
    mode: "dark"
    tokens:
      # ...all REQUIRED_THEME_TOKEN_KEYS required
```

### Recover from a malformed YAML

If `config.yaml` is broken, the app still boots with built-in defaults and
shows a parse error in **Settings → Local Config**. Fix the file on disk
and click **Reload Config** (or restart the app).

### Fully reset config

- **In-app**: Settings → Local Config → *Clear Secure Store* removes API
  keys. To reset the YAML to defaults, delete the file and restart.
- **CLI**: delete `.config/config.local.yaml` and `.config/themes.local.yaml`,
  then `npm run config:init` to recreate from examples.

## CLI

| Command | Purpose |
|---------|---------|
| `npm run config:init` | Copy `.config/*.example.yaml` → `.config/*.local.yaml` |
| `npm run config:validate` | Parse and validate without launching Electron; non-zero exit on errors |
| `npm run config:print` | Print the sanitized effective config to stdout (never raw keys) |

## Security Disclosure

If you discover a path-traversal, SSRF, or key-leakage issue related to the
config system, please open a private security report. Do not commit real
API keys to Git history under any circumstances — even the example
templates are not exempt.
