import { translateRuntime } from "../i18n/runtimeTranslator";
import React, { useEffect, useMemo, useState } from "react";
import {
  BUILTIN_VENICE,
  BUILTIN_DARK,
  BUILTIN_LIGHT,
  BUILTIN_COPPER,
  BUILTIN_DRACULA,
  BUILTIN_GRUVBOX_DARK,
  BUILTIN_ROSEPINE,
  BUILTIN_NORD,
  BUILTIN_TOKYO_NIGHT,
  BUILTIN_CATPPUCCIN,
  BUILTIN_SOLARIZED_DARK,
  BUILTIN_SOLARIZED_LIGHT,
  BUILTIN_ONE_DARK,
  BUILTIN_MONOKAI,
  BUILTIN_GITHUB_LIGHT,
  BUILTIN_OBSIDIAN_BLOOM,
  BUILTIN_HARBOR_FOG,
  BUILTIN_CIRCUIT_MINT,
  BUILTIN_AMBER_ARCHIVE,
  BUILTIN_NEON_DUSK,
  BUILTIN_AURORA_BOREAL,
  BUILTIN_SAKURA_TERMINAL,
  BUILTIN_BASALT_NOIR,
  BUILTIN_SOLAR_ASH,
  BUILTIN_CYBER_ORCHID,
  BUILTIN_ARCTIC_GLASS,
  BUILTIN_DESERT_COPPERFIELD,
  BUILTIN_TOXIC_LIMEWIRE,
  BUILTIN_MIDNIGHT_VELVET,
  BUILTIN_PORCELAIN_DAYBREAK,
  BUILTIN_SYNTHWAVE_HARBOR,
  BUILTIN_MOSS_CIRCUIT,
  BUILTIN_EMBER_MONASTERY,
  BUILTIN_GLACIAL_INK,
  BUILTIN_ULTRAVIOLET_RAIN,
  applyTheme,
  completeThemeTokens,
  luminance,
  type Theme,
  type ThemeMode,
  type ThemeTokenInput,
  type ThemeTokens,
} from "../theme";
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

function cloneTheme(theme: Theme): Theme {
  return { ...theme, tokens: completeThemeTokens(theme.mode, theme.tokens) };
}

