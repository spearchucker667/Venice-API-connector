import { describe, it, expect } from 'vitest';
import { SUPPORTED_LOCALES } from '../../src/i18n/locales';
import { LOCALE_COMPLETION } from '../../src/i18n/locale-completion-status';

describe('Phase 9 — isProductionComplete derives from status JSON', () => {
  type SupportedLocale = keyof typeof SUPPORTED_LOCALES;
  for (const locale of Object.keys(SUPPORTED_LOCALES) as SupportedLocale[]) {
    it(`${locale} isProductionComplete matches LOCALE_COMPLETION[${locale}]`, () => {
      expect(SUPPORTED_LOCALES[locale].isProductionComplete).toBe(
        LOCALE_COMPLETION[locale].isProductionComplete,
      );
    });
  }

  it('registry still declares 12 distinct supported locales', () => {
    expect(Object.keys(SUPPORTED_LOCALES).sort()).toEqual([
      'ar', 'de', 'en-US', 'es', 'fr', 'hi', 'ja', 'ko', 'pt-BR', 'ru', 'sv-SE', 'zh-CN',
    ]);
  });

  it('Arabic remains RTL in registry', () => {
    expect(SUPPORTED_LOCALES.ar.dir).toBe('rtl');
    expect(SUPPORTED_LOCALES['en-US'].dir).toBe('ltr');
  });

  it('en-US is derived true (canonical source language)', () => {
    expect(LOCALE_COMPLETION['en-US'].isProductionComplete).toBe(true);
  });
});
