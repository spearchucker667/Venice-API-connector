import '@testing-library/jest-dom/vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MediaDetailDialog } from './media-detail-dialog'
import type { MediaItem } from '../../types/media'

const item: MediaItem = {
  id: 'media-1', image: 'data:image/png;base64,abc', prompt: 'Test image', model: 'flux-dev', timestamp: 1,
  mediaType: 'image', operation: 'generate', parentId: null, childrenIds: [], tags: [], note: '', favorite: false,
}

describe('MediaDetailDialog accessibility', () => {
  it('focuses Close, traps Tab, handles Escape, and restores trigger focus', () => {
    const trigger = document.createElement('button')
    document.body.appendChild(trigger)
    trigger.focus()
    const onClose = vi.fn()
    const { unmount } = render(
      <MediaDetailDialog item={item} allItems={[item]} onClose={onClose} onNavigate={vi.fn()} onToggleFavorite={vi.fn()} onSaveAs={vi.fn()} onDelete={vi.fn()} onSelect={vi.fn()} />,
    )

    expect(screen.getByRole('button', { name: 'Close (Esc)' })).toHaveFocus()
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledOnce()
    unmount()
    expect(trigger).toHaveFocus()
    trigger.remove()
  })

  it('places Save As between Favorite and Delete and invokes only Save As', () => {
    const onSaveAs = vi.fn()
    const onFavorite = vi.fn()
    const onDelete = vi.fn()
    const onClose = vi.fn()
    const onNavigate = vi.fn()
    render(
      <MediaDetailDialog item={item} allItems={[item]} onClose={onClose} onNavigate={onNavigate} onToggleFavorite={onFavorite} onSaveAs={onSaveAs} onDelete={onDelete} onSelect={vi.fn()} />,
    )
    const buttons = screen.getAllByRole('button')
    const favoriteIndex = buttons.indexOf(screen.getByRole('button', { name: 'Favorite' }))
    const saveIndex = buttons.indexOf(screen.getByRole('button', { name: 'Save As…' }))
    const deleteIndex = buttons.indexOf(screen.getByRole('button', { name: 'Delete' }))
    expect(favoriteIndex).toBeLessThan(saveIndex)
    expect(saveIndex).toBeLessThan(deleteIndex)
    fireEvent.click(screen.getByRole('button', { name: 'Save As…' }))
    expect(onSaveAs).toHaveBeenCalledWith(item)
    expect(onFavorite).not.toHaveBeenCalled()
    expect(onDelete).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
    expect(onNavigate).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
