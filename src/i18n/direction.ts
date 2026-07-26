/**
 * @fileoverview DOM document language and text-direction manager.
 */

import { getTextDirection } from './locales';
import type { SupportedLocale, TextDirection } from './locale-types';

/**
 * Updates `<html lang="...">` and `<html dir="...">` on document root.
 */
export function applyDocumentDirection(locale: SupportedLocale): TextDirection {
  const dir = getTextDirection(locale);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }
  return dir;
}
