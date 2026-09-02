import type { CodeSyntaxPresetId, CodeThemeTokens } from './themeTypes';
import { luminance } from './contrast';

/**
 * Bundled syntax-color presets. Each preset is a complete light/dark pair.
 * The same preset identifier can be used by multiple theme families when the
 * visual identity is close enough; family-specific presets exist when a family
 * needs a deliberately distinct code palette.
 */
export const CODE_SYNTAX_PRESETS: Record<
  CodeSyntaxPresetId,
  { light: CodeThemeTokens; dark: CodeThemeTokens }
> = {
  automatic: buildAutomaticPreset(),
  venice: buildVenicePreset(),
  dark: buildDarkPreset(),
  light: buildLightPreset(),
  dracula: buildDraculaPreset(),
  'gruvbox-dark': buildGruvboxDarkPreset(),
  rosepine: buildRosepinePreset(),
  nord: buildNordPreset(),
  'tokyo-night': buildTokyoNightPreset(),
  catppuccin: buildCatppuccinPreset(),
  solarized: buildSolarizedPreset(),
  'one-dark': buildOneDarkPreset(),
  monokai: buildMonokaiPreset(),
  'github-light': buildGitHubLightPreset(),
  'midnight-cobalt': buildMidnightCobaltPreset(),
  'obsidian-ember': buildObsidianEmberPreset(),
  'terminal-forest': buildTerminalForestPreset(),
  'porcelain-sky': buildPorcelainSkyPreset(),
  sandstone: buildSandstonePreset(),
  'obsidian-bloom': buildObsidianBloomPreset(),
  'harbor-fog': buildHarborFogPreset(),
  'circuit-mint': buildCircuitMintPreset(),
  'amber-archive': buildAmberArchivePreset(),
  'neon-dusk': buildNeonDuskPreset(),
  'aurora-boreal': buildAuroraBorealPreset(),
  'sakura-terminal': buildSakuraTerminalPreset(),
  'basalt-noir': buildBasaltNoirPreset(),
  'solar-ash': buildSolarAshPreset(),
  'cyber-orchid': buildCyberOrchidPreset(),
  'arctic-glass': buildArcticGlassPreset(),
  'desert-copperfield': buildDesertCopperfieldPreset(),
  'toxic-limewire': buildToxicLimewirePreset(),
  'midnight-velvet': buildMidnightVelvetPreset(),
  'porcelain-daybreak': buildPorcelainDaybreakPreset(),
  'synthwave-harbor': buildSynthwaveHarborPreset(),
  'moss-circuit': buildMossCircuitPreset(),
  'ember-monastery': buildEmberMonasteryPreset(),
  'glacial-ink': buildGlacialInkPreset(),
  'ultraviolet-rain': buildUltravioletRainPreset(),
  copper: buildCopperPreset(),
  'cotton-candy-console': buildCottonCandyConsolePreset(),
  'sweet-nightmare': buildSweetNightmarePreset(),
  'dual-persona': buildDualPersonaPreset(),
  'polaroid-board': buildPolaroidBoardPreset(),
};

function surface(
  background: string,
  foreground: string,
  border: string,
  headerBackground: string,
  headerForeground: string,
  inlineBackground: string,
  inlineForeground: string,
  selectionBackground: string,
): Pick<
  CodeThemeTokens,
  | 'background'
  | 'foreground'
  | 'border'
  | 'headerBackground'
  | 'headerForeground'
  | 'inlineBackground'
  | 'inlineForeground'
  | 'selectionBackground'
> {
  return {
    background,
    foreground,
    border,
    headerBackground,
    headerForeground,
    inlineBackground,
    inlineForeground,
    selectionBackground,
  };
}

