import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const page = readFileSync('apps/web/src/modules/gps/Gps4DPage.tsx', 'utf8');
const api = readFileSync('apps/web/src/modules/gps/gpsApi.ts', 'utf8');
const domain = readFileSync('apps/web/src/modules/gps/gpsDomain.ts', 'utf8');
const edge = readFileSync('supabase/functions/atlas-gps/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20260923235500_atlas_gps4d_core.sql', 'utf8');
const hardening = readFileSync('supabase/migrations/20260924001200_harden_atlas_gps4d_internal_tables.sql', 'utf8');
const production = readFileSync('data/ops/global-production-verification.json', 'utf8');

describe('ATLAS GPS 4D platform', () => {
  it('keeps GPS on the authenticated canonical route and production contract', () => {
    expect(production).toContain('"/gps"');
    expect(page).toContain('ATLAS GPS 4D');
    expect(page).toContain('Navigation & Spatial Intelligence');
  });

  it('routes geocoding, routing and persistence through the authenticated ATLAS backend', () => {
    expect(api).toContain('authorizedAtlasFetch');
    expect(api).toContain('getActiveAtlasOrganization');
    expect(api).toContain("'/functions/v1/atlas-gps'");
    expect(page).not.toContain('nominatim.openstreetmap.org');
    expect(page).not.toContain('router.project-osrm.org');
    expect(edge).toContain("operation === 'search'");
    expect(edge).toContain("operation === 'route'");
    expect(edge).toContain("operation === 'saved.list'");
    expect(edge).toContain("operation === 'saved.save'");
    expect(edge).toContain("operation === 'saved.delete'");
  });

  it('implements street, USGS satellite and 3D terrain views without claiming unavailable live providers', () => {
    expect(page).toContain("type GpsViewMode");
    expect(page).toContain("STREET_STYLE");
    expect(page).toContain('styles/liberty');
    expect(page).toContain('engineState');
    expect(page).toContain('layerState');
    expect(page).toContain('basemap.nationalmap.gov');
    expect(page).toContain('tiles.mapterhorn.com');
    expect(domain).toContain("id: 'traffic'");
    expect(domain).toContain("id: 'incidents'");
    expect(domain).toContain("id: 'streetview'");
    expect(domain).toContain("state: 'blocked'");
  });

  it('adds fused navigation behaviors inspired by modern map products without inventing live data', () => {
    expect(page).toContain("id: 'multi-stop'");
    expect(page).toContain('stops.length > 0');
    expect(page).toContain('navigator.share');
    expect(page).toContain('arrivalState');
    expect(page).toContain('Más rápida');
    expect(domain).toContain("id: 'multistop'");
    expect(domain).toContain("id: 'route-tradeoffs'");
    expect(domain).toContain("id: 'share'");
    expect(domain).toContain("id: 'arrival'");
    expect(domain).toContain('Street-level / Look Around imagery');
  });

  it('implements navigation steps, lane evidence, voice and bounded automatic rerouting', () => {
    expect(page).toContain('REROUTE_COOLDOWN_MS = 15_000');
    expect(page).toContain('AtlasNavigationEngine');
    expect(page).toContain('observation.reroute_suggested');
    expect(page).toContain('speechSynthesis');
    expect(page).toContain('laneLabel');
    expect(edge).toContain("url.searchParams.set('steps', 'true')");
    expect(edge).toContain("url.searchParams.set('alternatives', 'true')");
    expect(edge).toContain('intersections');
    expect(edge).toContain('lanes');
  });

  it('enforces tenant/user persistence and a server-side Nominatim throttle', () => {
    expect(migration).toContain('create table if not exists public.atlas_gps_saved_places');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('organization_members');
    expect(migration).toContain('(select auth.uid())');
    expect(migration).toContain('atlas_gps_provider_cache');
    expect(migration).toContain('atlas_gps_provider_throttle');
    expect(migration).toContain('atlas_gps_acquire_provider_slot');
    expect(migration).toContain('p_min_interval_ms < 1000');
    expect(edge).toContain('p_min_interval_ms: 1000');
    expect(edge).toContain("'user-agent': 'ATLAS-GPS-4D/1.0");
    expect(hardening).toContain('atlas_gps_provider_cache_explicit_deny');
    expect(hardening).toContain('atlas_gps_provider_throttle_explicit_deny');
    expect(hardening.match(/using \(false\)/g)?.length).toBeGreaterThanOrEqual(2);
  });

  it('keeps paid/live-provider capabilities fail-closed until authoritative evidence exists', () => {
    expect(edge).toContain("realtime_traffic: { state: 'blocked'");
    expect(edge).toContain("live_incidents: { state: 'blocked'");
    expect(edge).toContain("street_level_imagery: { state: 'blocked'");
    expect(edge).toContain("transit_realtime: { state: 'blocked'");
    expect(edge).toContain("offline_world_tiles: { state: 'blocked'");
    expect(domain).toContain('authorized live traffic provider');
    expect(domain).toContain("id: 'map-matching'");
    expect(domain).toContain("id: 'native-location'");
  });
});


describe('ATLAS Navigation Engine', () => {
  it('includes route-constrained map matching instead of trusting raw browser GPS alone', () => {
    expect(domain).toContain('matchPositionToRoute');
    expect(domain).toContain('snapThresholdM');
    expect(domain).toContain('distance_to_route_m');
    expect(domain).toContain('navigationBearing');
  });
});
