import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec, createEmptyScene, createEmptyShot } from '../../packages/creator/defaults';
import { compileNeutralProduction, compileProviderRequest } from '../../packages/creator/compiler';

function production() {
  const spec = createEmptyProductionSpec();
  spec.title = 'ATLAS Launch';
  spec.brief = 'Cinematic ATLAS launch.';
  spec.durationSeconds = 8;
  spec.negativeConstraints.push({ id: 'neg-1', scope: 'production', value: 'No text in frame', severity: 'warning' });
  const scene = createEmptyScene({ id: 'scene-1' });
  scene.title = 'Reveal';
  scene.startSecond = 0;
  scene.endSecond = 8;
  const shot = createEmptyShot({ id: 'shot-1', order: 1 });
  shot.title = 'Macro reveal';
  shot.startSecond = 0;
  shot.endSecond = 8;
  shot.action = 'Metal surfaces assemble into the ATLAS emblem.';
  scene.shots = [shot];
  spec.scenes = [scene];
  return spec;
}

describe('ATLAS Director compiler', () => {
  it('produces deterministic neutral output', () => {
    const spec = production();
    expect(compileNeutralProduction(spec)).toBe(compileNeutralProduction(spec));
  });

  it('preserves ordered production sections and negative constraints', () => {
    const prompt = compileNeutralProduction(production());
    expect(prompt.indexOf('OBJECTIVE')).toBeLessThan(prompt.indexOf('SCENE PLAN'));
    expect(prompt).toContain('No text in frame');
  });

  it('never claims provider readiness without a verified capability', () => {
    const compiled = compileProviderRequest(production(), 'seedance');
    expect(compiled.providerId).toBe('seedance');
    expect(compiled.readinessClaim).toBe(false);
  });
});