function syntax(
  comment: string,
  punctuation: string,
  property: string,
  tag: string,
  boolean: string,
  number: string,
  constant: string,
  symbol: string,
  deleted: string,
  selector: string,
  attribute: string,
  string: string,
  character: string,
  builtin: string,
  inserted: string,
  operator: string,
  entity: string,
  url: string,
  atRule: string,
  keyword: string,
  functionToken: string,
  className: string,
  regex: string,
  important: string,
  variable: string,
): Pick<
  CodeThemeTokens,
  | 'comment'
  | 'punctuation'
  | 'property'
  | 'tag'
  | 'boolean'
  | 'number'
  | 'constant'
  | 'symbol'
  | 'deleted'
  | 'selector'
  | 'attribute'
  | 'string'
  | 'character'
  | 'builtin'
  | 'inserted'
  | 'operator'
  | 'entity'
  | 'url'
  | 'atRule'
  | 'keyword'
  | 'function'
  | 'className'
  | 'regex'
  | 'important'
  | 'variable'
> {
  return {
    comment,
    punctuation,
    property,
    tag,
    boolean,
    number,
    constant,
    symbol,
    deleted,
    selector,
    attribute,
    string,
    character,
    builtin,
    inserted,
    operator,
    entity,
    url,
    atRule,
    keyword,
    function: functionToken,
    className,
    regex,
    important,
    variable,
  };
}

function buildAutomaticPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  // The automatic preset is intentionally a readable fallback derived from UI
  // tokens at runtime; the values here are only used when something goes wrong.
  return {
    light: {
      ...surface('#f6f8fa', '#24292f', '#d0d7de', '#f3f4f6', '#57606a', '#eff1f3', '#24292f', '#b3e6ff'),
      ...syntax('#6e7781', '#24292f', '#0550ae', '#116329', '#0550ae', '#0550ae', '#0550ae', '#82071e', '#82071e', '#8250df', '#0550ae', '#0a3069', '#0a3069', '#0550ae', '#116329', '#24292f', '#cf222e', '#0a3069', '#cf222e', '#cf222e', '#8250df', '#953800', '#953800', '#8250df', '#24292f'),
    },
    dark: {
      ...surface('#161b22', '#c9d1d9', '#30363d', '#21262d', '#8b949e', '#21262d', '#c9d1d9', '#264f78'),
      ...syntax('#8b949e', '#c9d1d9', '#79c0ff', '#7ee787', '#79c0ff', '#79c0ff', '#79c0ff', '#ff7b72', '#ff7b72', '#d2a8ff', '#79c0ff', '#a5d6ff', '#a5d6ff', '#79c0ff', '#7ee787', '#c9d1d9', '#ff7b72', '#a5d6ff', '#ff7b72', '#ff7b72', '#d2a8ff', '#ffa657', '#ffa657', '#d2a8ff', '#c9d1d9'),
    },
  };
}

function buildVenicePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#ffffff', '#1f2937', '#e5e7eb', '#f9fafb', '#6b7280', '#f3f4f6', '#1f2937', '#ccfbf1'),
      ...syntax('#9ca3af', '#4b5563', '#0f766e', '#047857', '#0f766e', '#0f766e', '#0f766e', '#ef4444', '#ef4444', '#7c3aed', '#0f766e', '#0369a1', '#0369a1', '#0f766e', '#047857', '#4b5563', '#ea580c', '#0369a1', '#ea580c', '#ea580c', '#7c3aed', '#c2410c', '#c2410c', '#7c3aed', '#4b5563'),
    },
    dark: {
      ...surface('#0a0a0c', '#e5e7eb', '#27272a', '#18181b', '#a1a1aa', '#1c1c1f', '#e5e7eb', '#134e4a'),
      ...syntax('#71717a', '#a1a1aa', '#6ee7b7', '#34d399', '#6ee7b7', '#6ee7b7', '#6ee7b7', '#f87171', '#f87171', '#c084fc', '#6ee7b7', '#7dd3fc', '#7dd3fc', '#6ee7b7', '#34d399', '#a1a1aa', '#fb923c', '#7dd3fc', '#fb923c', '#fb923c', '#c084fc', '#fdba74', '#fdba74', '#c084fc', '#a1a1aa'),
    },
  };
}

function buildDarkPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#fafafa', '#383a42', '#e5e5e6', '#f0f0f0', '#4b5563', '#f0f0f0', '#383a42', '#d7d7d8'),
      ...syntax('#a0a1a7', '#383a42', '#4078f2', '#e45649', '#a626a4', '#a626a4', '#a626a4', '#e45649', '#e45649', '#50a14f', '#4078f2', '#50a14f', '#50a14f', '#0184bb', '#50a14f', '#383a42', '#c18401', '#50a14f', '#c18401', '#c18401', '#50a14f', '#986801', '#c18401', '#c18401', '#383a42'),
    },
    dark: {
      ...surface('#1e2127', '#c9d1d9', '#3e4451', '#25282f', '#c9d1d9', '#2c313a', '#c9d1d9', '#3e4451'),
      ...syntax('#8b949e', '#c9d1d9', '#61afef', '#e06c75', '#c678dd', '#c678dd', '#c678dd', '#e06c75', '#e06c75', '#98c379', '#61afef', '#98c379', '#98c379', '#56b6c2', '#98c379', '#c9d1d9', '#d19a66', '#98c379', '#d19a66', '#d19a66', '#98c379', '#e5c07b', '#d19a66', '#d19a66', '#c9d1d9'),
    },
  };
}

function buildLightPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#ffffff', '#1f2328', '#d0d7de', '#f6f8fa', '#656d76', '#eff1f3', '#1f2328', '#b3e6ff'),
      ...syntax('#6e7781', '#1f2328', '#0550ae', '#116329', '#0550ae', '#0550ae', '#0550ae', '#82071e', '#82071e', '#8250df', '#0550ae', '#0a3069', '#0a3069', '#0550ae', '#116329', '#1f2328', '#cf222e', '#0a3069', '#cf222e', '#cf222e', '#8250df', '#953800', '#953800', '#8250df', '#1f2328'),
    },
    dark: {
      ...surface('#0d1117', '#c9d1d9', '#30363d', '#161b22', '#8b949e', '#21262d', '#c9d1d9', '#264f78'),
      ...syntax('#8b949e', '#c9d1d9', '#79c0ff', '#7ee787', '#79c0ff', '#79c0ff', '#79c0ff', '#ff7b72', '#ff7b72', '#d2a8ff', '#79c0ff', '#a5d6ff', '#a5d6ff', '#79c0ff', '#7ee787', '#c9d1d9', '#ff7b72', '#a5d6ff', '#ff7b72', '#ff7b72', '#d2a8ff', '#ffa657', '#ffa657', '#d2a8ff', '#c9d1d9'),
    },
  };
}

function buildMidnightCobaltPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#f5f8ff', '#1e3a5f', '#c8d4e8', '#eef2fa', '#5a6f8f', '#eef2fa', '#1e3a5f', '#b8d4ff'),
      ...syntax('#5a6f8f', '#1e3a5f', '#2563eb', '#dc2626', '#7c3aed', '#7c3aed', '#7c3aed', '#dc2626', '#dc2626', '#16a34a', '#2563eb', '#0369a1', '#0369a1', '#2563eb', '#16a34a', '#1e3a5f', '#ea580c', '#0369a1', '#ea580c', '#ea580c', '#2563eb', '#0891b2', '#0369a1', '#ea580c', '#1e3a5f'),
    },
    dark: {
      ...surface('#070b14', '#c7d5f5', '#1e3a5f', '#0d1422', '#7b92b8', '#111a2b', '#c7d5f5', '#1e3a5f'),
      ...syntax('#7b92b8', '#c7d5f5', '#60a5fa', '#f87171', '#c084fc', '#c084fc', '#c084fc', '#f87171', '#f87171', '#4ade80', '#60a5fa', '#38bdf8', '#38bdf8', '#60a5fa', '#4ade80', '#c7d5f5', '#fb923c', '#38bdf8', '#fb923c', '#fb923c', '#60a5fa', '#22d3ee', '#38bdf8', '#fb923c', '#c7d5f5'),
    },
  };
}

function buildDraculaPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#f8f8f2', '#282a36', '#e9e9e4', '#f0f0ea', '#4b5563', '#f0f0ea', '#282a36', '#d6d6d6'),
      ...syntax('#6272a4', '#282a36', '#6272a4', '#ff79c6', '#bd93f9', '#bd93f9', '#bd93f9', '#ff5555', '#ff5555', '#50fa7b', '#6272a4', '#f1fa8c', '#f1fa8c', '#8be9fd', '#50fa7b', '#282a36', '#ff79c6', '#f1fa8c', '#ff79c6', '#ff79c6', '#50fa7b', '#8be9fd', '#f1fa8c', '#ff79c6', '#282a36'),
    },
    dark: {
      ...surface('#282a36', '#f8f8f2', '#44475a', '#343746', '#c9d1d9', '#44475a', '#f8f8f2', '#44475a'),
      ...syntax('#6272a4', '#f8f8f2', '#8be9fd', '#ff79c6', '#bd93f9', '#bd93f9', '#bd93f9', '#ff5555', '#ff5555', '#50fa7b', '#8be9fd', '#f1fa8c', '#f1fa8c', '#8be9fd', '#50fa7b', '#f8f8f2', '#ff79c6', '#f1fa8c', '#ff79c6', '#ff79c6', '#50fa7b', '#8be9fd', '#f1fa8c', '#ff79c6', '#f8f8f2'),
    },
  };
}

function buildGruvboxDarkPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#fbf1c7', '#3c3836', '#d5c4a1', '#ebdbb2', '#504945', '#ebdbb2', '#3c3836', '#d5c4a1'),
      ...syntax('#928374', '#3c3836', '#458588', '#9d0006', '#8f3f71', '#8f3f71', '#8f3f71', '#9d0006', '#9d0006', '#79740e', '#458588', '#79740e', '#79740e', '#b57614', '#79740e', '#3c3836', '#af3a03', '#79740e', '#af3a03', '#af3a03', '#b57614', '#b57614', '#b57614', '#af3a03', '#3c3836'),
    },
    dark: {
      ...surface('#282828', '#ebdbb2', '#504945', '#3c3836', '#fbf1c7', '#3c3836', '#ebdbb2', '#504945'),
      ...syntax('#928374', '#ebdbb2', '#83a598', '#fb4934', '#d3869b', '#d3869b', '#d3869b', '#fb4934', '#fb4934', '#b8bb26', '#83a598', '#b8bb26', '#b8bb26', '#fabd2f', '#b8bb26', '#ebdbb2', '#fe8019', '#b8bb26', '#fe8019', '#fe8019', '#fabd2f', '#fabd2f', '#fabd2f', '#fe8019', '#ebdbb2'),
    },
  };
}

function buildRosepinePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#faf4ed', '#575279', '#dfdad9', '#f2e9e1', '#575279', '#f2e9e1', '#575279', '#e0def4'),
      ...syntax('#9893a5', '#575279', '#286983', '#d7827e', '#907aa9', '#907aa9', '#907aa9', '#b4637a', '#b4637a', '#56949f', '#286983', '#ea9d34', '#ea9d34', '#56949f', '#56949f', '#575279', '#d7827e', '#ea9d34', '#d7827e', '#d7827e', '#56949f', '#b4637a', '#ea9d34', '#d7827e', '#575279'),
    },
    dark: {
      ...surface('#191724', '#e0def4', '#26233a', '#1f1d2e', '#c9d1d9', '#1f1d2e', '#e0def4', '#26233a'),
      ...syntax('#6e6a86', '#e0def4', '#9ccfd8', '#eb6f92', '#c4a7e7', '#c4a7e7', '#c4a7e7', '#eb6f92', '#eb6f92', '#f6c177', '#9ccfd8', '#f6c177', '#f6c177', '#9ccfd8', '#f6c177', '#e0def4', '#eb6f92', '#f6c177', '#eb6f92', '#eb6f92', '#f6c177', '#ebbcba', '#f6c177', '#eb6f92', '#e0def4'),
    },
  };
}

function buildNordPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#f9f9fb', '#2e3440', '#d8dee9', '#eceff4', '#4c566a', '#eceff4', '#2e3440', '#d8dee9'),
      ...syntax('#4c566a', '#2e3440', '#5e81ac', '#bf616a', '#b48ead', '#b48ead', '#b48ead', '#bf616a', '#bf616a', '#a3be8c', '#5e81ac', '#a3be8c', '#a3be8c', '#88c0d0', '#a3be8c', '#2e3440', '#d08770', '#a3be8c', '#d08770', '#d08770', '#5e81ac', '#8fbcbb', '#ebcb8b', '#d08770', '#2e3440'),
    },
    dark: {
      ...surface('#2e3440', '#d8dee9', '#4c566a', '#3b4252', '#c9d1d9', '#3b4252', '#d8dee9', '#434c5e'),
      ...syntax('#4c566a', '#d8dee9', '#81a1c1', '#bf616a', '#b48ead', '#b48ead', '#b48ead', '#bf616a', '#bf616a', '#a3be8c', '#81a1c1', '#a3be8c', '#a3be8c', '#88c0d0', '#a3be8c', '#d8dee9', '#d08770', '#a3be8c', '#d08770', '#d08770', '#81a1c1', '#8fbcbb', '#ebcb8b', '#d08770', '#d8dee9'),
    },
  };
}

function buildTokyoNightPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#f9f9fb', '#343b58', '#cfcfcf', '#e1e2e7', '#565f89', '#e1e2e7', '#343b58', '#c8d3f5'),
      ...syntax('#565f89', '#343b58', '#7aa2f7', '#f7768e', '#bb9af7', '#bb9af7', '#bb9af7', '#f7768e', '#f7768e', '#9ece6a', '#7aa2f7', '#e0af68', '#e0af68', '#7dcfff', '#9ece6a', '#343b58', '#ff9e64', '#e0af68', '#ff9e64', '#ff9e64', '#9ece6a', '#7dcfff', '#e0af68', '#ff9e64', '#343b58'),
    },
    dark: {
      ...surface('#1a1b26', '#a9b1d6', '#24283b', '#16161e', '#c9d1d9', '#16161e', '#a9b1d6', '#283457'),
      ...syntax('#565f89', '#a9b1d6', '#7aa2f7', '#f7768e', '#bb9af7', '#bb9af7', '#bb9af7', '#f7768e', '#f7768e', '#9ece6a', '#7aa2f7', '#e0af68', '#e0af68', '#7dcfff', '#9ece6a', '#a9b1d6', '#ff9e64', '#e0af68', '#ff9e64', '#ff9e64', '#9ece6a', '#7dcfff', '#e0af68', '#ff9e64', '#a9b1d6'),
    },
  };
}

function buildCatppuccinPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#eff1f5', '#4c4f69', '#ccd0da', '#e6e9ef', '#4c4f69', '#e6e9ef', '#4c4f69', '#bcc0cc'),
      ...syntax('#6c6f85', '#4c4f69', '#1e66f5', '#d20f39', '#8839ef', '#8839ef', '#8839ef', '#d20f39', '#d20f39', '#40a02b', '#1e66f5', '#df8e1d', '#df8e1d', '#04a5e5', '#40a02b', '#4c4f69', '#fe640b', '#df8e1d', '#fe640b', '#fe640b', '#40a02b', '#179299', '#ea76cb', '#fe640b', '#4c4f69'),
    },
    dark: {
      ...surface('#1e1e2e', '#cdd6f4', '#45475a', '#181825', '#c9d1d9', '#181825', '#cdd6f4', '#313244'),
      ...syntax('#6c7086', '#cdd6f4', '#89b4fa', '#f38ba8', '#cba6f7', '#cba6f7', '#cba6f7', '#f38ba8', '#f38ba8', '#a6e3a1', '#89b4fa', '#f9e2af', '#f9e2af', '#89dceb', '#a6e3a1', '#cdd6f4', '#fab387', '#f9e2af', '#fab387', '#fab387', '#a6e3a1', '#94e2d5', '#f5c2e7', '#fab387', '#cdd6f4'),
    },
  };
}

function buildSolarizedPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#fdf6e3', '#073642', '#d5c4a1', '#eee8d5', '#073642', '#eee8d5', '#073642', '#d3d1c7'),
      ...syntax('#93a1a1', '#657b83', '#268bd2', '#dc322f', '#6c71c4', '#6c71c4', '#6c71c4', '#dc322f', '#dc322f', '#859900', '#268bd2', '#2aa198', '#2aa198', '#b58900', '#859900', '#657b83', '#cb4b16', '#2aa198', '#cb4b16', '#cb4b16', '#859900', '#b58900', '#2aa198', '#cb4b16', '#657b83'),
    },
    dark: {
      ...surface('#002b36', '#93a1a1', '#073642', '#073642', '#93a1a1', '#073642', '#93a1a1', '#073642'),
      ...syntax('#586e75', '#839496', '#268bd2', '#dc322f', '#6c71c4', '#6c71c4', '#6c71c4', '#dc322f', '#dc322f', '#859900', '#268bd2', '#2aa198', '#2aa198', '#b58900', '#859900', '#839496', '#cb4b16', '#2aa198', '#cb4b16', '#cb4b16', '#859900', '#b58900', '#2aa198', '#cb4b16', '#839496'),
    },
  };
}

function buildOneDarkPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#fafafa', '#383a42', '#e5e5e6', '#f0f0f0', '#4b5563', '#f0f0f0', '#383a42', '#d7d7d8'),
      ...syntax('#a0a1a7', '#383a42', '#4078f2', '#e45649', '#a626a4', '#a626a4', '#a626a4', '#e45649', '#e45649', '#50a14f', '#4078f2', '#50a14f', '#50a14f', '#0184bb', '#50a14f', '#383a42', '#c18401', '#50a14f', '#c18401', '#c18401', '#50a14f', '#986801', '#c18401', '#c18401', '#383a42'),
    },
    dark: {
      ...surface('#282c34', '#abb2bf', '#3e4451', '#21252b', '#c9d1d9', '#21252b', '#abb2bf', '#3e4451'),
      ...syntax('#5c6370', '#abb2bf', '#61afef', '#e06c75', '#c678dd', '#c678dd', '#c678dd', '#e06c75', '#e06c75', '#98c379', '#61afef', '#98c379', '#98c379', '#56b6c2', '#98c379', '#abb2bf', '#d19a66', '#98c379', '#d19a66', '#d19a66', '#98c379', '#e5c07b', '#d19a66', '#d19a66', '#abb2bf'),
    },
  };
}

function buildMonokaiPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#f8f8f2', '#272822', '#e6e6e6', '#f0f0f0', '#4b5563', '#f0f0f0', '#272822', '#d6d6d6'),
      ...syntax('#75715e', '#272822', '#66d9ef', '#f92672', '#ae81ff', '#ae81ff', '#ae81ff', '#f92672', '#f92672', '#a6e22e', '#66d9ef', '#e6db74', '#e6db74', '#66d9ef', '#a6e22e', '#272822', '#fd971f', '#e6db74', '#fd971f', '#fd971f', '#a6e22e', '#66d9ef', '#e6db74', '#fd971f', '#272822'),
    },
    dark: {
      ...surface('#272822', '#f8f8f2', '#49483e', '#3e3d32', '#c9d1d9', '#3e3d32', '#f8f8f2', '#49483e'),
      ...syntax('#75715e', '#f8f8f2', '#66d9ef', '#f92672', '#ae81ff', '#ae81ff', '#ae81ff', '#f92672', '#f92672', '#a6e22e', '#66d9ef', '#e6db74', '#e6db74', '#66d9ef', '#a6e22e', '#f8f8f2', '#fd971f', '#e6db74', '#fd971f', '#fd971f', '#a6e22e', '#66d9ef', '#e6db74', '#fd971f', '#f8f8f2'),
    },
  };
}

function buildGitHubLightPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return {
    light: {
      ...surface('#ffffff', '#1f2328', '#d0d7de', '#f6f8fa', '#656d76', '#eff1f3', '#1f2328', '#b3e6ff'),
      ...syntax('#6e7781', '#1f2328', '#0550ae', '#116329', '#0550ae', '#0550ae', '#0550ae', '#82071e', '#82071e', '#8250df', '#0550ae', '#0a3069', '#0a3069', '#0550ae', '#116329', '#1f2328', '#cf222e', '#0a3069', '#cf222e', '#cf222e', '#8250df', '#953800', '#953800', '#8250df', '#1f2328'),
    },
    dark: {
      ...surface('#0d1117', '#c9d1d9', '#30363d', '#161b22', '#8b949e', '#21262d', '#c9d1d9', '#264f78'),
      ...syntax('#8b949e', '#c9d1d9', '#79c0ff', '#7ee787', '#79c0ff', '#79c0ff', '#79c0ff', '#ff7b72', '#ff7b72', '#d2a8ff', '#79c0ff', '#a5d6ff', '#a5d6ff', '#79c0ff', '#7ee787', '#c9d1d9', '#ff7b72', '#a5d6ff', '#ff7b72', '#ff7b72', '#d2a8ff', '#ffa657', '#ffa657', '#d2a8ff', '#c9d1d9'),
    },
  };
}

// Family-specific presets below mirror the family's accent palette while
// keeping a readable code surface. They are intentionally distinct from the
// canonical editor presets above.

function buildObsidianEmberPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#0d0d0d', '#f5f0e8', '#e85d4c', '#1a1a1a');
}

function buildTerminalForestPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f4f7f5', '#1a2f23', '#5cdb95', '#0d1f15');
}

function buildPorcelainSkyPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f7fbff', '#1e3a5f', '#60a5fa', '#e0f2fe');
}

function buildSandstonePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f5f0e6', '#3d342b', '#d4a373', '#e6dcc8');
}

function buildObsidianBloomPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1a1a2e', '#e0aaff', '#c77dff', '#16213e');
}

function buildHarborFogPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f0f4f8', '#2d3748', '#718096', '#e2e8f0');
}

function buildCircuitMintPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#0a0f0d', '#69f0ae', '#00e676', '#0d1f17');
}

function buildAmberArchivePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#fff8e7', '#3e2723', '#ffb300', '#ffecb3');
}

function buildNeonDuskPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1a0b2e', '#ff71ce', '#01cdfe', '#240c3a');
}

function buildAuroraBorealPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#050b14', '#80ffdb', '#64dfdf', '#0b1a2b');
}

function buildSakuraTerminalPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#fff5f7', '#4a2c32', '#ff8fa3', '#ffe4e9');
}

function buildBasaltNoirPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1c1c1c', '#ff6b6b', '#ff8787', '#2a2a2a');
}

function buildSolarAshPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1f120f', '#ff9f43', '#ff6b35', '#2d1b16');
}

function buildCyberOrchidPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#0f0518', '#ff00ff', '#bc13fe', '#1a0b2e');
}

function buildArcticGlassPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f0f9ff', '#0c4a6e', '#38bdf8', '#e0f2fe');
}

function buildDesertCopperfieldPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#2c1810', '#e9c46a', '#f4a261', '#3d241a');
}

function buildToxicLimewirePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#0a0a0a', '#39ff14', '#32cd32', '#111111');
}

function buildMidnightVelvetPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#120a21', '#b39ddb', '#9575cd', '#1e1135');
}

function buildPorcelainDaybreakPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#fffdf5', '#4a403a', '#f6ad55', '#fff5e6');
}

function buildSynthwaveHarborPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1a0b2e', '#ff71ce', '#01cdfe', '#240c3a');
}

function buildMossCircuitPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#0d1f13', '#a7f3d0', '#34d399', '#142e1e');
}

function buildEmberMonasteryPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1f120a', '#fb923c', '#ea580c', '#2d1b12');
}

function buildGlacialInkPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#081016', '#22d3ee', '#06b6d4', '#0c1c26');
}

function buildUltravioletRainPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#120a21', '#c084fc', '#a855f7', '#1e1135');
}

function buildCopperPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1c120c', '#d4a373', '#faedcd', '#2d1b14');
}

function buildCottonCandyConsolePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#fff0f6', '#831843', '#f472b6', '#fce7f3');
}

function buildSweetNightmarePreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#1a0b14', '#ff80ab', '#f50057', '#260b1a');
}

function buildDualPersonaPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f5f5f5', '#1a1a1a', '#6366f1', '#e5e5e5');
}

