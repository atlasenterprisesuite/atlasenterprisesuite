import { describe, expect, it } from 'vitest';
import {
  buildStreetCoveragePlan,
  nextStreetCoverageProbe,
  resolveStreetCoverageProbe,
  streetDistanceM,
  summarizeStreetCoverage
} from '../../apps/web/src/modules/gps/streetCoverage';

describe('ATLAS GPS street-by-street coverage planner', () => {
  const streets = [
    {
      id: 'street-a',
      label: 'Street A',
      coordinates: [
        [-81.3789, 28.5384] as [number, number],
        [-81.3789, 28.5393] as [number, number]
      ]
    },
    {
      id: 'street-b',
      label: 'Street B',
      coordinates: [
        [-81.3789, 28.5393] as [number, number],
        [-81.3779, 28.5393] as [number, number]
      ]
    }
  ];

  it('samples every known street from start to end at bounded spacing', () => {
    const plan = buildStreetCoveragePlan(streets, 25);
    expect(plan.segmentCount).toBe(2);
    expect(plan.probes.length).toBeGreaterThan(6);
    expect(plan.probes[0].segmentId).toBe('street-a');
    expect(plan.probes.at(-1)?.segmentId).toBe('street-b');
    expect(streetDistanceM(streets[0].coordinates[0], streets[0].coordinates[1])).toBeGreaterThan(90);
  });

  it('continues after an unlocated coordinate instead of stopping the street sweep', () => {
    let plan = buildStreetCoveragePlan(streets, 25);
    const first = nextStreetCoverageProbe(plan);
    expect(first).not.toBeNull();

    plan = resolveStreetCoverageProbe(plan, first!.id, 'unlocated', {
      provider: 'atlas-open-road-graph',
      reason: 'no_verified_location_at_probe'
    });

    const next = nextStreetCoverageProbe(plan, first!.id);
    expect(next).not.toBeNull();
    expect(next!.id).not.toBe(first!.id);
    expect(plan.probes.find((probe) => probe.id === first!.id)?.status).toBe('unlocated');
  });

  it('only declares coverage complete after every generated coordinate is resolved', () => {
    let plan = buildStreetCoveragePlan(streets, 40);
    expect(summarizeStreetCoverage(plan).complete).toBe(false);

    for (const probe of plan.probes) {
      plan = resolveStreetCoverageProbe(
        plan,
        probe.id,
        probe.sequence % 3 === 0 ? 'unlocated' : 'located'
      );
    }

    const summary = summarizeStreetCoverage(plan);
    expect(summary.pending).toBe(0);
    expect(summary.complete).toBe(true);
    expect(summary.completionPct).toBe(100);
    expect(summary.unlocated).toBeGreaterThan(0);
  });

  it('caps generated probes so a world-scale request cannot exhaust the client', () => {
    const plan = buildStreetCoveragePlan(streets, 5, 7);
    expect(plan.probes).toHaveLength(7);
  });
});
