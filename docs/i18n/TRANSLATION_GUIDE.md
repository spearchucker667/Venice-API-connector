# Venice Forge Translation Guide

This guide describes translation standards, key conventions, and review workflows for localizing Venice Forge.

## Key Rules

1. **English Source:** `src/i18n/resources/en-US/` is the canonical key source.
2. **Semantic Key Names:** Use stable semantic paths (`settings:languageRegion.title`), never full raw sentences as key names.
3. **Variable Parity:** Preserve interpolation tokens (`{{count}}`, `{{model}}`, `{{language}}`) exactly across all locales.
4. **Local Execution:** All translation files ship with the desktop build. Never request translations from remote APIs at runtime.
5. **No Code/Token Localization:** Do not translate API routes, JSON fields, model IDs, environment variables, CSS selectors, or CLI commands.

## Adding a New Locale

1. Register metadata in `src/i18n/locales.ts` and `src/i18n/locale-types.ts`.
2. Add namespace JSON files under `src/i18n/resources/<locale_code>/`.
3. Add concise documentation under `docs/i18n/<locale_code>/`.
4. Run `npm run verify:i18n` to confirm key and interpolation parity.
