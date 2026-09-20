import { describe, expect, it } from 'vitest';
import { ATLAS_MODULES } from '../../apps/web/src/modules/registry';
import { ATLAS_GESTATION_PHASES, summarizeGestation } from '../../apps/web/src/modules/release/gestation';

describe('ATLAS Gestation A-Z', () => {
  it('keeps conception-to-birth gates sequential and fail-closed', () => {
    expect(ATLAS_GESTATION_PHASES).toHaveLength(12);
    expect(ATLAS_GESTATION_PHASES.map((phase) => phase.order)).toEqual(
      Array.from({ length: 12 }, (_, index) => index + 1)
    );
    expect(ATLAS_GESTATION_PHASES[0].id).toBe('conception');
    expect(ATLAS_GESTATION_PHASES.at(-1)?.id).toBe('birth');

    const firstIncomplete = ATLAS_GESTATION_PHASES.findIndex((phase) => phase.status !== 'complete');
    expect(firstIncomplete).toBeGreaterThan(0);
    expect(
      ATLAS_GESTATION_PHASES
        .slice(firstIncomplete)
        .some((phase) => phase.id === 'birth' && phase.status === 'blocked')
    ).toBe(true);
  });

  it('derives module evidence from the canonical registry instead of invented percentages', () => {
    const summary = summarizeGestation(ATLAS_MODULES);
    const counted =
      summary.moduleCounts.implemented +
      summary.moduleCounts.partial +
      summary.moduleCounts['external-gated'];

    expect(counted).toBe(ATLAS_MODULES.length);
    expect(summary.totalModules).toBe(ATLAS_MODULES.length);
    expect(summary.birthReady).toBe(false);
    expect(summary.currentPhase.id).toBe('genome');
  });
});
