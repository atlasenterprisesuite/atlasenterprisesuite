import { describe, expect, it } from 'vitest';
import { createEmptyProductionSpec } from '../../packages/creator/defaults';
import { planDirectorCommand } from '../../packages/creator/local_commands';
import { createDirectorState, directorReducer } from '../../apps/web/src/modules/creator/director/directorState';

describe('local Director commands', () => {
  it('previews Spanish edits without mutating identity, assets or version', () => {
    const spec = createEmptyProductionSpec();
    const before = structuredClone(spec);
    const plan = planDirectorCommand(spec, 'Título: Mi anuncio');
    expect(spec).toEqual(before);
    expect(plan.actions).toEqual([{ type: 'root.patch', patch: { title: 'Mi anuncio' } }]);
    const next = plan.actions.reduce(directorReducer, createDirectorState(spec));
    expect(next.dirty).toBe(true);
    expect(next.spec.id).toBe(spec.id);
    expect(next.spec.version).toBe(spec.version);
  });
  it('supports English and Spanish formats and narration', () => {
    const spec = createEmptyProductionSpec();
    expect(planDirectorCommand(spec, 'Formato: vertical').actions[0]).toEqual({ type: 'root.patch', patch: { aspectRatio: '9:16' } });
    expect(planDirectorCommand(spec, 'Format: 16:9').actions[0]).toEqual({ type: 'root.patch', patch: { aspectRatio: '16:9' } });
    const plan = planDirectorCommand(spec, 'Narración: Hola ATLAS');
    const next = plan.actions.reduce(directorReducer, createDirectorState(spec));
    expect(next.spec.audioPlan.dialogue).toEqual(['Hola ATLAS']);
    expect(next.spec.audioEnabled).toBe(true);
  });
  it('appends a timed scene within the existing duration', () => {
    const spec = { ...createEmptyProductionSpec(), durationSeconds: 30 };
    const plan = planDirectorCommand(spec, 'Escena: Introducción | 10');
    const next = plan.actions.reduce(directorReducer, createDirectorState(spec));
    expect(next.spec.scenes[0]).toMatchObject({ title: 'Introducción', startSecond: 0, endSecond: 10 });
    expect(next.spec.scenes[0].shots[0]).toMatchObject({ order: 1, action: 'Introducción', endSecond: 10 });
    expect(planDirectorCommand(next.spec, 'Scene: Closing | 25').actions).toEqual([]);
  });
  it('rejects ambiguous, empty, invalid and unsupported commands', () => {
    const spec = createEmptyProductionSpec();
    for (const command of ['Make a movie', 'Título:', 'Formato: invalid', 'Escena: Intro | -1', 'Scene: Intro | 10', 'Publish', 'Title: ' + 'a'.repeat(4001)]) {
      expect(planDirectorCommand(spec, command).actions).toEqual([]);
    }
  });
  it('clears an external selection only on an explicit local-mode command', () => {
    const spec = { ...createEmptyProductionSpec(), providerPreference: 'veo' as const };
    expect(planDirectorCommand(spec, 'Modo: local').actions).toEqual([{ type: 'provider.select', providerId: null }]);
    expect(planDirectorCommand(spec, 'Brief: demo').actions.some(action => action.type === 'provider.select')).toBe(false);
  });
});
