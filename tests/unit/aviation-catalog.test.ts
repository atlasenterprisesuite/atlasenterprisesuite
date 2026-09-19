import { describe, expect, it } from 'vitest';
import { AVIATION_CONCEPTS } from '../../apps/web/src/modules/aviation/aviation-concepts';
import { filterAviationConcepts } from '../../apps/web/src/modules/aviation/aviation-catalog';

describe('ATLAS Aviation concept catalog', () => {
  it('contains exactly ten internal concept aircraft with no invented engineering or market metrics', () => {
    expect(AVIATION_CONCEPTS).toHaveLength(10);
    expect(new Set(AVIATION_CONCEPTS.map((aircraft) => aircraft.id)).size).toBe(10);

    for (const aircraft of AVIATION_CONCEPTS) {
      expect(aircraft.designStatus).toBe('concept');
      expect(aircraft.metrics).toEqual({
        speedKph: null,
        rangeKm: null,
        payloadKg: null,
        priceUsd: null,
        valuationUsd: null
      });
      expect(aircraft.certification.status).toBe('unverified');
      expect(aircraft.certification.authority).toBeNull();
      expect(aircraft.investment.status).toBe('not_configured');
      expect(aircraft.investment.sharePriceUsd).toBeNull();
      expect(aircraft.investment.minimumInvestmentUsd).toBeNull();
      expect(aircraft.investment.officialSourceUrl).toBeNull();
    }
  });

  it('searches and filters concepts deterministically', () => {
    expect(filterAviationConcepts(AVIATION_CONCEPTS, { query: 'rescue' }).map((item) => item.id))
      .toEqual(['atlas-a5-rescue']);

    expect(filterAviationConcepts(AVIATION_CONCEPTS, { category: 'cargo' }).map((item) => item.id))
      .toEqual(['atlas-a4-cargo']);

    expect(filterAviationConcepts(AVIATION_CONCEPTS, { query: 'atlas', category: 'regional' }).map((item) => item.id))
      .toEqual(['atlas-a2-regional']);
  });
});
