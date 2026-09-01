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

import {
  LIGHT_MODE_OVERRIDES,
  type SvgPresentationOverrides,
  sanitizeSvgDocument,
} from './meteoconSvgTransformer';

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
  sanitizeSvgDocument(doc, overrides);
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
