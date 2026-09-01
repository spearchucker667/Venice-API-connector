import { translateRuntime } from "../i18n/runtimeTranslator";
import React, { useEffect, useMemo, useState } from "react";
import {
  applyTheme,
  legacyThemeToFamily,
  luminance,
  resolveTheme,
  serializeThemeFamilyYaml,
  parseThemeYaml,
  type Theme,
  type ThemeFamily,
  type ThemeMode,
  type ThemeTokens,
} from "../theme";
import { BUILTIN_THEME_FAMILIES } from "../theme/builtins";
import { COLOR_INPUT_FALLBACK } from "../theme/fallbacks";
import { isValidColorValue } from "../theme/validateColor";
import { ThemePreview } from "./ThemePreview";
import { desktopFiles } from "../services/desktopBridge";
import { useSettingsStore } from "../stores/settings-store";
import { useConfigStore } from "../stores/config-store";
import { toast } from "../stores/toast-store";
import { redactErrorMessage } from "../shared/redaction";
import { desktopConfig } from "../services/desktopBridge";
import { Trans, useTranslation } from "react-i18next";
import { sortThemeOptions } from "../utils/themeOptions";

const TOKEN_LABELS: Record<keyof ThemeTokens, string> = {
  background: "Background",
  surface: "Surface",
  surfaceElevated: "Surface Elevated",
  surfaceMuted: "Surface Muted",
  border: "Border",
  borderStrong: "Border Strong",
  textPrimary: "Text Primary",
  textSecondary: "Text Secondary",
  textMuted: "Text Muted",
  foreground: "Foreground",
  foregroundMuted: "Foreground Muted",
  foregroundSubtle: "Foreground Subtle",
  accent: "Accent",
  accentHover: "Accent Hover",
  accentForeground: "Accent Foreground",
  success: "Success",
  successForeground: "Success Foreground",
  warning: "Warning",
  warningForeground: "Warning Foreground",
  danger: "Danger",
  dangerForeground: "Danger Foreground",
  info: "Info",
  inputBackground: "Input Background",
  inputForeground: "Input Foreground",
  get placeholder() {
    return translateRuntime(
      "runtimeGenerated.components.thememaker.metadata.placeholder",
      "Placeholder",
    );
  },
  disabledForeground: "Disabled Foreground",
  buttonPrimaryBackground: "Primary Button Background",
  buttonPrimaryForeground: "Primary Button Foreground",
  buttonSecondaryBackground: "Secondary Button Background",
  buttonSecondaryForeground: "Secondary Button Foreground",
  link: "Link",
  focusRing: "Focus Ring",
  selectionBackground: "Selection Background",
  selectionForeground: "Selection Foreground",
  overlay: "Overlay",
  glow: "Glow",
};

const TOKEN_CATEGORIES: Array<{
  name: string;
  keys: Array<keyof ThemeTokens>;
}> = [
  {
    name: "Surfaces & Backgrounds",
    keys: [
      "background",
      "surface",
      "surfaceElevated",
      "surfaceMuted",
      "overlay",
      "glow",
    ],
  },
  {
    name: "Typography & Text",
    keys: [
      "foreground",
      "foregroundMuted",
      "foregroundSubtle",
      "placeholder",
      "disabledForeground",
      "link",
    ],
  },
  {
    name: "Borders & Focus",
    keys: [
      "border",
      "borderStrong",
      "focusRing",
      "selectionBackground",
      "selectionForeground",
    ],
  },
  {
    name: "Controls & Buttons",
    keys: [
      "accent",
      "accentHover",
      "accentForeground",
      "buttonPrimaryBackground",
      "buttonPrimaryForeground",
      "buttonSecondaryBackground",
      "buttonSecondaryForeground",
      "inputBackground",
      "inputForeground",
    ],
  },
  {
    name: "Status & Feedback",
    keys: [
      "success",
      "successForeground",
      "warning",
      "warningForeground",
      "danger",
      "dangerForeground",
      "info",
    ],
  },
];

