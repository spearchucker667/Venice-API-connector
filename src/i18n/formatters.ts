/**
 * @fileoverview Locale-aware Intl formatting helpers for numbers, dates, times, durations, and byte sizes.
 */

import { DEFAULT_LOCALE } from './locales';
import type { SupportedLocale } from './locale-types';

let currentFormatterLocale: SupportedLocale = DEFAULT_LOCALE;

/**
 * Set global active locale used by formatters when locale argument is omitted.
 */
export function setFormatterLocale(locale: SupportedLocale): void {
  currentFormatterLocale = locale;
}

export function getFormatterLocale(): SupportedLocale {
  return currentFormatterLocale;
}

export function formatNumber(
  value: number,
  locale: SupportedLocale = currentFormatterLocale,
  options?: Intl.NumberFormatOptions,
): string {
  if (!Number.isFinite(value)) return '0';
  return new Intl.NumberFormat(locale, options).format(value);
}

export function formatDate(
  date: Date | number | string,
  locale: SupportedLocale = currentFormatterLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium' },
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatTime(
  date: Date | number | string,
  locale: SupportedLocale = currentFormatterLocale,
  options: Intl.DateTimeFormatOptions = { timeStyle: 'short' },
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatDateTime(
  date: Date | number | string,
  locale: SupportedLocale = currentFormatterLocale,
  options: Intl.DateTimeFormatOptions = { dateStyle: 'medium', timeStyle: 'short' },
): string {
  const d = date instanceof Date ? date : new Date(date);
  if (isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat(locale, options).format(d);
}

export function formatRelativeTime(
  value: number,
  unit: Intl.RelativeTimeFormatUnit,
  locale: SupportedLocale = currentFormatterLocale,
  options?: Intl.RelativeTimeFormatOptions,
): string {
  if (typeof Intl.RelativeTimeFormat === 'undefined') {
    return `${value} ${unit}`;
  }
  return new Intl.RelativeTimeFormat(locale, options).format(value, unit);
}

export function formatList(
  list: string[],
  locale: SupportedLocale = currentFormatterLocale,
  options: Intl.ListFormatOptions = { style: 'long', type: 'conjunction' },
): string {
  if (!Array.isArray(list) || list.length === 0) return '';
  if (typeof Intl.ListFormat === 'undefined') {
    return list.join(', ');
  }
  return new Intl.ListFormat(locale, options).format(list);
}

export function formatBytes(
  bytes: number,
  locale: SupportedLocale = currentFormatterLocale,
): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return `0 B`;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  const formattedNumber = formatNumber(n, locale, {
    maximumFractionDigits: n >= 100 || i === 0 ? 0 : 1,
    minimumFractionDigits: 0,
  });
  return `${formattedNumber} ${units[i]}`;
}

export function formatDimensions(
  width: number,
  height: number,
  locale: SupportedLocale = currentFormatterLocale,
): string | null {
  const w = Math.round(width);
  const h = Math.round(height);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  return `${formatNumber(w, locale)} × ${formatNumber(h, locale)}`;
}
