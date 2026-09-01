import React, { useLayoutEffect, useRef, useState, useEffect } from 'react';

import clearDay from '@meteocons/svg/fill/clear-day.svg?raw';
import clearNight from '@meteocons/svg/fill/clear-night.svg?raw';
import cloudy from '@meteocons/svg/fill/cloudy.svg?raw';
import partlyCloudyDay from '@meteocons/svg/fill/partly-cloudy-day.svg?raw';
import thunderstorms from '@meteocons/svg/fill/thunderstorms.svg?raw';
import compass from '@meteocons/svg/fill/compass.svg?raw';
import barometer from '@meteocons/svg/fill/barometer.svg?raw';
import star from '@meteocons/svg/fill/star.svg?raw';
import timeMorning from '@meteocons/svg/fill/time-morning.svg?raw';
import timeNight from '@meteocons/svg/fill/time-night.svg?raw';
import rainbowClear from '@meteocons/svg/fill/rainbow-clear.svg?raw';
import horizon from '@meteocons/svg/fill/horizon.svg?raw';
import wind from '@meteocons/svg/fill/wind.svg?raw';
import codePurple from '@meteocons/svg/fill/code-purple.svg?raw';
import codeGreen from '@meteocons/svg/fill/code-green.svg?raw';
import umbrella from '@meteocons/svg/fill/umbrella.svg?raw';
import weatherAlarm from '@meteocons/svg/fill/weather-alarm.svg?raw';
import humidity from '@meteocons/svg/fill/humidity.svg?raw';
import thermometer from '@meteocons/svg/fill/thermometer.svg?raw';
import tornado from '@meteocons/svg/fill/tornado.svg?raw';
import raindrop from '@meteocons/svg/fill/raindrop.svg?raw';
import snowflake from '@meteocons/svg/fill/snowflake.svg?raw';

export const METEOCONS = {
  'clear-day': clearDay,
  'clear-night': clearNight,
  'cloudy': cloudy,
  'partly-cloudy-day': partlyCloudyDay,
  'thunderstorms': thunderstorms,
  'compass': compass,
  'barometer': barometer,
  'star': star,
  'time-morning': timeMorning,
  'time-night': timeNight,
  'rainbow-clear': rainbowClear,
  'horizon': horizon,
  'wind': wind,
  'code-purple': codePurple,
  'code-green': codeGreen,
  'umbrella': umbrella,
  'weather-alarm': weatherAlarm,
  'humidity': humidity,
  'thermometer': thermometer,
  'tornado': tornado,
  'raindrop': raindrop,
  'snowflake': snowflake,
} as const;

export type MeteoconName = keyof typeof METEOCONS;

export interface MeteoconProps extends React.HTMLAttributes<HTMLSpanElement> {
  name: MeteoconName;
  size?: number | string;
  className?: string;
}

/**
 * Reads the current theme mode from the <html> data-theme-mode attribute set
 * by applyTheme(). Falls back to 'dark' (the app default) in non-DOM
 * environments (e.g. tests).
 */
function getThemeMode(): 'dark' | 'light' {
  if (typeof document === 'undefined') return 'dark';
  const mode = document.documentElement.dataset.themeMode;
  return mode === 'light' ? 'light' : 'dark';
}

/** Presentation properties that may be applied to SVG elements. */
type SvgPresentationProperty = 'fill' | 'stroke' | 'stroke-width' | 'opacity';

/** Per-icon, per-element theme overrides expressed as presentation attributes. */
type SvgPresentationOverrides = Readonly<
  Record<string, Readonly<Partial<Record<SvgPresentationProperty, string>>>>
>;

/**
 * Allowed values for presentation attributes applied by this transformer.
 * Hex colors, the keyword `none`, `currentColor`, and numeric values are
 * permitted. Complex CSS values such as `url(...)`, gradients, or arbitrary
 * strings are rejected.
 */
const SAFE_SVG_VALUE = /^(?:#[0-9a-fA-F]{3,8}|none|currentColor|\d+(?:\.\d+)?)$/;

/**
 * Presentation attributes that may be converted from inline `style=""`
 * attributes to element attributes. Only a tiny, structural set is honoured
 * so that bundled SVG source can remain CSP-safe while preserving rendering.
 */
const SAFE_SOURCE_STYLE_PROPERTIES = new Set(['mask-type']);

/**
 * Allowed values for source style properties that are converted to attributes.
 */
const SAFE_SOURCE_STYLE_VALUES: Record<string, RegExp> = {
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
const LIGHT_MODE_OVERRIDES: Partial<Record<MeteoconName, SvgPresentationOverrides>> = {
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
 * Applies an allowlisted set of presentation-attribute overrides to a raw SVG
 * string. The transformer also strips any source `<style>` elements, inline
 * `style=""` attributes, event handlers, and non-local references so that the
 * serialized result is safe for a strict `style-src 'self'` CSP.
 *
 * @param rawSvg The raw SVG markup.
 * @param overrides Per-selector presentation attributes to apply.
 * @returns The sanitized, attribute-only SVG markup.
 */
export function applySvgPresentationOverrides(
  rawSvg: string,
  overrides: SvgPresentationOverrides,
): string {
  const doc = new DOMParser().parseFromString(rawSvg, 'image/svg+xml');
  const root = doc.documentElement;
  if (root.nodeName.toLowerCase() !== 'svg' || root.querySelector('parsererror')) {
    return rawSvg;
  }

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

  return new XMLSerializer().serializeToString(root);
}

/**
 * Adapts a bundled Meteocon SVG for the current theme without emitting inline
 * `<style>` blocks or `style=""` attributes.
 *
 * @param rawSvg The bundled raw SVG string.
 * @param name The Meteocon icon name.
 * @param mode The active theme mode.
 * @returns CSP-safe SVG markup using presentation attributes only.
 */
export function adaptSvgForTheme(
  rawSvg: string,
  name: MeteoconName,
  mode: 'dark' | 'light',
): string {
  const overrides = mode === 'light' ? LIGHT_MODE_OVERRIDES[name] : undefined;
  return applySvgPresentationOverrides(rawSvg, overrides ?? {});
}

export function Meteocon({ name, size = 22, className = '', ...props }: MeteoconProps) {
  const [themeMode, setThemeMode] = useState<'dark' | 'light'>(getThemeMode);
  const spanRef = useRef<HTMLSpanElement>(null);

  // Track the current numeric/string dimension (size × 1.2 multiplier).
  const numericSize = typeof size === 'number' ? Math.round(size * 1.2) : size;
  const dim = typeof numericSize === 'number' ? `${numericSize}px` : numericSize;

  // Apply size imperatively to satisfy the VERIFY-007 no-inline-style invariant.
  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    el.style.setProperty('width', dim);
    el.style.setProperty('height', dim);
  }, [dim]);

  // Listen for theme changes dispatched by applyTheme() and synchronise.
  useEffect(() => {
    const handler = () => setThemeMode(getThemeMode());
    // Sync immediately in case the theme changed between mount and this effect.
    handler();
    window.addEventListener('applyTheme:complete', handler);
    return () => window.removeEventListener('applyTheme:complete', handler);
  }, []);

  const rawSvg = METEOCONS[name] || METEOCONS['cloudy'];
  const adaptedSvg = adaptSvgForTheme(rawSvg, name, themeMode);

  return (
    <span
      ref={spanRef}
      className={`inline-flex shrink-0 items-center justify-center pointer-events-none [&>svg]:w-full [&>svg]:h-full ${className}`}
      dangerouslySetInnerHTML={{ __html: adaptedSvg }}
      {...props}
    />
  );
}