function buildPolaroidBoardPreset(): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  return buildFamilyPreset('#f7f7f7', '#2d2d2d', '#3b82f6', '#e8e8e8');
}

/**
 * Build a simple family-specific preset from a dark-mode palette. The light
 * variant is generated by lightening the dark surface and shifting syntax
 * colors to maintain contrast. This is a deliberate starting point; families
 * can be hand-tuned later without breaking the contract.
 */
function buildFamilyPreset(
  darkBg: string,
  darkFg: string,
  darkAccent: string,
  _darkSurface: string,
): { light: CodeThemeTokens; dark: CodeThemeTokens } {
  // Use a neutral, high-contrast foreground for code surfaces so readability
  // does not depend on the family's accent color.
  const darkCodeFg = luminance(darkBg) > 0.5 ? '#1f2937' : '#e5e7eb';
  const darkBorder = mix(darkBg, darkCodeFg, 0.25);
  const darkHeaderBg = mix(darkBg, darkCodeFg, 0.08);
  const darkInlineBg = mix(darkBg, darkCodeFg, 0.12);
  const darkHeaderFg = luminance(darkHeaderBg) > 0.5 ? '#4b5563' : '#c9d1d9';

  const dark = {
    ...surface(
      darkBg,
      darkCodeFg,
      darkBorder,
      darkHeaderBg,
      darkHeaderFg,
      darkInlineBg,
      darkCodeFg,
      mix(darkAccent, darkBg, 0.25),
    ),
    ...syntax(
      mix(darkCodeFg, darkBg, 0.55), // comment
      darkCodeFg, // punctuation
      darkAccent, // property
      '#f87171', // tag
      darkAccent, // boolean
      darkAccent, // number
      darkAccent, // constant
      darkAccent, // symbol
      '#f87171', // deleted
      '#a3e635', // selector
      darkAccent, // attribute
      '#fde047', // string
      '#fde047', // character
      darkAccent, // builtin
      '#a3e635', // inserted
      darkCodeFg, // operator
      '#f87171', // entity
      '#fde047', // url
      '#f87171', // atRule
      '#f87171', // keyword
      '#60a5fa', // function
      '#60a5fa', // className
      '#fde047', // regex
      '#f87171', // important
      darkCodeFg, // variable
    ),
  };

  // Light variant: keep hue but invert surface/foreground roles.
  const lightBg = '#ffffff';
  const lightFg = '#1f2937';
  const lightAccent = adjustLightness(darkAccent, 0.45);
  const light = {
    ...surface(lightBg, lightFg, '#e5e7eb', '#f9fafb', '#6b7280', '#f3f4f6', lightFg, mix(lightAccent, lightBg, 0.2)),
    ...syntax(
      '#9ca3af', // comment
      lightFg, // punctuation
      lightAccent, // property
      '#dc2626', // tag
      lightAccent, // boolean
      lightAccent, // number
      lightAccent, // constant
      lightAccent, // symbol
      '#dc2626', // deleted
      '#65a30d', // selector
      lightAccent, // attribute
      '#0369a1', // string
      '#0369a1', // character
      lightAccent, // builtin
      '#65a30d', // inserted
      lightFg, // operator
      '#dc2626', // entity
      '#0369a1', // url
      '#dc2626', // atRule
      '#dc2626', // keyword
      '#2563eb', // function
      '#2563eb', // className
      '#0369a1', // regex
      '#dc2626', // important
      lightFg, // variable
    ),
  };

  return { light, dark };
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHex({ r, g, b }: { r: number; g: number; b: number }): string {
  return `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
}

function mix(a: string, b: string, ratio: number): string {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex({
    r: ca.r * (1 - ratio) + cb.r * ratio,
    g: ca.g * (1 - ratio) + cb.g * ratio,
    b: ca.b * (1 - ratio) + cb.b * ratio,
  });
}


function adjustLightness(hex: string, factor: number): string {
  // Simple linear lightening toward white; not perceptually uniform but
  // sufficient for generating fallback light-mode syntax colors.
  return mix(hex, '#ffffff', factor);
}