function cloneFamily(family: ThemeFamily): ThemeFamily {
  return {
    ...family,
    variants: {
      light: { tokens: { ...family.variants.light.tokens } },
      dark: { tokens: { ...family.variants.dark.tokens } },
    },
  };
}

function singleModeThemeFromFamily(family: ThemeFamily, mode: ThemeMode): Theme {
  return {
    id: family.id,
    name: family.name,
    mode,
    tokens: family.variants[mode].tokens,
  };
}

function familyFromTheme(theme: Theme): ThemeFamily {
  return legacyThemeToFamily(theme);
}

function defaultCustomFamily(): ThemeFamily {
  const base = BUILTIN_THEME_FAMILIES.find((f) => f.id === "venice") ?? BUILTIN_THEME_FAMILIES[0];
  return cloneFamily(base);
}

function getCanonicalMode(family: ThemeFamily): ThemeMode {
  return luminance(family.variants.light.tokens.background) > 0.55 ? "light" : "dark";
}

const EMPTY_CUSTOM_THEMES: Theme[] = [];

/** Backwards-compatible single-mode Theme exporter.
 *  Serializes the theme as a V2 family with the same tokens in both variants. */
export async function themeToYaml(theme: Theme): Promise<string> {
  return serializeThemeFamilyYaml(familyFromTheme(theme));
}

/** Backwards-compatible single-mode Theme importer.
 *  Parses V2, V1, or legacy flat YAML and returns the family's canonical variant.
 *  Legacy documents that declare an explicit `mode` field preserve that mode. */
export async function yamlToTheme(yamlStr: string): Promise<Theme> {
  const family = parseThemeYaml(yamlStr);
  const explicitMode = yamlStr.match(/^mode:\s*(dark|light)$/m)?.[1] as ThemeMode | undefined;
  const mode = explicitMode || getCanonicalMode(family);
  return singleModeThemeFromFamily(family, mode);
}

interface ImportPreviewModalState {
  family: ThemeFamily;
  conflictId?: string;
  conflictName?: string;
}

