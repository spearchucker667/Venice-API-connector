import '@testing-library/jest-dom/vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { i18n } from '../../i18n'
import { getPromptStartersForCategory } from '../../services/promptStarterService'
import type { PromptStarterCategory } from '../../data/promptStarters'
import { ExamplePrompts } from './shared'

const CATEGORIES: PromptStarterCategory[] = ['writing', 'image', 'audio', 'music', 'embeddings']

describe('ExamplePrompts runtime localization', () => {
  afterEach(async () => {
    await act(async () => { await i18n.changeLanguage('en-US') })
  })

  it.each(CATEGORIES)('resolves stable %s starter IDs in English and Swedish', async (category) => {
    const [starter] = getPromptStartersForCategory(category, 1)
    expect(starter).toBeDefined()
    await act(async () => { await i18n.changeLanguage('en-US') })
    const english = i18n.t(`common:${starter.translationKey}`, { defaultValue: starter.fallbackPrompt })
    await act(async () => { await i18n.changeLanguage('sv-SE') })
    const swedish = i18n.t(`common:${starter.translationKey}`, { defaultValue: starter.fallbackPrompt })

    expect(english).toBe(starter.fallbackPrompt)
    expect(swedish).not.toBe(english)
    expect(starter.id).not.toContain(swedish)
  })

  it('updates rendered suggestions without remounting and selects the localized value', async () => {
    const [starter] = getPromptStartersForCategory('writing', 1)
    const onPick = vi.fn()
    await act(async () => { await i18n.changeLanguage('en-US') })
    render(<ExamplePrompts items={[starter]} onPick={onPick} />)

    expect(screen.getByText(starter.fallbackPrompt)).toBeInTheDocument()
    await act(async () => { await i18n.changeLanguage('sv-SE') })
    const swedish = i18n.t(`common:${starter.translationKey}`, { defaultValue: starter.fallbackPrompt })
    const localizedButton = screen.getByText(swedish).closest('button')
    expect(localizedButton).toBeInTheDocument()

    await userEvent.click(localizedButton!)
    expect(onPick).toHaveBeenCalledWith(swedish)
  })
})
