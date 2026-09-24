import type { MotionCompositionSpec } from './types';

export function createEmptyMotionComposition(options: { id?: string; durationSeconds?: number } = {}): MotionCompositionSpec {
  return {
    id: options.id ?? crypto.randomUUID(),
    version: 1,
    width: 1920,
    height: 1080,
    fps: 30,
    durationSeconds: options.durationSeconds ?? 10,
    background: '#000000',
    scenes: [],
    layers: [],
    markers: [],
    renderSettings: { quality: 'preview', motionBlur: false }
  };
}