export function ThemeMaker() {
  const { t: tRuntime } = useTranslation("common");
  const selectedThemeId =
    useSettingsStore((s) => s.selectedThemeId) || "builtin-venice";
  const customTheme = useSettingsStore((s) => s.customTheme);
  const customThemes =
    useSettingsStore((s) => s.customThemes) ?? EMPTY_CUSTOM_THEMES;
  const setSelectedThemeId = useSettingsStore((s) => s.setSelectedThemeId);
  const setCustomTheme = useSettingsStore((s) => s.setCustomTheme);
  const saveCustomTheme = useSettingsStore((s) => s.saveCustomTheme);
  const deleteCustomTheme = useSettingsStore((s) => s.deleteCustomTheme);
  const setAppearanceMode = useSettingsStore((s) => s.setAppearanceMode);
  const yamlThemes = useConfigStore((s) => s.yamlThemes);
  const setYamlThemes = useConfigStore((s) => s.setYamlThemes);

  // Registry maps.
  const builtInMap = useMemo(() => {
    const map: Record<string, ThemeFamily> = {};
    for (const family of BUILTIN_THEME_FAMILIES) {
      map[`builtin-${family.id}`] = family;
      map[family.id] = family;
    }
    return map;
  }, []);

  const customFamilyMap = useMemo(() => {
    const map: Record<string, ThemeFamily> = {};
    for (const theme of customThemes) {
      map[theme.id] = familyFromTheme(theme);
    }
    return map;
  }, [customThemes]);

  const allFamiliesMap = useMemo(() => {
    return {
      ...builtInMap,
      ...customFamilyMap,
      ...yamlThemes,
    };
  }, [builtInMap, customFamilyMap, yamlThemes]);

  const [selector, setSelector] = useState<string>(
    selectedThemeId || "builtin-venice",
  );
  const [draft, setDraft] = useState<ThemeFamily>(() => {
    const active = allFamiliesMap[selectedThemeId] ||
      (customTheme ? familyFromTheme(customTheme) : null) ||
      defaultCustomFamily();
    return cloneFamily(active);
  });
  const [previewMode, setPreviewMode] = useState<ThemeMode>(() => {
    const family = allFamiliesMap[selectedThemeId] || defaultCustomFamily();
    return getCanonicalMode(family);
  });
  const [importModal, setImportModal] =
    useState<ImportPreviewModalState | null>(null);

  // Reset the editor draft when the globally selected theme changes from outside.
  useEffect(() => {
    const active =
      allFamiliesMap[selectedThemeId] ||
      (customTheme ? familyFromTheme(customTheme) : null) ||
      defaultCustomFamily();
    setSelector(selectedThemeId || "builtin-venice");
    setDraft(cloneFamily(active));
    setPreviewMode(getCanonicalMode(active));
  }, [selectedThemeId, customTheme, customThemes, allFamiliesMap]);

  const isCustomSelected =
    selector === "custom" ||
    Boolean(customFamilyMap[selector]) ||
    Boolean(yamlThemes[selector]);

  const storedFamily = useMemo(() => {
    return (
      allFamiliesMap[selector] ||
      (customTheme ? familyFromTheme(customTheme) : null) ||
      defaultCustomFamily()
    );
  }, [allFamiliesMap, selector, customTheme]);

  const isDraftDirty = useMemo(() => {
    if (draft.id !== storedFamily.id || draft.name !== storedFamily.name) {
      return true;
    }
    for (const mode of ["light", "dark"] as ThemeMode[]) {
      if (
        JSON.stringify(draft.variants[mode].tokens) !==
        JSON.stringify(storedFamily.variants[mode].tokens)
      ) {
        return true;
      }
    }
    return false;
  }, [draft, storedFamily]);

  const themeOptions = useMemo(() => {
    const optionsMap = new Map<string, { id: string; label: string }>();
    const labelToIdMap = new Map<string, string>();

    function addOption(id: string, label: string) {
      if (labelToIdMap.has(label)) {
        const existingId = labelToIdMap.get(label)!;
        if (existingId !== id) {
          optionsMap.delete(existingId);
        }
      }
      optionsMap.set(id, { id, label });
      labelToIdMap.set(label, id);
    }

    // Built-ins use legacy "builtin-<id>" selectors for backwards compatibility.
    for (const family of BUILTIN_THEME_FAMILIES) {
      addOption(`builtin-${family.id}`, family.name);
    }

    // YAML themes override built-ins with the same display name.
    for (const [id, family] of Object.entries(yamlThemes)) {
      addOption(id, family.name);
    }

    // Custom user themes.
    for (const theme of customThemes) {
      addOption(theme.id, theme.name);
    }

    const options = sortThemeOptions(Array.from(optionsMap.values()));
    if (!optionsMap.has("custom")) {
      options.push({
        id: "custom",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.customTheme",
        ),
      });
    }
    return options;
  }, [yamlThemes, customThemes, tRuntime]);

  const applyDraft = React.useCallback((preview: ThemeMode) => {
    applyTheme(resolveTheme(draft, preview));
  }, [draft]);

  function handleSelect(id: string) {
    setSelector(id);
    if (id !== "custom") {
      const family = allFamiliesMap[id] || defaultCustomFamily();
      const mode = getCanonicalMode(family);
      setDraft(cloneFamily(family));
      setPreviewMode(mode);
      applyTheme(resolveTheme(family, mode));
      setSelectedThemeId(id);
      setAppearanceMode(mode);
      if (customThemes.find((t) => t.id === id)) {
        setCustomTheme(customThemes.find((t) => t.id === id) ?? null);
      }
    } else {
      const base = customTheme ? familyFromTheme(customTheme) : defaultCustomFamily();
      const mode = getCanonicalMode(base);
      setDraft(cloneFamily(base));
      setPreviewMode(mode);
      applyTheme(resolveTheme(base, mode));
    }
  }

  async function persistFamily(family: ThemeFamily, mode: ThemeMode) {
    const single = singleModeThemeFromFamily(family, mode);
    const result = await desktopConfig.saveTheme(family);
    if (!result.ok) throw new Error(result.error || "Theme persistence failed.");
    saveCustomTheme(single);
    setYamlThemes({
      ...useConfigStore.getState().yamlThemes,
      [family.id]: family,
    });
  }

  async function handleCreateNewFromActive() {
    const base = allFamiliesMap[selector] || draft || defaultCustomFamily();
    const mode = previewMode;
    const newFamily: ThemeFamily = {
      ...cloneFamily(base),
      id: `user-theme-${Date.now()}`,
      name: `${base.name} (Custom)`,
      aliases: [],
      builtIn: false,
    };
    setDraft(newFamily);
    setSelector(newFamily.id);
    applyTheme(resolveTheme(newFamily, mode));

    try {
      await persistFamily(newFamily, mode);
      toast.success(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.createdNewCustomThemeValue1",
          { value1: newFamily.name },
        ),
      );
    } catch (err) {
      toast.error(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.failedToCreateThemeValue1",
          { value1: redactErrorMessage(err) },
        ),
      );
    }
  }

  function updateToken(key: keyof ThemeTokens, value: string) {
    setDraft((prev: ThemeFamily) => {
      const next = cloneFamily(prev);
      next.variants[previewMode].tokens[key] = value;
      return next;
    });
  }

  function updatePreviewMode(mode: ThemeMode) {
    if (previewMode === mode) return;
    setPreviewMode(mode);
  }

  function updateName(name: string) {
    setDraft((prev: ThemeFamily) => ({ ...prev, name }));
  }

  useEffect(() => {
    applyDraft(previewMode);
  }, [applyDraft, draft, previewMode]);

  async function handleSave() {
    try {
      await persistFamily(draft, previewMode);
      setSelector(draft.id);
      setSelectedThemeId(draft.id);
      setAppearanceMode(previewMode);
      toast.success(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.themeValue1SavedSuccessfully",
          { value1: draft.name },
        ),
      );
    } catch (err) {
      toast.error(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.failedToSaveThemeValue1",
          { value1: redactErrorMessage(err) },
        ),
      );
    }
  }

  function handleReset() {
    const reverted = cloneFamily(storedFamily);
    setDraft(reverted);
    setPreviewMode(getCanonicalMode(reverted));
    applyTheme(resolveTheme(reverted, getCanonicalMode(reverted)));
    toast.info("Unsaved draft changes reset");
  }

  function handleRestoreDefaults() {
    const venice = BUILTIN_THEME_FAMILIES.find((f) => f.id === "venice") ?? BUILTIN_THEME_FAMILIES[0];
    const mode = getCanonicalMode(venice);
    setSelector("builtin-venice");
    setDraft(cloneFamily(venice));
    setPreviewMode(mode);
    applyTheme(resolveTheme(venice, mode));
    setSelectedThemeId("builtin-venice");
    setAppearanceMode(mode);
    setCustomTheme(null);
    toast.info("Restored default Venice theme");
  }

  async function handleDeleteCustom() {
    if (!isCustomSelected) return;
    const targetId = draft.id;
    try {
      const result = await desktopConfig.deleteTheme(targetId);
      if (!result.ok) throw new Error(result.error || "Theme deletion failed.");
      deleteCustomTheme(targetId);
      const nextYamlThemes = { ...useConfigStore.getState().yamlThemes };
      delete nextYamlThemes[targetId];
      setYamlThemes(nextYamlThemes);
      const settings = useSettingsStore.getState();
      const fallback =
        allFamiliesMap[settings.selectedThemeId] || defaultCustomFamily();
      setSelector(settings.selectedThemeId);
      setDraft(cloneFamily(fallback));
      setPreviewMode(getCanonicalMode(fallback));
      applyTheme(resolveTheme(fallback, getCanonicalMode(fallback)));
      toast.info("Custom theme deleted");
    } catch (err) {
      toast.error(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.failedToDeleteThemeValue1",
          { value1: redactErrorMessage(err) },
        ),
      );
    }
  }

  async function handleExport() {
    try {
      const yaml = serializeThemeFamilyYaml(draft);
      const filename = `${draft.name.toLowerCase().replace(/[^a-z0-9_-]/g, "_")}.theme.yaml`;
      await desktopFiles.exportYaml(yaml, filename);
      toast.success(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.themeExportedSuccessfully",
        ),
      );
    } catch (err) {
      toast.error(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.failedToExportTheme",
        ),
        redactErrorMessage(err),
      );
    }
  }

  async function handleImportClick() {
    try {
      const yaml = await desktopFiles.importYamlString();
      if (!yaml) return;
      const importedFamily = parseThemeYaml(yaml);

      const conflict = Object.values(customFamilyMap).find(
        (f) =>
          f.id === importedFamily.id ||
          f.name.toLowerCase() === importedFamily.name.toLowerCase(),
      );
      setImportModal({
        family: importedFamily,
        conflictId: conflict?.id,
        conflictName: conflict?.name,
      });
    } catch (err) {
      toast.error(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.failedToImportTheme",
        ),
        redactErrorMessage(err),
      );
    }
  }

  async function confirmImport(mode: "apply" | "copy" | "replace") {
    if (!importModal) return;
    const targetId =
      mode === "copy" || (mode === "apply" && importModal.conflictId)
        ? `user-theme-${Date.now()}`
        : mode === "replace" && importModal.conflictId
          ? importModal.conflictId
          : importModal.family.id;
    const targetName =
      mode === "copy" || (mode === "apply" && importModal.conflictId)
        ? `${importModal.family.name} (Imported)`
        : importModal.family.name;

    const finalFamily: ThemeFamily = {
      ...cloneFamily(importModal.family),
      id: targetId,
      name: targetName,
    };
    const targetMode = getCanonicalMode(finalFamily);
    try {
      await persistFamily(finalFamily, targetMode);
      setDraft(finalFamily);
      setSelector(finalFamily.id);
      applyTheme(resolveTheme(finalFamily, targetMode));
      setSelectedThemeId(finalFamily.id);
      setAppearanceMode(targetMode);
      setImportModal(null);
      toast.success(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.themeValue1ImportedAndApplied",
          { value1: finalFamily.name },
        ),
      );
    } catch (err) {
      toast.error(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.failedToImportThemeValue1",
          { value1: redactErrorMessage(err) },
        ),
      );
    }
  }

  const validColor = (v: string) => isValidColorValue(v);

  const previewTheme = singleModeThemeFromFamily(draft, previewMode);

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border/50 pb-4">
        <div>
          <h3 className="text-lg font-semibold text-text-primary">
            <Trans i18nKey="common:surface.componentsThememaker.heading.themeSystemEditor" />
          </h3>
          <p className="text-xs text-text-muted">
            <Trans i18nKey="common:surface.componentsThememaker.description.configureThemeColorsBorderContrastFocusRings" />
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn" onClick={handleCreateNewFromActive}>
            <Trans i18nKey="common:surface.componentsThememaker.action.createNewTheme" />
          </button>
          <button className="btn" onClick={handleImportClick}>
            <Trans i18nKey="common:surface.componentsThememaker.action.importTheme" />
          </button>
          <button className="btn" onClick={handleExport}>
            <Trans i18nKey="common:surface.componentsThememaker.action.exportTheme" />
          </button>
        </div>
      </div>

      {/* Theme Selector Palette */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label htmlFor="theme-maker-1" className="text-sm font-medium text-text-secondary">
            <Trans i18nKey="common:surface.componentsThememaker.label.selectActiveTheme" />
          </label>
          {isDraftDirty && (
            <span className="inline-flex items-center rounded-full bg-warning/20 px-2 py-0.5 text-xs font-medium text-warning border border-warning/30">
              <Trans i18nKey="common:surface.componentsThememaker.text.unsavedDraftChanges" />
            </span>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-64 overflow-y-auto p-2 border border-border rounded-lg bg-surface-elevated">
          {themeOptions.map((opt) => {
            const family = allFamiliesMap[opt.id];
            const isSelected = selector === opt.id;
            const familyMode = family ? getCanonicalMode(family) : "dark";
            const theme = family ? singleModeThemeFromFamily(family, familyMode) : null;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                ref={(el) => {
                  if (el && theme) {
                    el.style.setProperty('--theme-bg', theme.tokens.background);
                    el.style.setProperty('--theme-surface', theme.tokens.surface);
                    el.style.setProperty('--theme-accent', theme.tokens.accent);
                    el.style.setProperty('--theme-text', theme.tokens.textPrimary || 'inherit');
                  }
                }}
                className={`relative group flex flex-col overflow-hidden rounded-xl border text-left transition-all hover:shadow-sm ${
                  isSelected
                    ? "border-accent ring-1 ring-accent bg-surface"
                    : "border-border hover:border-accent/50 bg-surface"
                }`}
                aria-pressed={isSelected}
              >
                {theme ? (
                  <div
                    className="h-12 w-full flex border-b border-border/50 bg-[var(--theme-bg)]"
                    aria-hidden="true"
                  >
                    <div className="w-1/2 h-full flex items-end justify-start p-1 bg-[var(--theme-surface)]">
                      <div className="h-4 w-4 rounded-full shadow-sm bg-[var(--theme-accent)]" />
                    </div>
                  </div>
                ) : (
                  <div
                    className="h-12 w-full bg-surface-elevated flex items-center justify-center text-xs text-text-muted border-b border-border/50"
                    aria-hidden="true"
                  >
                    {/* Fallback placeholder */}
                  </div>
                )}
                <div className="px-2.5 py-2">
                  <div className="text-xs font-medium truncate text-[var(--theme-text,inherit)]">
                    {opt.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Draft Family Editor */}
      <div className="space-y-4 rounded-xl border border-border p-4 bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/50 pb-3">
          <div className="flex items-center gap-3">
            <input
              type="text" id="theme-maker-1"
              value={draft.name}
              onChange={(e) => updateName(e.target.value)}
              className="rounded-md border border-border bg-surface-elevated px-3 py-1 text-sm font-semibold text-text-primary"
              aria-label={tRuntime(
                "runtimeGenerated.components.thememaker.attribute.themeName",
              )}
            />
            <div className="flex items-center gap-1 rounded-lg border border-border bg-surface-elevated p-1">
              <button
                type="button"
                onClick={() => updatePreviewMode("dark")}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  previewMode === "dark"
                    ? "bg-accent text-accent-fg"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Trans i18nKey="common:surface.componentsThememaker.action.darkMode" />
              </button>
              <button
                type="button"
                onClick={() => updatePreviewMode("light")}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  previewMode === "light"
                    ? "bg-accent text-accent-fg"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Trans i18nKey="common:surface.componentsThememaker.action.lightMode" />
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn primary"
              onClick={handleSave}
              disabled={!isDraftDirty && selector === draft.id}
            >
              <Trans i18nKey="common:surface.componentsThememaker.action.saveTheme" />
            </button>
            <button
              className="btn"
              onClick={handleReset}
              disabled={!isDraftDirty}
            >
              {tRuntime("runtimeSlashLabels.cancelReset")}
            </button>
            {isCustomSelected && (
              <button className="btn danger" onClick={handleDeleteCustom}>
                <Trans i18nKey="common:surface.componentsThememaker.action.deleteTheme" />
              </button>
            )}
            <button className="btn ghost" onClick={handleRestoreDefaults}>
              <Trans i18nKey="common:surface.componentsThememaker.action.restoreDefaultTheme" />
            </button>
          </div>
        </div>

        {/* Semantic Token Categories */}
        <div className="space-y-6 pt-2">
          {TOKEN_CATEGORIES.map((cat) => (
            <div key={cat.name} className="space-y-2">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-text-muted border-b border-border/50 pb-1">
                {cat.name}
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {cat.keys.map((key) => {
                  const value = draft.variants[previewMode].tokens[key] || "";
                  const valid = validColor(value);
                  return (
                    <div
                      key={key}
                      className="flex items-center gap-2 rounded-md border border-border/60 p-2 bg-surface-elevated"
                    >
                      <input
                        type="color"
                        aria-label={tRuntime(
                          "runtimeGenerated.components.thememaker.attribute.value1ColorPicker",
                          { value1: TOKEN_LABELS[key] },
                        )}
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(value)
                            ? value
                            : COLOR_INPUT_FALLBACK
                        }
                        onChange={(e) => updateToken(key, e.target.value)}
                        className="h-7 w-8 shrink-0 rounded border border-border bg-transparent cursor-pointer"
                      />
                      <div className="flex flex-1 flex-col min-w-0">
                        <label
                          htmlFor={`token-${key}`}
                          className="text-xs text-text-secondary truncate"
                        >
                          {TOKEN_LABELS[key]}
                        </label>
                        <input
                          id={`token-${key}`}
                          type="text"
                          value={value}
                          onChange={(e) => updateToken(key, e.target.value)}
                          aria-invalid={!valid}
                          className={`w-full rounded border px-1.5 py-0.5 text-xs font-mono bg-surface text-text-primary ${
                            valid ? "border-border" : "border-danger"
                          }`}
                        />
                      </div>
                      {!valid && (
                        <span
                          role="alert"
                          className="text-[10px] text-danger shrink-0"
                        >
                          <Trans i18nKey="common:surface.componentsThememaker.text.invalid" />
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-text-secondary">
            <Trans i18nKey="common:surface.componentsThememaker.text.liveThemePreview" />
          </div>
          <span className="text-xs text-text-muted">
            <Trans i18nKey="common:surface.componentsThememaker.text.showingLivePreviewOfActiveDraft" />
          </span>
        </div>
        <ThemePreview theme={previewTheme} />
      </div>

      {/* Import Preview Modal */}
      {importModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="w-full max-w-xl rounded-xl border border-border bg-surface-elevated p-6 space-y-4 shadow-2xl">
            <div className="border-b border-border/50 pb-3">
              <h3 className="text-lg font-semibold text-text-primary">
                <Trans i18nKey="common:surface.componentsThememaker.heading.importThemePreview" />
              </h3>
              <p className="text-xs text-text-muted">
                <Trans i18nKey="common:surface.componentsThememaker.description.reviewThemeMetadataAndPreviewLayoutBefore" />
              </p>
            </div>

            <div className="space-y-2 text-sm text-text-secondary">
              <div>
                <strong>
                  <Trans i18nKey="common:surface.componentsThememaker.text.themeName" />
                </strong>{" "}
                {importModal.family.name}
              </div>
              <div>
                <strong>
                  <Trans i18nKey="common:surface.componentsThememaker.text.id" />
                </strong>{" "}
                {importModal.family.id}
              </div>
              {importModal.conflictName && (
                <div className="rounded-lg border border-warning/30 bg-warning/10 p-3 text-xs text-warning">
                  <Trans i18nKey="common:surface.componentsThememaker.text.aCustomThemeNamedLdquo" />
                  {importModal.conflictName}
                  <Trans i18nKey="common:surface.componentsThememaker.text.rdquoAlreadyExistsInYourWorkspace" />
                </div>
              )}
            </div>

            <div className="rounded-lg border border-border p-3 bg-surface">
              <div className="text-xs font-semibold text-text-muted mb-2">
                <Trans i18nKey="common:surface.componentsThememaker.text.importedLayoutPreview" />
              </div>
              <ThemePreview theme={singleModeThemeFromFamily(importModal.family, getCanonicalMode(importModal.family))} />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-border/50">
              <button
                className="btn ghost"
                onClick={() => setImportModal(null)}
              >
                <Trans i18nKey="common:surface.componentsThememaker.action.cancel" />
              </button>
              {importModal.conflictName && (
                <button
                  className="btn danger"
                  onClick={() => confirmImport("replace")}
                >
                  <Trans i18nKey="common:surface.componentsThememaker.action.replaceExisting" />
                </button>
              )}
              <button className="btn" onClick={() => confirmImport("copy")}>
                <Trans i18nKey="common:surface.componentsThememaker.action.importAsCopy" />
              </button>
              <button
                className="btn primary"
                onClick={() => confirmImport("apply")}
              >
                <Trans i18nKey="common:surface.componentsThememaker.action.importApply" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
