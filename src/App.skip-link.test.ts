import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// VERIFY-066 regression guard: App.tsx provides a keyboard-accessible skip link.
describe('App.tsx skip link', () => {
  const source = readFileSync(resolve(__dirname, './App.tsx'), 'utf8')
  const englishCommon = JSON.parse(
    readFileSync(resolve(__dirname, './i18n/resources/en-US/common.json'), 'utf8'),
  ) as { surface: { app: { text: { skipToMainContent: string } } } }

  it('renders a visually hidden skip-to-content link', () => {
    expect(source).toMatch(/i18nKey="common:surface\.app\.text\.skipToMainContent"/)
    expect(englishCommon.surface.app.text.skipToMainContent).toBe('Skip to main content')
    expect(source).toMatch(/href="#main-content"/)
    expect(source).toMatch(/sr-only/)
    expect(source).toMatch(/focus:not-sr-only/)
  })

  it('marks the main content region as the skip target', () => {
    expect(source).toMatch(/id="main-content"/)
    expect(source).toMatch(/<main[^>]*id="main-content"/)
  })
})
