import { afterEach, expect, test, vi } from 'vitest';
import { readSpatialPreferences, supportsWebGL } from './useSpatialPreferences';

afterEach(() => {
  vi.restoreAllMocks();
});

test('reports reduced motion from matchMedia', () => {
  vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  expect(readSpatialPreferences(() => false)).toEqual({ reducedMotion: true, webglSupported: false });
});

test('WebGL detection fails closed when a context cannot be created', () => {
  const getContext = vi.fn().mockReturnValue(null);
  vi.spyOn(document, 'createElement').mockReturnValue({ getContext } as unknown as HTMLCanvasElement);
  expect(supportsWebGL()).toBe(false);
});
