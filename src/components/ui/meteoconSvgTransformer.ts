/** Presentation properties that may be applied to SVG elements as attributes. */
export type SvgPresentationProperty = 'fill' | 'stroke' | 'stroke-width' | 'opacity';

/** Per-icon, per-element theme overrides expressed as presentation attributes. */
export type SvgPresentationOverrides = Readonly<
  Record<string, Readonly<Partial<Record<SvgPresentationProperty, string>>>>
>;

/**
 * Allowed values for presentation attributes applied by this transformer.
 * Hex colors, the keyword `none`, `currentColor`, and numeric values are
 * permitted. Complex CSS values such as `url(...)`, gradients, or arbitrary
 * strings are rejected.
 */
export const SAFE_SVG_VALUE = /^(?:#[0-9a-fA-F]{3,8}|none|currentColor|\d+(?:\.\d+)?)$/;

/**
 * Presentation attributes that may be converted from inline `style=""`
 * attributes to element attributes. Only a tiny, structural set is honoured
 * so that bundled SVG source can remain CSP-safe while preserving rendering.
 */
export const SAFE_SOURCE_STYLE_PROPERTIES = new Set(['mask-type']);

/**
 * Allowed values for source style properties that are converted to attributes.
 */
export const SAFE_SOURCE_STYLE_VALUES: Record<string, RegExp> = {
  'mask-type': /^(?:alpha|luminance)$/,
};

/**
 * Light-mode presentation overrides. In dark mode the bundled fill-variant
 * icons are designed for dark backgrounds and need no changes.
 *
 * In light mode we need to:
 *  - Make cloud fills visible (light grey → stronger grey)
 *  - Make white text/icon elements on coloured backgrounds dark
 *  - Make near-white strokes visible on white backgrounds
 *  - Keep dark-background dial icons (compass, barometer, horizon) visible
 *    by giving them a light slate background tint
 */
export const LIGHT_MODE_OVERRIDES: Record<string, SvgPresentationOverrides> = {
  // Cloud-body icons: near-invisible cloud gradients/strokes on white bg.
  'cloudy': {
    '#Cloud_2': { fill: '#CBD5E1', stroke: '#94A3B8' },
  },
  'partly-cloudy-day': {
    '#Cloud_2': { fill: '#CBD5E1', stroke: '#94A3B8' },
  },
  'thunderstorms': {
    '#Cloud_2': { fill: '#CBD5E1', stroke: '#94A3B8' },
    '#Lightning': { stroke: '#F6A823' },
  },
  'weather-alarm': {
    '#Cloud_2': { fill: '#CBD5E1', stroke: '#94A3B8' },
    '#Exclamation': { stroke: '#64748B' },
    '#ExclamationMark': { fill: '#F8FAFC' },
  },
  // Code-alert icons: keep the exclamation mark contrasting on light bg.
  'code-purple': {
    '#ExclamationMark': { fill: '#F8FAFC' },
  },
  'code-green': {
    '#ExclamationMark': { fill: '#F8FAFC' },
  },
  // Wind lines use #E2E8F0 (near-white) – invisible on light bg.
  'wind': {
    '#Wind': { stroke: '#64748B' },
    '[id^="Wind Line"]': { stroke: '#64748B' },
  },
  // Snowflake stroke is light blue – low contrast on white.
  'snowflake': {
    '#Snowflake_2': { stroke: '#0EA5E9' },
  },
  // Star uses very light yellow – deepen the stroke to amber.
  'star': {
    '#Star_2': { stroke: '#D97706' },
  },
  // Tornado strokes are light grey – deepen for light bg.
  'tornado': {
    '[id^="Tornado"]': { stroke: '#64748B' },
  },
  // Umbrella outer stroke is near-white – deepen for light bg.
  'umbrella': {
    '#Vector_2': { stroke: '#94A3B8' },
  },
};

/** Removes inline event handlers and non-local resource references. */
function sanitizeSvgElement(element: Element): void {
  for (const attribute of Array.from(element.attributes)) {
    if (/^on/i.test(attribute.name)) {
      element.removeAttribute(attribute.name);
    }
    if (
      (attribute.name === 'href' || attribute.name === 'xlink:href') &&
      !attribute.value.startsWith('#')
    ) {
      element.removeAttribute(attribute.name);
    }
  }
}

/** Parses a simple inline style declaration into property/value pairs. */
function parseInlineStyle(style: string): Array<[string, string]> {
  const declarations: Array<[string, string]> = [];
  for (const declaration of style.split(';')) {
    const colonIndex = declaration.indexOf(':');
    if (colonIndex === -1) continue;
    const property = declaration.slice(0, colonIndex).trim();
    const value = declaration.slice(colonIndex + 1).trim();
    if (property && value) {
      declarations.push([property, value]);
    }
  }
  return declarations;
}

/**
 * Converts allowed source `style=""` declarations to presentation attributes,
 * then removes the inline style attribute entirely. This preserves structural
 * SVG behaviour (e.g. `mask-type:alpha`) without retaining CSP-violating
 * inline styles.
 */
function convertSafeSourceStyles(element: Element): void {
  const style = element.getAttribute('style');
  if (!style) return;

  for (const [property, value] of parseInlineStyle(style)) {
    if (!SAFE_SOURCE_STYLE_PROPERTIES.has(property)) continue;
    const valuePattern = SAFE_SOURCE_STYLE_VALUES[property];
    if (!valuePattern || !valuePattern.test(value)) continue;
    element.setAttribute(property, value);
  }
  element.removeAttribute('style');
}

/**
 * Applies an allowlisted set of presentation-attribute overrides to an already
 * parsed SVG document. The transformer also strips any source `<style>`
 * elements, inline `style=""` attributes, event handlers, and non-local
 * references so that the serialized result is safe for a strict
 * `style-src 'self'` CSP.
 *
 * This function is environment-agnostic: callers supply a Document parsed by
 * the browser or by jsdom.
 *
 * @param doc Parsed SVG document.
 * @param overrides Per-selector presentation attributes to apply.
 */
export function sanitizeSvgDocument(
  doc: Document,
  overrides: SvgPresentationOverrides,
): void {
  const root = doc.documentElement;

  root
    .querySelectorAll('script, foreignObject, iframe, object, embed')
    .forEach((element) => element.remove());

  root.querySelectorAll('*').forEach((element) => {
    sanitizeSvgElement(element);
    convertSafeSourceStyles(element);
  });

  for (const [selector, properties] of Object.entries(overrides)) {
    for (const element of root.querySelectorAll(selector)) {
      for (const [property, value] of Object.entries(properties)) {
        if (!SAFE_SVG_VALUE.test(value)) continue;
        element.setAttribute(property, value);
      }
    }
  }

  root.querySelectorAll('style').forEach((element) => element.remove());
  root.querySelectorAll('[style]').forEach((element) => element.removeAttribute('style'));
}
