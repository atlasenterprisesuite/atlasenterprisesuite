import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-gps/index.ts', 'utf8');
const api = readFileSync('apps/web/src/modules/gps/gpsApi.ts', 'utf8');

describe('ATLAS GPS bounded street coverage source', () => {
  it('keeps road geometry lookup bounded and provider-truthful', () => {
    expect(edge).toContain("operation === 'street.coverage.lookup'");
    expect(edge).toContain('street_bounds_too_large');
    expect(edge).toContain('(north - south) > 0.05');
    expect(edge).toContain('(east - west) > 0.05');
    expect(edge).toContain("provider: 'openstreetmap-overpass'");
    expect(edge).toContain('verified_sla: false');
  });

  it('requests only highway ways and returns real provider geometry', () => {
    expect(edge).toContain('way["highway"]');
    expect(edge).toContain('out tags geom;');
    expect(edge).toContain('segment_count: segments.length');
    expect(edge).toContain('coordinates: geometry');
  });

  it('exposes the bounded lookup through the authenticated GPS API', () => {
    expect(api).toContain('lookupGpsStreetCoverage');
    expect(api).toContain(">('street.coverage.lookup', bounds)");
    expect(api).toContain('GpsStreetCoverageSegment');
  });
});
