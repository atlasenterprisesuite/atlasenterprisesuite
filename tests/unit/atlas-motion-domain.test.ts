import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec } from '../../packages/creator/defaults';
import { createEmptyMotionComposition } from '../../packages/creator/motion/defaults';
import { validateMotionComposition } from '../../packages/creator/motion/validator';
import { evaluateTrack } from '../../packages/creator/motion/evaluator';
import { parseMotionExpression, evaluateMotionExpression } from '../../packages/creator/motion/expression';
import { validateProductionSpec } from '../../packages/creator/validator';

describe('ATLAS Motion Designer domain', () => {
  it('creates a deterministic editable composition default', () => {
    const spec = createEmptyMotionComposition({ id: 'motion-1', durationSeconds: 10 });
    expect(spec).toMatchObject({ id: 'motion-1', version: 1, width: 1920, height: 1080, fps: 30, durationSeconds: 10, layers: [] });
    expect(JSON.stringify(spec)).toBe(JSON.stringify(createEmptyMotionComposition({ id: 'motion-1', durationSeconds: 10 })));
  });

  it('blocks parent cycles and out-of-range keyframes', () => {
    const spec = createEmptyMotionComposition({ id: 'motion-1', durationSeconds: 5 });
    spec.layers = [
      { id: 'a', name: 'A', kind: 'shape', sceneId: null, parentLayerId: 'b', startSecond: 0, endSecond: 5, visible: true, locked: false, transform: {}, tracks: [], effects: [], expression: null },
      { id: 'b', name: 'B', kind: 'shape', sceneId: null, parentLayerId: 'a', startSecond: 0, endSecond: 5, visible: true, locked: false, transform: {}, tracks: [{ id: 't', property: 'opacity', keyframes: [{ id: 'k', time: 6, value: 1, easing: { type: 'linear' } }] }], effects: [], expression: null }
    ];
    const codes = validateMotionComposition(spec).map(issue => issue.code);
    expect(codes).toContain('motion.parent_cycle');
    expect(codes).toContain('motion.keyframe_out_of_range');
  });

  it('interpolates numeric tracks deterministically', () => {
    const track = { id: 'opacity', property: 'opacity', keyframes: [
      { id: 'k0', time: 0, value: 0, easing: { type: 'linear' as const } },
      { id: 'k1', time: 2, value: 1, easing: { type: 'linear' as const } }
    ] };
    expect(evaluateTrack(track, 1)).toBe(0.5);
    expect(evaluateTrack(track, 1)).toBe(0.5);
  });

  it('evaluates only the constrained expression DSL', () => {
    const ast = parseMotionExpression('clamp(sin(time) + 1, 0, 1)');
    expect(evaluateMotionExpression(ast, { time: 0, properties: {} })).toBe(1);
    expect(() => parseMotionExpression('Function("return 1")()')).toThrow();
    expect(() => parseMotionExpression('globalThis.process')).toThrow();
  });

  it('promotes blocking motion validation into the production review gate', () => {
    const production = createEmptyProductionSpec({ id: 'production-1', now: '2026-09-15T00:00:00.000Z' });
    production.brief = 'Motion production';
    production.durationSeconds = 5;
    const motion = createEmptyMotionComposition({ id: 'motion-1', durationSeconds: 5 });
    motion.layers = [{
      id: 'layer-1', name: 'Invalid', kind: 'shape', sceneId: null, parentLayerId: null,
      startSecond: 0, endSecond: 6, visible: true, locked: false, transform: {}, tracks: [], effects: [], expression: null
    }];
    production.motionComposition = motion;
    const result = validateProductionSpec(production);
    expect(result.status).toBe('blocking');
    expect(result.issues.map(issue => issue.code)).toContain('motion.layer_out_of_range');
  });
});
