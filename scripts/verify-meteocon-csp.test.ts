// @vitest-environment node

import { describe, it, expect } from 'vitest';
import { scanMeteoconMarkup, extractImportedMeteoconPaths } from './verify-meteocon-csp.cjs';
import path from 'node:path';

describe('verify-meteocon-csp', () => {
  it('rejects generated Meteocon inline style markup', () => {
    const styleElementViolations = scanMeteoconMarkup('<svg><style>#Wind{stroke:red}</style></svg>');
    expect(styleElementViolations.length).toBeGreaterThan(0);
    expect(styleElementViolations.some((v) => /style element/i.test(v))).toBe(true);

    const styleAttrViolations = scanMeteoconMarkup('<svg><path style="stroke:red" /></svg>');
    expect(styleAttrViolations.length).toBeGreaterThan(0);
    expect(styleAttrViolations.some((v) => /style attribute/i.test(v))).toBe(true);
  });

  it('accepts presentation attributes', () => {
    expect(scanMeteoconMarkup('<svg><path stroke="#64748B" /></svg>')).toEqual([]);
  });

  it('enumerates imported Meteocon SVG paths', () => {
    const root = path.resolve(import.meta.dirname, '..');
    const sourcePath = path.join(root, 'src', 'components', 'ui', 'Meteocon.tsx');
    const imported = extractImportedMeteoconPaths(sourcePath);
    expect(imported).toContain('@meteocons/svg/fill/wind.svg');
    expect(imported).toContain('@meteocons/svg/fill/cloudy.svg');
    expect(imported.length).toBeGreaterThan(0);
  });
});
