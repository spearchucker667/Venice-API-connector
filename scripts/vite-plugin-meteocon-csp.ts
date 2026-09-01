/**
 * Build-time Vite plugin for CSP-safe Meteocon SVG assets.
 *
 * Bundled `@meteocons/svg/fill/*.svg?raw` imports contain inline
 * `style="mask-type:alpha"` attributes on mask elements. If left as-is,
 * those raw strings are emitted into `dist` renderer assets and violate the
 * production `style-src 'self'` Content-Security-Policy.
 *
 * This plugin runs at build time via `jsdom`, converting allowed source
 * `style` declarations to presentation attributes and stripping the rest
 * before Vite inlines the SVG strings, keeping the built bundle free of
 * inline SVG style markup.
 */

import type { Plugin } from 'vite';
import { JSDOM } from 'jsdom';
import { sanitizeSvgDocument } from '../src/components/ui/meteoconSvgTransformer';

/**
 * Vite plugin that sanitizes @meteocons SVG raw imports at build time.
 *
 * The bundled SVG source contains inline `style="mask-type:alpha"` attributes
 * on mask elements. The runtime Meteocon component strips these, but the raw
 * strings would still be present in the built renderer assets and fail the
 * static CSP verifier. This plugin converts allowed source style declarations
 * to presentation attributes and removes the rest before Vite inlines the
 * strings, so the built bundle remains free of inline SVG style markup.
 */
export function meteoconCspPlugin(): Plugin {
  const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
  const { DOMParser, XMLSerializer } = dom.window;

  return {
    name: 'meteocon-csp',
    transform(code, id) {
      if (!/@meteocons\/svg\/fill\/[^/]+\.svg\?raw$/.test(id)) return;

      // Vite ?raw imports are emitted as `export default "...";`
      const match = code.match(/^export default\s+("(?:[^"\\]|\\.)*");?\s*$/s);
      if (!match) return;

      const rawSvg = JSON.parse(match[1]) as string;
      const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
      const root = doc.documentElement;
      if (root.nodeName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
        return;
      }

      sanitizeSvgDocument(doc, {});
      const sanitized = new XMLSerializer().serializeToString(root);
      return `export default ${JSON.stringify(sanitized)};`;
    },
  };
}
