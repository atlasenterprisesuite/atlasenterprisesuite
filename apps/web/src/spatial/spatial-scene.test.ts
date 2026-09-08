import { expect, test } from 'vitest';
import { particleCountForViewport } from './StarField';

test('particle count respects desktop and mobile v1 caps', () => {
  expect(particleCountForViewport(1440)).toBeLessThanOrEqual(1200);
  expect(particleCountForViewport(390)).toBeLessThanOrEqual(450);
  expect(particleCountForViewport(390)).toBeGreaterThan(0);
});
