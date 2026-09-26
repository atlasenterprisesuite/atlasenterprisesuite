import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-gps/index.ts', 'utf8');
const api = readFileSync('apps/web/src/modules/gps/gpsApi.ts', 'utf8');

describe('ATLAS GPS OSM indoor provider contract', () => {
  it('keeps Overpass as an external-gated cached provider', () => {
    expect(edge).toContain('ATLAS_GPS_OVERPASS_BASE_URL');
    expect(edge).toContain("'overpass'");
    expect(edge).toContain('atlas_gps_acquire_provider_slot');
    expect(edge).toContain('overpass_rate_limited');
  });

  it('exposes a bounded indoor lookup operation through the authenticated GPS edge', () => {
    expect(edge).toContain("operation === 'indoor.lookup'");
    expect(edge).toContain('indoor_osm');
    expect(api).toContain("request<");
    expect(api).toContain(">('indoor.lookup'");
    expect(api).toContain('lookupGpsIndoor');
  });

  it('does not claim public Overpass as an SLA-backed production source', () => {
    expect(edge).toContain("verified_sla: false");
    expect(edge).toContain("public Overpass");
  });
});
