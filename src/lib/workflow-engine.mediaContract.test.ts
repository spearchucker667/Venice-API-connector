import { describe, it, expect, vi, beforeEach } from 'vitest';
import { executeWorkflow } from './workflow-engine';
import { venice } from './venice-client';
import type { Node, Edge } from '@xyflow/react';
import type { VeniceNodeData } from '../stores/workflow-store';

vi.mock('./venice-client', () => ({
  venice: vi.fn(),
  veniceBlob: vi.fn(),
}));

describe('Workflow Engine Media Contract Parity', () => {
  beforeEach(() => {
    vi.mocked(venice).mockReset();
  });

  it('builds image generation request with aspect_ratio without leaking width/height', async () => {
    vi.mocked(venice).mockResolvedValueOnce({
      images: ['iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII='],
    } as never);

    const nodes: Node<VeniceNodeData>[] = [
      {
        id: 'img-1',
        type: 'veniceNode',
        position: { x: 0, y: 0 },
        data: {
          label: 'Image Generator',
          nodeType: 'imageGen',
          prompt: 'a scenic waterfall',
          aspectRatio: '16:9',
          model: 'nano-banana-pro',
        },
      },
    ];
    const edges: Edge[] = [];

    const onUpdate = vi.fn();
    await executeWorkflow(nodes, edges, { onUpdate });
    expect(onUpdate).toHaveBeenCalledWith('img-1', expect.objectContaining({ status: 'done' }));

    expect(venice).toHaveBeenCalledWith('/image/generate', expect.objectContaining({
      method: 'POST',
      body: expect.any(String),
    }));

    const calledBody = JSON.parse(vi.mocked(venice).mock.calls[0][1]?.body as string);
    expect(calledBody.model).toBe('nano-banana-pro');
    expect(calledBody.prompt).toBe('a scenic waterfall');
    expect(calledBody.aspect_ratio).toBe('16:9');
    expect(calledBody.width).toBeUndefined();
    expect(calledBody.height).toBeUndefined();
  });
});
