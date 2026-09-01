import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
import { adaptSvgForTheme, applySvgPresentationOverrides, Meteocon } from './Meteocon';

describe('adaptSvgForTheme', () => {
  it('converts supported light-mode presentation overrides to attributes', () => {
    const source = '<svg><path id="Wind" stroke="#E2E8F0" /></svg>';
    const result = adaptSvgForTheme(source, 'wind', 'light');
    expect(result).toContain('id="Wind"');
    expect(result).toContain('stroke="#64748B"');
    expect(result).not.toMatch(/<style\b|\sstyle=/i);
  });

  it('does not emit style markup in dark mode', () => {
    const source = '<svg><path id="Wind" stroke="#E2E8F0" /></svg>';
    const result = adaptSvgForTheme(source, 'wind', 'dark');
    expect(result).toContain('id="Wind"');
    expect(result).toContain('stroke="#E2E8F0"');
    expect(result).not.toMatch(/<style\b|\sstyle=/i);
  });

  it('does not add unsupported properties or event handlers', () => {
    const source = '<svg><path id="Wind" stroke="#E2E8F0" /></svg>';
    const result = applySvgPresentationOverrides(source, {
      '#Wind': {
        stroke: '#64748B',
        // @ts-expect-error onclick is not an allowlisted SVG presentation property.
        onclick: 'alert(1)',
        fill: 'url(https://evil.test/x)',
      },
    });
    expect(result).toContain('stroke="#64748B"');
    expect(result).not.toContain('onclick');
    expect(result).not.toContain('evil.test');
    expect(result).not.toMatch(/<style\b|\sstyle=/i);
  });

  it('strips source <style> blocks and style attributes', () => {
    const source = '<svg><style>#Wind{stroke:red}</style><path id="Wind" style="stroke:#E2E8F0" /></svg>';
    const result = applySvgPresentationOverrides(source, {
      '#Wind': { stroke: '#64748B' },
    });
    expect(result).toContain('stroke="#64748B"');
    expect(result).not.toMatch(/<style\b/i);
    expect(result).not.toMatch(/\sstyle=/i);
  });

  it('converts safe source style declarations to presentation attributes', () => {
    const source = '<svg><mask id="m" style="mask-type:alpha"><rect width="10" height="10" /></mask></svg>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).toContain('mask-type="alpha"');
    expect(result).not.toMatch(/\sstyle=/i);
  });

  it('removes script elements and event handler attributes', () => {
    const source = '<svg><script>alert(1)</script><path onload="alert(2)" /></svg>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).not.toContain('<script');
    expect(result).not.toContain('alert(1)');
    expect(result).not.toContain('onload');
    expect(result).not.toContain('alert(2)');
  });

  it('removes external href references', () => {
    const source = '<svg><image href="https://evil.test/x" /><use href="https://evil.test/y" /></svg>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).not.toContain('evil.test');
    expect(result).not.toContain('href=');
  });

  it('preserves local fragment href references', () => {
    const source =
      '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><use xlink:href="#local" href="#local" /></svg>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).toContain('href="#local"');
  });

  it('does not convert unsafe style declarations to attributes', () => {
    const source = '<svg><path style="fill:url(https://evil.test/x)" /></svg>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).not.toContain('style=');
    expect(result).not.toContain('evil.test');
  });

  it('returns an empty svg instead of unsanitized markup on parse errors', () => {
    const source = '<div>not svg<script>alert(1)</script></div>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).toBe('<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    expect(result).not.toContain('script');
    expect(result).not.toContain('alert(1)');
  });

  it('strips javascript: hrefs', () => {
    const source = '<svg><a href="javascript:alert(1)" /><use href="javascript:alert(2)" /></svg>';
    const result = applySvgPresentationOverrides(source, {});
    expect(result).not.toContain('javascript:');
    expect(result).not.toContain('alert');
  });
});

describe('Meteocon component', () => {
  let originalThemeMode: string | undefined;

  beforeEach(() => {
    originalThemeMode = document.documentElement.dataset.themeMode;
  });

  afterEach(() => {
    if (originalThemeMode === undefined) {
      delete document.documentElement.dataset.themeMode;
    } else {
      document.documentElement.dataset.themeMode = originalThemeMode;
    }
  });

  it('renders without inline style markup in dark mode', () => {
    document.documentElement.dataset.themeMode = 'dark';
    const { container } = render(<Meteocon name="wind" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const html = svg!.outerHTML;
    expect(html).not.toMatch(/<style\b|\sstyle=/i);
    expect(html).toContain('id="Wind"');
  });

  it('renders without inline style markup in light mode', () => {
    document.documentElement.dataset.themeMode = 'light';
    const { container } = render(<Meteocon name="wind" />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    const html = svg!.outerHTML;
    expect(html).not.toMatch(/<style\b|\sstyle=/i);
    expect(html).toContain('stroke="#64748B"');
  });

  it('does not let caller-supplied HTML override the sanitized icon', () => {
    const { container } = render(
      <Meteocon
        name="wind"
        // @ts-expect-error hostile HTML override must not win at runtime
        dangerouslySetInnerHTML={{ __html: '<script>alert(1)</script>' }}
      />,
    );
    expect(container.innerHTML).not.toContain('<script');
    expect(container.innerHTML).not.toContain('alert(1)');
    expect(container.querySelector('svg')).toBeTruthy();
  });
});
