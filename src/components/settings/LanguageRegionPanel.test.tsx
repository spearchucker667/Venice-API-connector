/**
 * @fileoverview Component tests for LanguageRegionPanel.
 */

import React from 'react';
import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LanguageRegionPanel } from './LanguageRegionPanel';
import { useSettingsStore } from '../../stores/settings-store';
import { changeLanguage } from '../../i18n';

describe('LanguageRegionPanel', () => {
  beforeEach(() => {
    useSettingsStore.setState({ uiLocale: 'system' });
    changeLanguage('system');
  });

  it('renders language selector and formatting preview', () => {
    render(<LanguageRegionPanel />);
    expect(screen.getByText('Language & Region')).toBeDefined();
    expect(screen.getByLabelText('Interface Language')).toBeDefined();
    expect(screen.getByText('Regional Formatting Preview')).toBeDefined();
  });

  it('updates locale immediately when dropdown selection changes', () => {
    render(<LanguageRegionPanel />);
    const select = screen.getByLabelText('Interface Language') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'es' } });

    expect(useSettingsStore.getState().uiLocale).toBe('es');
    expect(document.documentElement.lang).toBe('es');
  });

  it('updates text direction for RTL locales like Arabic', () => {
    render(<LanguageRegionPanel />);
    const select = screen.getByLabelText('Interface Language') as HTMLSelectElement;

    fireEvent.change(select, { target: { value: 'ar' } });

    expect(useSettingsStore.getState().uiLocale).toBe('ar');
    expect(document.documentElement.dir).toBe('rtl');
    expect(document.documentElement.lang).toBe('ar');
  });
});
