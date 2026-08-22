// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest'
import { render } from '@testing-library/react'
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import * as React from 'react'
import { PreviewNode } from './preview-node'
import type { VeniceNodeData } from '../../stores/workflow-store'

const originalCreateObjectURL = globalThis.URL.createObjectURL
const originalRevokeObjectURL = globalThis.URL.revokeObjectURL

vi.mock('../../stores/playground-store', () => ({
  usePlaygroundStore: vi.fn((selector: (s: { runResults: Record<string, unknown> }) => unknown) =>
    selector({ runResults: mockRunResults }),
  ),
}))

let mockRunResults: Record<string, unknown> = {}

vi.mock('@xyflow/react', () => ({
  Handle: ({ type, position }: { type: string; position: string }) =>
    React.createElement('div', { 'data-testid': `handle-${type}-${position}` }),
  Position: { Top: 'top', Bottom: 'bottom' },
}))

vi.mock('react-i18next', () => ({
  Trans: ({ i18nKey }: { i18nKey: string }) => React.createElement('span', { 'data-testid': 'trans' }, i18nKey),
}))

function makeProps(): {
  id: string
  data: VeniceNodeData
  selected?: boolean
} {
  return {
    id: 'node-1',
    data: {
      nodeType: 'tts',
      prompt: 'hello',
      model: 'default-tts',
      voice: 'af_sky',
    } as VeniceNodeData,
    selected: false,
  }
}

describe('PreviewNode', () => {
  beforeEach(() => {
    mockRunResults = {}
    globalThis.URL.revokeObjectURL = vi.fn()
  })

  afterEach(() => {
    globalThis.URL.createObjectURL = originalCreateObjectURL
    globalThis.URL.revokeObjectURL = originalRevokeObjectURL
    mockRunResults = {}
  })

  it('revokes a blob: URL when the output changes', () => {
    mockRunResults = {
      'node-1': { status: 'done', output: '[audio:blob:first]' },
    }

    const { rerender, unmount } = render(React.createElement(PreviewNode, makeProps() as any))

    mockRunResults = {
      'node-1': { status: 'done', output: '[audio:blob:second]' },
    }
    rerender(React.createElement(PreviewNode, makeProps() as any))

    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:first')
    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalledWith('blob:second')

    unmount()
    expect(globalThis.URL.revokeObjectURL).toHaveBeenCalledWith('blob:second')
  })

  it('does not revoke non-blob sources', () => {
    mockRunResults = {
      'node-1': { status: 'done', output: '[audio:https://example.com/audio.mp3]' },
    }

    const { unmount } = render(React.createElement(PreviewNode, makeProps() as any))
    unmount()

    expect(globalThis.URL.revokeObjectURL).not.toHaveBeenCalled()
  })
})
