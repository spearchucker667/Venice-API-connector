import * as React from 'react';
import { refractor } from 'refractor/core';
import type { Root, Element, Text } from 'hast';

// Register bundled grammars explicitly so the client bundle contains only the
// languages we support. Avoid `refractor/all` to keep bundle size bounded.
import refractorBash from 'refractor/lang/bash';
import refractorC from 'refractor/lang/c';
import refractorCpp from 'refractor/lang/cpp';
import refractorCsharp from 'refractor/lang/csharp';
import refractorCss from 'refractor/lang/css';
import refractorDiff from 'refractor/lang/diff';
import refractorGo from 'refractor/lang/go';
import refractorJava from 'refractor/lang/java';
import refractorJavascript from 'refractor/lang/javascript';
import refractorJson from 'refractor/lang/json';
import refractorKotlin from 'refractor/lang/kotlin';
import refractorLua from 'refractor/lang/lua';
import refractorMarkdown from 'refractor/lang/markdown';
import refractorMarkup from 'refractor/lang/markup';
import refractorPhp from 'refractor/lang/php';
import refractorPython from 'refractor/lang/python';
import refractorRegex from 'refractor/lang/regex';
import refractorRuby from 'refractor/lang/ruby';
import refractorRust from 'refractor/lang/rust';
import refractorScss from 'refractor/lang/scss';
import refractorSql from 'refractor/lang/sql';
import refractorSwift from 'refractor/lang/swift';
import refractorTypescript from 'refractor/lang/typescript';
import refractorYaml from 'refractor/lang/yaml';
import refractorJsx from 'refractor/lang/jsx';
import refractorTsx from 'refractor/lang/tsx';

[
  refractorBash,
  refractorC,
  refractorCpp,
  refractorCsharp,
  refractorCss,
  refractorDiff,
  refractorGo,
  refractorJava,
  refractorJavascript,
  refractorJson,
  refractorKotlin,
  refractorLua,
  refractorMarkdown,
  refractorMarkup,
  refractorPhp,
  refractorPython,
  refractorRegex,
  refractorRuby,
  refractorRust,
  refractorScss,
  refractorSql,
  refractorSwift,
  refractorTypescript,
  refractorYaml,
  refractorJsx,
  refractorTsx,
].forEach((grammar) => refractor.register(grammar));

// Aliases map common fence labels to registered language names.
const LANGUAGE_ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  js: 'javascript',
  ts: 'typescript',
  py: 'python',
  rb: 'ruby',
  cs: 'csharp',
  yml: 'yaml',
  html: 'markup',
  xml: 'markup',
};

export const MAX_HIGHLIGHT_LENGTH = 50_000;
export const MAX_HIGHLIGHT_LINES = 4_000;

/**
 * Normalize a fence language identifier to a Refractor-registered language name.
 */
export function normalizeLanguage(language: string | null | undefined): string | null {
  if (!language) return null;
  const normalized = language.trim().toLowerCase();
  const aliased = LANGUAGE_ALIASES[normalized] ?? normalized;
  return refractor.registered(aliased) ? aliased : null;
}

function countLines(source: string): number {
  let count = 0;
  for (let i = 0; i < source.length; i++) {
    if (source.charCodeAt(i) === 0x000a) count++;
  }
  return count + 1;
}

function isWithinHighlightLimits(source: string): boolean {
  return source.length <= MAX_HIGHLIGHT_LENGTH && countLines(source) <= MAX_HIGHLIGHT_LINES;
}

/**
 * Render a Refractor HAST node into a React element. Only `root`, `element`
 * (limited to `span` with className), and `text` nodes are accepted.
 *
 * Exported for unit-testing the safety boundary; production code should use
 * `highlightCode` which wraps this renderer in a plain-text fallback.
 */
export function renderHastNode(node: Root | Element | Text, keyPrefix: string): React.ReactNode {
  if (node.type === 'text') {
    return node.value;
  }

  if (node.type === 'element') {
    if (node.tagName !== 'span') {
      throw new Error(`Unexpected HAST element tag: ${node.tagName}`);
    }
    const className = Array.isArray(node.properties?.className)
      ? node.properties.className.filter((c): c is string => typeof c === 'string').join(' ')
      : '';
    return (
      <span key={keyPrefix} className={className || undefined}>
        {node.children.map((child, index) => renderHastNode(child as Element | Text, `${keyPrefix}-${index}`))}
      </span>
    );
  }

  if (node.type === 'root') {
    return (
      <>
        {node.children.map((child, index) => renderHastNode(child as Element | Text, `${keyPrefix}-${index}`))}
      </>
    );
  }

  throw new Error(`Unexpected HAST node type: ${(node as { type?: string }).type}`);
}

/**
 * Highlight a source string with Refractor when the language is registered and
 * the input is within size limits. Returns plain text fallback for unknown
 * languages, missing languages, or oversized input.
 */
export function highlightCode(source: string, language: string | null | undefined): React.ReactNode {
  const normalized = normalizeLanguage(language);
  if (!normalized || !isWithinHighlightLimits(source)) {
    return source;
  }

  try {
    const root = refractor.highlight(source, normalized) as Root;
    return renderHastNode(root, 'root');
  } catch {
    return source;
  }
}
