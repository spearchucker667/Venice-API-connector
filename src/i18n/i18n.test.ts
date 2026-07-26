/**
 * @fileoverview Unit tests for Venice Forge i18n core module.
 */

import { describe, expect, it, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useTranslation } from 'react-i18next';
import {
  changeLanguage,
  formatBytes,
  formatDate,
  formatDimensions,
  formatList,
  formatNumber,
  formatRelativeTime,
  formatTime,
  getTextDirection,
  i18n,
  NAMESPACES,
  normalizeLocaleCode,
  resolveEffectiveLocale,
  resolveSystemLocale,
  resources,
  SUPPORTED_LOCALES,
} from './index';

describe('i18n Core Module', () => {
  beforeEach(() => {
    changeLanguage('en-US');
  });

  describe('Locale Registry and Resolution', () => {
    it('supports 12 required locales', () => {
      const keys = Object.keys(SUPPORTED_LOCALES);
      expect(keys).toEqual(['en-US', 'es', 'fr', 'de', 'pt-BR', 'ru', 'zh-CN', 'ja', 'hi', 'ar', 'ko', 'sv-SE']);
    });

    it('identifies Arabic as RTL and all other locales as LTR', () => {
      expect(getTextDirection('ar')).toBe('rtl');
      expect(getTextDirection('en-US')).toBe('ltr');
      expect(getTextDirection('es')).toBe('ltr');
      expect(getTextDirection('zh-CN')).toBe('ltr');
    });

    it('resolves explicit locale setting correctly', () => {
      expect(resolveEffectiveLocale('es')).toBe('es');
      expect(resolveEffectiveLocale('ar')).toBe('ar');
      expect(resolveEffectiveLocale('zh-CN')).toBe('zh-CN');
    });

    it('resolves system language via navigator fallback chain', () => {
      expect(resolveSystemLocale(['es-ES', 'en-US'])).toBe('es');
      expect(resolveSystemLocale(['pt-BR', 'en-US'])).toBe('pt-BR');
      expect(resolveSystemLocale(['ar-SA', 'en'])).toBe('ar');
      expect(resolveSystemLocale(['unknown-lang'])).toBe('en-US');
    });

    it('normalizes every accepted alias and legacy locale code', () => {
      expect(normalizeLocaleCode('en')).toBe('en-US');
      expect(normalizeLocaleCode('en-us')).toBe('en-US');
      expect(normalizeLocaleCode('zh')).toBe('zh-CN');
      expect(normalizeLocaleCode('zh-Hans')).toBe('zh-CN');
      expect(normalizeLocaleCode('zh-cn')).toBe('zh-CN');
      expect(normalizeLocaleCode('sv')).toBe('sv-SE');
      expect(normalizeLocaleCode('SE')).toBe('sv-SE');
      expect(normalizeLocaleCode('sv-se')).toBe('sv-SE');
      expect(normalizeLocaleCode('pt')).toBe('pt-BR');
      expect(normalizeLocaleCode('ja')).toBe('ja');
      expect(normalizeLocaleCode('hi')).toBe('hi');
      expect(normalizeLocaleCode('ar')).toBe('ar');
      expect(normalizeLocaleCode('ko')).toBe('ko');
    });

    it('falls back to undefined when no alias matches', () => {
      expect(normalizeLocaleCode('xx-YY')).toBeUndefined();
      expect(normalizeLocaleCode('')).toBeUndefined();
      expect(normalizeLocaleCode(undefined)).toBeUndefined();
    });

    it('changeLanguage updates <html lang> + <html dir> for every supported locale', () => {
      for (const locale of Object.keys(SUPPORTED_LOCALES) as Array<keyof typeof SUPPORTED_LOCALES>) {
        changeLanguage(locale);
        expect(i18n.language).toBe(locale);
        expect(document.documentElement.lang).toBe(locale);
        expect(document.documentElement.dir).toBe(getTextDirection(locale));
      }
    });
  });

  describe('Language Switching & DOM Attributes', () => {
    it('interpolates variables through the React translation hook', () => {
      const { result } = renderHook(() => useTranslation(['settings', 'common']));
      expect(result.current.t('settings:profiles.aria.setPassword', { name: 'Personal' })).toBe(
        'Set password for Personal',
      );
    });

    it('updates active i18n language and HTML attributes immediately', () => {
      changeLanguage('es');
      expect(i18n.language).toBe('es');
      expect(document.documentElement.lang).toBe('es');
      expect(document.documentElement.dir).toBe('ltr');

      changeLanguage('ar');
      expect(i18n.language).toBe('ar');
      expect(document.documentElement.lang).toBe('ar');
      expect(document.documentElement.dir).toBe('rtl');
    });
  });

  describe('Resource Catalog Integrity', () => {
    it('contains all 11 namespaces for every supported locale', () => {
      const localeKeys = Object.keys(resources) as Array<keyof typeof resources>;
      for (const locale of localeKeys) {
        const nsKeys = Object.keys(resources[locale]);
        expect(nsKeys.sort()).toEqual([...NAMESPACES].sort());
      }
    });

    it('translates common keys correctly in different languages', () => {
      changeLanguage('en-US');
      expect(i18n.t('common:actions.save')).toBe('Save');

      changeLanguage('es');
      expect(i18n.t('common:actions.save')).toBe('Guardar');

      changeLanguage('ar');
      expect(i18n.t('common:actions.save')).toBe('حفظ');

      changeLanguage('zh-CN');
      expect(i18n.t('common:actions.save')).toBe('保存');
    });
  });

  describe('Formatters', () => {
    it('formats numbers according to active locale', () => {
      expect(formatNumber(1234567.89, 'en-US')).toContain('1,234,567.89');
      expect(formatNumber(1234567.89, 'de')).toContain('1.234.567,89');
    });

    it('formats bytes with locale number formatting', () => {
      expect(formatBytes(1500000, 'en-US')).toBe('1.4 MB');
      expect(formatBytes(0, 'en-US')).toBe('0 B');
    });

    it('formats image dimensions', () => {
      expect(formatDimensions(1920, 1080, 'en-US')).toBe('1,920 × 1,080');
    });

    it('formats dates and times', () => {
      const date = new Date('2026-07-25T12:00:00Z');
      expect(formatDate(date, 'en-US')).toBeTruthy();
      expect(formatTime(date, 'en-US')).toBeTruthy();
    });

    it('formats relative time and lists', () => {
      expect(formatRelativeTime(-1, 'day', 'en-US')).toBe('1 day ago');
      expect(formatList(['Alpha', 'Beta'], 'en-US')).toBe('Alpha and Beta');
    });
  });
});