function defaultCustomTheme(): Theme {
  return {
    id: `custom-${Date.now()}`,
    name: "My Custom Theme",
    mode: "dark",
    tokens: completeThemeTokens("dark", BUILTIN_VENICE.tokens),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function camelToSnake(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function snakeToCamel(value: string): string {
  return value.replace(/_([a-z])/g, (_, letter: string) =>
    letter.toUpperCase(),
  );
}

function importedTokens(mode: ThemeMode, raw: unknown): ThemeTokens {
  if (!isRecord(raw))
    throw new Error("Invalid theme yaml: tokens must be a mapping.");
  const fallback = cloneTheme(
    mode === "light" ? BUILTIN_LIGHT : BUILTIN_VENICE,
  ).tokens;
  const merged: Record<string, string> = { ...fallback };
  for (const [rawKey, value] of Object.entries(raw)) {
    const key = snakeToCamel(rawKey);
    if (!(key in TOKEN_LABELS)) continue;
    if (typeof value !== "string" || !isValidColorValue(value)) {
      throw new Error(`Invalid color value for theme token ${rawKey}.`);
    }
    merged[key] = value;
  }
  return completeThemeTokens(mode, merged as unknown as ThemeTokenInput);
}

export async function themeToYaml(theme: Theme): Promise<string> {
  const { stringify } = await import("yaml");
  const tokens = Object.fromEntries(
    Object.entries(completeThemeTokens(theme.mode, theme.tokens)).map(
      ([key, value]) => [camelToSnake(key), value],
    ),
  );
  return stringify({
    version: 1,
    themes: {
      custom: {
        display_name: theme.name,
        mode: theme.mode,
        tokens,
      },
    },
  });
}

export async function yamlToTheme(yamlStr: string): Promise<Theme> {
  const { parse } = await import("yaml");
  const raw: unknown = parse(yamlStr);
  if (!isRecord(raw))
    throw new Error("Invalid theme yaml: root must be a mapping.");

  if (isRecord(raw.themes)) {
    const first = Object.values(raw.themes)[0];
    if (!isRecord(first))
      throw new Error("Invalid theme yaml: themes must contain an entry.");
    if (first.mode !== "dark" && first.mode !== "light") {
      throw new Error("Invalid theme yaml: mode must be dark or light.");
    }
    const mode: ThemeMode = first.mode === "light" ? "light" : "dark";
    const name =
      typeof first.display_name === "string" && first.display_name.trim()
        ? first.display_name.trim()
        : "Imported Theme";
    return {
      id: `custom-${Date.now()}`,
      name,
      mode,
      tokens: importedTokens(mode, first.tokens),
    };
  }

  const background = typeof raw.background === "string" ? raw.background : null;
  const foreground = typeof raw.foreground === "string" ? raw.foreground : null;
  const accent = typeof raw.accent === "string" ? raw.accent : null;
  const details = typeof raw.details === "string" ? raw.details : null;
  if (!background || !foreground || !accent) {
    throw new Error(
      "Invalid theme yaml: expected a themes block or legacy background/foreground/accent fields.",
    );
  }
  if (![background, foreground, accent].every(isValidColorValue)) {
    throw new Error(
      "Invalid theme yaml: legacy color fields contain an unsafe value.",
    );
  }

  const detailsIsColor =
    typeof details === "string" && isValidColorValue(details);
  const rawName =
    typeof raw.name === "string" && raw.name.trim() ? raw.name.trim() : null;
  const name =
    rawName || (detailsIsColor || !details ? "Imported Theme" : details);

  const inferredMode: ThemeMode =
    luminance(background) > 0.5 ? "light" : "dark";
  const mode: ThemeMode =
    raw.mode === "light" || raw.mode === "dark" ? raw.mode : inferredMode;

  const terminal = isRecord(raw.terminal_colors) ? raw.terminal_colors : {};
  const bright = isRecord(terminal.bright) ? terminal.bright : {};
  const normal = isRecord(terminal.normal) ? terminal.normal : {};
  const color = (
    record: Record<string, unknown>,
    key: string,
    fallback: string,
  ): string =>
    typeof record[key] === "string" && isValidColorValue(record[key])
      ? record[key]
      : fallback;

  const surfaceFallback =
    detailsIsColor && details ? details : color(normal, "black", background);
  const surfaceElevatedFallback =
    detailsIsColor && details ? details : color(bright, "black", background);
  const borderFallback =
    detailsIsColor && details ? details : color(normal, "white", foreground);
  const accentForeground = luminance(accent) > 0.5 ? foreground : background;

  const legacy: ThemeTokenInput = {
    background,
    surface: surfaceFallback,
    surfaceElevated: surfaceElevatedFallback,
    border: borderFallback,
    textPrimary: foreground,
    textSecondary: color(normal, "white", foreground),
    textMuted: color(bright, "black", foreground),
    accent,
    accentHover: color(bright, "blue", accent),
    accentForeground,
    success: color(bright, "green", "#74d66a"),
    warning: color(bright, "yellow", "#d6a84f"),
    danger: color(bright, "red", "#ef4444"),
    info: color(bright, "cyan", "#7da7ff"),
    focusRing: accent,
    overlay: mode === "light" ? "rgba(0, 0, 0, 0.25)" : "rgba(0, 0, 0, 0.6)",
    glow: `${accent}25`,
  };
  return {
    id: `custom-${Date.now()}`,
    name,
    mode,
    tokens: completeThemeTokens(mode, legacy),
  };
}

const EMPTY_CUSTOM_THEMES: Theme[] = [];

interface ImportPreviewModalState {
  theme: Theme;
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

  const builtInMap: Record<string, Theme> = useMemo(
    () => ({
      "builtin-venice": BUILTIN_VENICE,
      "builtin-dark": BUILTIN_DARK,
      "builtin-light": BUILTIN_LIGHT,
      "builtin-copper": BUILTIN_COPPER,
      "builtin-dracula": BUILTIN_DRACULA,
      "builtin-gruvbox-dark": BUILTIN_GRUVBOX_DARK,
      "builtin-rosepine": BUILTIN_ROSEPINE,
      "builtin-nord": BUILTIN_NORD,
      "builtin-tokyo-night": BUILTIN_TOKYO_NIGHT,
      "builtin-catppuccin": BUILTIN_CATPPUCCIN,
      "builtin-solarized-dark": BUILTIN_SOLARIZED_DARK,
      "builtin-solarized-light": BUILTIN_SOLARIZED_LIGHT,
      "builtin-one-dark": BUILTIN_ONE_DARK,
      "builtin-monokai": BUILTIN_MONOKAI,
      "builtin-github-light": BUILTIN_GITHUB_LIGHT,
      "builtin-obsidian-bloom": BUILTIN_OBSIDIAN_BLOOM,
      "builtin-harbor-fog": BUILTIN_HARBOR_FOG,
      "builtin-circuit-mint": BUILTIN_CIRCUIT_MINT,
      "builtin-amber-archive": BUILTIN_AMBER_ARCHIVE,
      "builtin-neon-dusk": BUILTIN_NEON_DUSK,
      "builtin-aurora-boreal": BUILTIN_AURORA_BOREAL,
      "builtin-sakura-terminal": BUILTIN_SAKURA_TERMINAL,
      "builtin-basalt-noir": BUILTIN_BASALT_NOIR,
      "builtin-solar-ash": BUILTIN_SOLAR_ASH,
      "builtin-cyber-orchid": BUILTIN_CYBER_ORCHID,
      "builtin-arctic-glass": BUILTIN_ARCTIC_GLASS,
      "builtin-desert-copperfield": BUILTIN_DESERT_COPPERFIELD,
      "builtin-toxic-limewire": BUILTIN_TOXIC_LIMEWIRE,
      "builtin-midnight-velvet": BUILTIN_MIDNIGHT_VELVET,
      "builtin-porcelain-daybreak": BUILTIN_PORCELAIN_DAYBREAK,
      "builtin-synthwave-harbor": BUILTIN_SYNTHWAVE_HARBOR,
      "builtin-moss-circuit": BUILTIN_MOSS_CIRCUIT,
      "builtin-ember-monastery": BUILTIN_EMBER_MONASTERY,
      "builtin-glacial-ink": BUILTIN_GLACIAL_INK,
      "builtin-ultraviolet-rain": BUILTIN_ULTRAVIOLET_RAIN,
    }),
    [],
  );

  const customThemesMap = useMemo(() => {
    const map: Record<string, Theme> = {};
    for (const theme of customThemes) {
      map[theme.id] = theme;
    }
    for (const [id, theme] of Object.entries(yamlThemes)) {
      if (!builtInMap[id]) {
        map[id] = theme;
      }
    }
    return map;
  }, [customThemes, yamlThemes, builtInMap]);

  const allThemesMap = useMemo(
    () => ({ ...builtInMap, ...customThemesMap, ...yamlThemes }),
    [builtInMap, customThemesMap, yamlThemes],
  );

  const [selector, setSelector] = useState<string>(
    selectedThemeId || "builtin-venice",
  );
  const [draft, setDraft] = useState<Theme>(() => {
    const active =
      allThemesMap[selectedThemeId] || customTheme || BUILTIN_VENICE;
    return cloneTheme(active);
  });
  const [importModal, setImportModal] =
    useState<ImportPreviewModalState | null>(null);

  // Intentional state-sync: Resets the editor draft when the globally selected
  // theme or available themes change from outside.
  useEffect(() => {
    setSelector(selectedThemeId || "builtin-venice");
    const active =
      allThemesMap[selectedThemeId] || customTheme || BUILTIN_VENICE;
    setDraft(cloneTheme(active));
  }, [selectedThemeId, customTheme, customThemes, allThemesMap]);

  const isCustomSelected =
    selector === "custom" || Boolean(customThemesMap[selector]);

  const isDraftDirty = useMemo(() => {
    const currentStored =
      allThemesMap[selector] || customTheme || BUILTIN_VENICE;
    if (draft.name !== currentStored.name || draft.mode !== currentStored.mode)
      return true;
    return (
      JSON.stringify(draft.tokens) !== JSON.stringify(currentStored.tokens)
    );
  }, [draft, selector, allThemesMap, customTheme]);

  const themeOptions = useMemo(() => {
    const builtInOptions = [
      {
        id: "builtin-venice",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.veniceParityDark",
        ),
      },
      {
        id: "builtin-dark",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeGraphite",
        ),
      },
      {
        id: "builtin-light",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeDaylight",
        ),
      },
      {
        id: "builtin-copper",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeCopper",
        ),
      },
      {
        id: "builtin-dracula",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeDracula",
        ),
      },
      {
        id: "builtin-gruvbox-dark",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.gruvboxDark",
        ),
      },
      {
        id: "builtin-rosepine",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.rosepine",
        ),
      },
      {
        id: "builtin-nord",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeNord",
        ),
      },
      {
        id: "builtin-tokyo-night",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeTokyo",
        ),
      },
      {
        id: "builtin-catppuccin",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeCatppuccin",
        ),
      },
      {
        id: "builtin-solarized-dark",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeSolarizedDark",
        ),
      },
      {
        id: "builtin-solarized-light",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeSolarizedLight",
        ),
      },
      {
        id: "builtin-one-dark",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeOneDark",
        ),
      },
      {
        id: "builtin-monokai",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeMonokai",
        ),
      },
      {
        id: "builtin-github-light",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.forgeGithubLight",
        ),
      },
      {
        id: "builtin-obsidian-bloom",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.obsidianBloom",
        ),
      },
      {
        id: "builtin-harbor-fog",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.harborFog",
        ),
      },
      {
        id: "builtin-circuit-mint",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.circuitMint",
        ),
      },
      {
        id: "builtin-amber-archive",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.amberArchive",
        ),
      },
      {
        id: "builtin-neon-dusk",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.neonDusk",
        ),
      },
      {
        id: "builtin-aurora-boreal",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.auroraBoreal",
        ),
      },
      {
        id: "builtin-sakura-terminal",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.sakuraTerminal",
        ),
      },
      {
        id: "builtin-basalt-noir",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.basaltNoir",
        ),
      },
      {
        id: "builtin-solar-ash",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.solarAsh",
        ),
      },
      {
        id: "builtin-cyber-orchid",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.cyberOrchid",
        ),
      },
      {
        id: "builtin-arctic-glass",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.arcticGlass",
        ),
      },
      {
        id: "builtin-desert-copperfield",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.desertCopperfield",
        ),
      },
      {
        id: "builtin-toxic-limewire",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.toxicLimewire",
        ),
      },
      {
        id: "builtin-midnight-velvet",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.midnightVelvet",
        ),
      },
      {
        id: "builtin-porcelain-daybreak",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.porcelainDaybreak",
        ),
      },
      {
        id: "builtin-synthwave-harbor",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.synthwaveHarbor",
        ),
      },
      {
        id: "builtin-moss-circuit",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.mossCircuit",
        ),
      },
      {
        id: "builtin-ember-monastery",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.emberMonastery",
        ),
      },
      {
        id: "builtin-glacial-ink",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.glacialInk",
        ),
      },
      {
        id: "builtin-ultraviolet-rain",
        label: tRuntime(
          "runtimeGenerated.components.thememaker.metadata.ultravioletRain",
        ),
      },
    ];

    const optionsMap = new Map<string, { id: string; label: string }>();
    const labelToIdMap = new Map<string, string>();

    // Add built-ins first
    builtInOptions.forEach((opt) => {
      optionsMap.set(opt.id, opt);
      labelToIdMap.set(opt.label, opt.id);
    });

    // Add yaml themes (overriding built-ins with the same exact name)
    Object.entries(yamlThemes).forEach(([id, theme]) => {
      if (labelToIdMap.has(theme.name)) {
        const existingId = labelToIdMap.get(theme.name)!;
        if (existingId !== id) {
          optionsMap.delete(existingId);
        }
      }
      optionsMap.set(id, { id, label: theme.name });
      labelToIdMap.set(theme.name, id);
    });

    // Add custom user themes
    Object.values(customThemesMap).forEach((theme) => {
      if (labelToIdMap.has(theme.name)) {
        const existingId = labelToIdMap.get(theme.name)!;
        if (existingId !== theme.id) {
          optionsMap.delete(existingId);
        }
      }
      optionsMap.set(theme.id, { id: theme.id, label: theme.name });
      labelToIdMap.set(theme.name, theme.id);
    });

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
  }, [yamlThemes, customThemesMap, tRuntime]);

  function handleSelect(id: string) {
    setSelector(id);
    if (id !== "custom") {
      const theme = allThemesMap[id] || BUILTIN_VENICE;
      setDraft(cloneTheme(theme));
      applyTheme(theme);
      setSelectedThemeId(id);
      setAppearanceMode(theme.mode);
      if (customThemesMap[id]) {
        setCustomTheme(customThemesMap[id]);
      }
    } else {
      const base = customTheme ? cloneTheme(customTheme) : defaultCustomTheme();
      setDraft(base);
      applyTheme(base);
    }
  }

  async function handleCreateNewFromActive() {
    const base = allThemesMap[selector] || draft || BUILTIN_VENICE;
    const newTheme: Theme = {
      id: `user-theme-${Date.now()}`,
      name: `${base.name} (Custom)`,
      mode: base.mode,
      tokens: completeThemeTokens(base.mode, base.tokens),
    };
    setDraft(newTheme);
    setSelector(newTheme.id);
    applyTheme(newTheme);

    try {
      const result = await desktopConfig.saveTheme(newTheme);
      if (!result.ok)
        throw new Error(result.error || "Theme persistence failed.");
      saveCustomTheme(newTheme);
      setYamlThemes({
        ...useConfigStore.getState().yamlThemes,
        [newTheme.id]: newTheme,
      });
      toast.success(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.createdNewCustomThemeValue1",
          { value1: newTheme.name },
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
    setDraft((prev: Theme) => {
      const next = cloneTheme(prev);
      next.tokens[key] = value;
      return next;
    });
  }

  function updateMode(mode: ThemeMode) {
    setDraft((prev: Theme) => {
      const next = cloneTheme(prev);
      next.mode = mode;
      return next;
    });
  }

  function updateName(name: string) {
    setDraft((prev: Theme) => ({ ...prev, name }));
  }

  useEffect(() => {
    if (isCustomSelected || isDraftDirty) {
      applyTheme(draft);
    }
  }, [draft, isCustomSelected, isDraftDirty]);

  async function handleSave() {
    try {
      const result = await desktopConfig.saveTheme(draft);
      if (!result.ok)
        throw new Error(result.error || "Theme persistence failed.");
      saveCustomTheme(draft);
      setYamlThemes({
        ...useConfigStore.getState().yamlThemes,
        [draft.id]: draft,
      });
      setSelector(draft.id);
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
    const stored = allThemesMap[selector] || customTheme || BUILTIN_VENICE;
    const reverted = cloneTheme(stored);
    setDraft(reverted);
    applyTheme(reverted);
    toast.info("Unsaved draft changes reset");
  }

  function handleRestoreDefaults() {
    setSelector("builtin-venice");
    applyTheme(BUILTIN_VENICE);
    setSelectedThemeId("builtin-venice");
    setAppearanceMode("dark");
    setCustomTheme(null);
    setDraft(cloneTheme(BUILTIN_VENICE));
    toast.info("Restored default Venice theme");
  }

  async function handleDeleteCustom() {
    if (!customThemesMap[selector] && selector !== "custom") return;
    const targetId = selector;
    try {
      const result = await desktopConfig.deleteTheme(targetId);
      if (!result.ok) throw new Error(result.error || "Theme deletion failed.");
      deleteCustomTheme(targetId);
      const nextYamlThemes = { ...useConfigStore.getState().yamlThemes };
      delete nextYamlThemes[targetId];
      setYamlThemes(nextYamlThemes);
      const settings = useSettingsStore.getState();
      const fallback = allThemesMap[settings.selectedThemeId] || BUILTIN_VENICE;
      setSelector(settings.selectedThemeId);
      setDraft(cloneTheme(fallback));
      applyTheme(fallback);
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
      const yaml = await themeToYaml(draft);
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
      const importedTheme = await yamlToTheme(yaml);

      const conflict = Object.values(customThemesMap).find(
        (t) =>
          t.id === importedTheme.id ||
          t.name.toLowerCase() === importedTheme.name.toLowerCase(),
      );
      setImportModal({
        theme: importedTheme,
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
          : importModal.theme.id;
    const targetName =
      mode === "copy" || (mode === "apply" && importModal.conflictId)
        ? `${importModal.theme.name} (Imported)`
        : importModal.theme.name;

    const finalTheme: Theme = {
      ...cloneTheme(importModal.theme),
      id: targetId,
      name: targetName,
    };
    try {
      const result = await desktopConfig.saveTheme(finalTheme);
      if (!result.ok)
        throw new Error(result.error || "Theme persistence failed.");
      saveCustomTheme(finalTheme);
      setYamlThemes({
        ...useConfigStore.getState().yamlThemes,
        [finalTheme.id]: finalTheme,
      });
      setDraft(finalTheme);
      setSelector(finalTheme.id);
      applyTheme(finalTheme);
      setImportModal(null);
      toast.success(
        tRuntime(
          "runtimeGenerated.components.thememaker.notification.themeValue1ImportedAndApplied",
          { value1: finalTheme.name },
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
            const theme = allThemesMap[opt.id];
            const isSelected = selector === opt.id;
            return (
              <button
                key={opt.id}
                onClick={() => handleSelect(opt.id)}
                className={`relative group flex flex-col overflow-hidden rounded-xl border text-left transition-all hover:shadow-sm ${
                  isSelected
                    ? "border-accent ring-1 ring-accent bg-surface"
                    : "border-border hover:border-accent/50 bg-surface"
                }`}
                aria-pressed={isSelected}
              >
                {theme ? (
                  <div 
                    className="h-12 w-full flex border-b border-border/50" 
                    style={{ backgroundColor: theme.tokens.background }}
                  >
                    <div 
                      className="w-1/2 h-full flex items-end justify-start p-1"
                      style={{ backgroundColor: theme.tokens.surface }}
                    >
                      <div className="h-4 w-4 rounded-full shadow-sm" style={{ backgroundColor: theme.tokens.accent }} />
                    </div>
                  </div>
                ) : (
                  <div className="h-12 w-full bg-surface-elevated flex items-center justify-center text-xs text-text-muted border-b border-border/50">
                    Custom
                  </div>
                )}
                <div className="px-2.5 py-2">
                  <div className="text-xs font-medium truncate" style={{ color: theme?.tokens.textPrimary || 'inherit' }}>
                    {opt.label}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Draft Custom Editor */}
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
                onClick={() => updateMode("dark")}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  draft.mode === "dark"
                    ? "bg-accent text-accent-fg"
                    : "text-text-muted hover:text-text-primary"
                }`}
              >
                <Trans i18nKey="common:surface.componentsThememaker.action.darkMode" />
              </button>
              <button
                type="button"
                onClick={() => updateMode("light")}
                className={`rounded px-2 py-0.5 text-xs font-medium ${
                  draft.mode === "light"
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
            {customThemesMap[selector] && (
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
                  const value = draft.tokens[key] || "";
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
        <ThemePreview theme={draft} />
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
                {importModal.theme.name}
              </div>
              <div>
                <strong>
                  <Trans i18nKey="common:surface.componentsThememaker.text.mode" />
                </strong>{" "}
                {importModal.theme.mode}
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
              <ThemePreview theme={importModal.theme} />
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
