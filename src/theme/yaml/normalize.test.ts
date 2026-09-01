import { describe, it, expect } from 'vitest';
import { normalizeThemeFamilyYaml } from './normalize';

function validV2(): unknown {
  return {
    schemaVersion: 2,
    id: 'midnight-velvet',
    name: 'Midnight Velvet',
    aliases: ['velvet'],
    description: 'A dark theme',
    variants: {
      light: {
        tokens: {
          background: '#ffffff',
          surface: '#f6f8fa',
          surface_elevated: '#fcfcfc',
          surface_muted: '#eef1f4',
          border: '#d0d7de',
          border_strong: '#8c959f',
          text_primary: '#1f2328',
          text_secondary: '#57606a',
          text_muted: '#656d76',
          accent: '#0969da',
          accent_hover: '#0860ca',
          accent_foreground: '#ffffff',
          success: '#1a7f37',
          success_foreground: '#ffffff',
          warning: '#7a5200',
          warning_foreground: '#ffffff',
          danger: '#cf222e',
          danger_foreground: '#ffffff',
          info: '#0969da',
          input_background: '#fcfcfc',
          input_foreground: '#1f2328',
          placeholder: '#656d76',
          disabled_foreground: '#656d76',
          button_primary_background: '#0969da',
          button_primary_foreground: '#ffffff',
          button_secondary_background: '#fcfcfc',
          button_secondary_foreground: '#1f2328',
          link: '#0969da',
          focus_ring: '#0969da',
          selection_background: '#0969da',
          selection_foreground: '#ffffff',
          overlay: 'rgba(0, 0, 0, 0.4)',
          glow: 'rgba(9, 105, 218, 0.18)',
          foreground: '#1f2328',
          foreground_muted: '#57606a',
          foreground_subtle: '#656d76',
        },
      },
      dark: {
        tokens: {
          background: '#0a0e1a',
          surface: '#14182e',
          surface_elevated: '#1e2240',
          surface_muted: '#101428',
          border: '#2e3250',
          border_strong: '#4e5270',
          text_primary: '#f5e6e8',
          text_secondary: '#d0b8c0',
          text_muted: '#908090',
          accent: '#d8b4e2',
          accent_hover: '#e8c8f2',
          accent_foreground: '#0a0e1a',
          success: '#a5d6a7',
          success_foreground: '#0a0e1a',
          warning: '#ffcc80',
          warning_foreground: '#0a0e1a',
          danger: '#ef9a9a',
          danger_foreground: '#0a0e1a',
          info: '#90caf9',
          input_background: '#1e2240',
          input_foreground: '#f5e6e8',
          placeholder: '#908090',
          disabled_foreground: '#908090',
          button_primary_background: '#d8b4e2',
          button_primary_foreground: '#0a0e1a',
          button_secondary_background: '#1e2240',
          button_secondary_foreground: '#f5e6e8',
          link: '#90caf9',
          focus_ring: '#d8b4e2',
          selection_background: '#d8b4e2',
          selection_foreground: '#0a0e1a',
          overlay: 'rgba(10, 14, 26, 0.7)',
          glow: 'rgba(216, 180, 226, 0.25)',
          foreground: '#f5e6e8',
          foreground_muted: '#d0b8c0',
          foreground_subtle: '#908090',
        },
      },
    },
  };
}

describe('normalizeThemeFamilyYaml', () => {
  it('produces a valid ThemeFamily from a V2 document', () => {
    const family = normalizeThemeFamilyYaml(validV2());

    expect(family.schemaVersion).toBe(2);
    expect(family.id).toBe('midnight-velvet');
    expect(family.name).toBe('Midnight Velvet');
    expect(family.aliases).toEqual(['velvet']);
    expect(family.description).toBe('A dark theme');
    expect(family.builtIn).toBe(false);

    expect(family.variants.light.tokens.background).toBe('#ffffff');
    expect(family.variants.dark.tokens.background).toBe('#0a0e1a');
  });

  it('normalizes snake_case token keys to camelCase', () => {
    const family = normalizeThemeFamilyYaml(validV2());
    expect(family.variants.dark.tokens.surfaceElevated).toBe('#1e2240');
    expect(family.variants.dark.tokens.buttonPrimaryBackground).toBe('#d8b4e2');
  });

  it('completes semantic tokens even when only legacy tokens are provided', () => {
    const minimal = {
      schemaVersion: 2,
      id: 'minimal',
      name: 'Minimal',
      variants: {
        dark: {
          tokens: {
            background: '#000000',
            surface: '#111111',
            surface_elevated: '#222222',
            border: '#333333',
            text_primary: '#ffffff',
            text_secondary: '#cccccc',
            text_muted: '#888888',
            accent: '#ff0000',
            accent_hover: '#ff3333',
            accent_foreground: '#000000',
            success: '#00ff00',
            warning: '#ffff00',
            danger: '#ff0000',
            info: '#0000ff',
            focus_ring: '#ff0000',
            overlay: 'rgba(0, 0, 0, 0.5)',
            glow: 'rgba(255, 0, 0, 0.2)',
          },
        },
        light: {
          tokens: {
            background: '#ffffff',
            surface: '#f0f0f0',
            surface_elevated: '#e0e0e0',
            border: '#cccccc',
            text_primary: '#000000',
            text_secondary: '#333333',
            text_muted: '#666666',
            accent: '#0066cc',
            accent_hover: '#0055aa',
            accent_foreground: '#ffffff',
            success: '#228822',
            warning: '#cc8800',
            danger: '#cc2222',
            info: '#0066cc',
            focus_ring: '#0066cc',
            overlay: 'rgba(0, 0, 0, 0.25)',
            glow: 'rgba(0, 102, 204, 0.15)',
          },
        },
      },
    };

    const family = normalizeThemeFamilyYaml(minimal);
    expect(family.variants.dark.tokens.inputBackground).toBeDefined();
    expect(family.variants.dark.tokens.buttonSecondaryForeground).toBeDefined();
    expect(family.variants.light.tokens.foreground).toBe('#000000');
  });

  it('applies base.tokens and lets variant tokens override the base', () => {
    const doc = JSON.parse(JSON.stringify(validV2())) as Record<string, unknown>;
    (doc as Record<string, unknown>).base = {
      tokens: {
        accent: '#111111',
        danger: '#111111',
      },
    };
    const variants = (doc as Record<string, unknown>).variants as Record<string, Record<string, unknown>>;
    for (const mode of ['light', 'dark']) {
      const tokens = variants[mode].tokens as Record<string, string>;
      delete tokens.danger;
    }
    const family = normalizeThemeFamilyYaml(doc);
    // Variant-provided tokens override the base.
    expect(family.variants.light.tokens.accent).toBe('#0969da');
    expect(family.variants.dark.tokens.accent).toBe('#d8b4e2');
    // Base tokens fill variants that do not override them.
    expect(family.variants.light.tokens.danger).toBe('#111111');
    expect(family.variants.dark.tokens.danger).toBe('#111111');
  });
});
