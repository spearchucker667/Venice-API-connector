import { describe, expect, it } from 'vitest';
import { VENICE_MEDIA_OPERATIONS, isVeniceMediaOperation } from './operations';

describe('VeniceMediaOperations', () => {
  it('should list all operations', () => {
    expect(VENICE_MEDIA_OPERATIONS).toContain('image.generate');
    expect(VENICE_MEDIA_OPERATIONS).toContain('video.queue');
  });

  it('should return true for valid operations', () => {
    expect(isVeniceMediaOperation('image.generate')).toBe(true);
    expect(isVeniceMediaOperation('video.queue')).toBe(true);
    expect(isVeniceMediaOperation('audio.tts')).toBe(true);
  });

  it('should return false for invalid operations', () => {
    expect(isVeniceMediaOperation('invalid.operation')).toBe(false);
    expect(isVeniceMediaOperation(null)).toBe(false);
    expect(isVeniceMediaOperation(123)).toBe(false);
    expect(isVeniceMediaOperation({})).toBe(false);
  });
});
