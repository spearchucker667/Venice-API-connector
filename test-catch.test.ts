import { test, expect } from 'vitest';
import { stripImageMetadata } from './src/utils/imageProcessor';

test('catches error', () => {
  const data = new Uint8Array([0xFF, 0xD8, 0xFF, 0x00]);
  data.subarray = () => {
    throw new Error('Simulated failure');
  };

  const { data: result, report } = stripImageMetadata(data);
  expect(report.warnings).toContain('Image metadata scrubbing failed');
});
