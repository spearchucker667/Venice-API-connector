import { describe, it, expect } from 'vitest'
import { renderToString } from 'react-dom/server'
import {
  highlightCode,
  renderHastNode,
  normalizeLanguage,
  MAX_HIGHLIGHT_LENGTH,
  MAX_HIGHLIGHT_LINES,
} from './codeHighlighting'

describe('codeHighlighting', () => {
  describe('normalizeLanguage', () => {
    it('resolves common aliases', () => {
      expect(normalizeLanguage('js')).toBe('javascript')
      expect(normalizeLanguage('ts')).toBe('typescript')
      expect(normalizeLanguage('py')).toBe('python')
      expect(normalizeLanguage('sh')).toBe('bash')
      expect(normalizeLanguage('shell')).toBe('bash')
      expect(normalizeLanguage('yml')).toBe('yaml')
      expect(normalizeLanguage('html')).toBe('markup')
      expect(normalizeLanguage('xml')).toBe('markup')
    })

    it('returns null for unknown languages', () => {
      expect(normalizeLanguage('some-made-up-lang')).toBeNull()
      expect(normalizeLanguage('')).toBeNull()
      expect(normalizeLanguage(null)).toBeNull()
      expect(normalizeLanguage(undefined)).toBeNull()
    })

    it('is case-insensitive', () => {
      expect(normalizeLanguage('JS')).toBe('javascript')
      expect(normalizeLanguage('Python')).toBe('python')
    })
  })

  describe('highlightCode', () => {
    it('produces token spans for JavaScript', () => {
      const result = highlightCode('const x = 1;', 'javascript')
      const html = renderToString(result as React.ReactElement)
      expect(html).toContain('token')
      expect(html).toContain('const')
      expect(html).not.toContain('dangerouslySetInnerHTML')
    })

    it('produces token spans for TypeScript', () => {
      const result = highlightCode('type Foo = string;', 'typescript')
      const html = renderToString(result as React.ReactElement)
      expect(html).toContain('token')
      expect(html).toContain('type')
    })

    it('produces token spans for Python', () => {
      const result = highlightCode('def hello():\n    return "world"', 'python')
      const html = renderToString(result as React.ReactElement)
      expect(html).toContain('token')
      expect(html).toContain('def')
    })

    it('falls back to plain text for unknown languages', () => {
      const source = 'some unknown code'
      const result = highlightCode(source, 'unknown-lang')
      expect(result).toBe(source)
    })

    it('falls back to plain text for missing languages', () => {
      const source = 'plain code block'
      const result = highlightCode(source, null)
      expect(result).toBe(source)
    })

    it('preserves raw source text exactly', () => {
      const source = 'const x = "preserve me";'
      const result = highlightCode(source, 'javascript')
      const html = renderToString(result as React.ReactElement)
      // The source characters must still appear in order, even when wrapped
      // in token spans. HTML-escaped quotes are expected from React rendering.
      let textOnly = html
      let previous
      do {
        previous = textOnly
        textOnly = textOnly.replace(/<[^>]+>/g, '')
      } while (textOnly !== previous)
      textOnly = textOnly.replace(/&quot;/g, '"')
      expect(textOnly).toBe(source)
    })

    it('renders HTML-like source safely without executable markup', () => {
      const source = '<script>alert("xss")</script>'
      const result = highlightCode(source, 'javascript')
      const html = renderToString(result as React.ReactElement)
      expect(html).not.toContain('<script>')
      expect(html).not.toContain('</script>')
      expect(html).toContain('alert')
    })

    it('bypasses highlighting when source exceeds max length', () => {
      const source = 'x'.repeat(MAX_HIGHLIGHT_LENGTH + 1)
      const result = highlightCode(source, 'javascript')
      expect(result).toBe(source)
    })

    it('bypasses highlighting when line count exceeds max lines', () => {
      const source = 'x\n'.repeat(MAX_HIGHLIGHT_LINES)
      const result = highlightCode(source, 'javascript')
      expect(result).toBe(source)
    })

    it('tokenized output contains semantic classes but no inline style colors', () => {
      const result = highlightCode('function foo() {}', 'javascript')
      const html = renderToString(result as React.ReactElement)
      expect(html).toContain('token')
      expect(html).toContain('function')
      expect(html).not.toMatch(/style="[^"]*color/)
      expect(html).not.toMatch(/style='[^']*color/)
    })

    it('supports JSX and TSX grammars', () => {
      const jsx = highlightCode('const el = <div />;', 'jsx')
      const tsx = highlightCode('const el = <div />;', 'tsx')
      expect(renderToString(jsx as React.ReactElement)).toContain('token')
      expect(renderToString(tsx as React.ReactElement)).toContain('token')
    })

    it('rejects unexpected HAST element tags', () => {
      expect(() =>
        renderToString(
          renderHastNode(
            { type: 'element', tagName: 'script', properties: {}, children: [] } as any,
            'test',
          ) as React.ReactElement,
        ),
      ).toThrow('Unexpected HAST element tag: script')
    })

    it('rejects unknown HAST node types', () => {
      expect(() =>
        renderHastNode({ type: 'comment', value: 'x' } as any, 'test'),
      ).toThrow('Unexpected HAST node type: comment')
    })
  })
})
