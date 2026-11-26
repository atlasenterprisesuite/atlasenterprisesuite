import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-platform-controls/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const normalizer = readFileSync('packages/analytics/src/noaa-active-alerts.ts', 'utf8');
const policy = readFileSync('packages/analytics/src/climate-resilience.ts', 'utf8');
const client = readFileSync('apps/web/src/modules/city/climateNoaaApi.ts', 'utf8');
const readGateSql = readFileSync('supabase/migrations/20261126100000_atlas_climate_read_gate.sql', 'utf8');

describe('ATLAS Climate / NOAA endpoint tenant and provider boundaries', () => {
  it('uses the canonical JWT-protected control plane and no public endpoint', () => {
    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toContain('verify_jwt = true');
    expect(edge).toContain("if (api === 'climate-noaa-alerts') return await handleClimateNoaaAlerts(req)");
  });
  it('checks identity, organization membership and RBAC before provider request', () => {
    expect(edge).toContain('const ctx = await urbanTwinContext(req)');
    expect(edge).toContain("await urbanTwinPermission(ctx, 'climate.read')");
    expect(edge).toContain("auth.getUser(token)");
    expect(edge).toContain(".from('organization_members')");
    const start = edge.indexOf('async function handleClimateNoaaAlerts');
    const end = edge.indexOf('\nDeno.serve(', start);
    const route = edge.slice(start, end);
    expect(route.indexOf('const ctx = await urbanTwinContext(req)')).toBeLessThan(route.indexOf('await fetch(sourceUrl'));
  });
  it('enforces an independent climate.read role permission without Urban Twin manage authority', () => {
    const route = edge.slice(edge.indexOf('async function handleClimateNoaaAlerts'), edge.indexOf('\nDeno.serve('));
    expect(route).toContain("await urbanTwinPermission(ctx, 'climate.read')");
    expect(route).not.toContain("await urbanTwinPermission(ctx, 'city.twin.manage')");
    expect(readGateSql).toContain("('climate.read',");
    expect(readGateSql).toContain("('staff', 'climate.read')");
  });
  it('checks a transactional server-only quota and mandatory audit before the NOAA request', () => {
    const route = edge.slice(edge.indexOf('async function handleClimateNoaaAlerts'), edge.indexOf('\nDeno.serve('));
    expect(route).toContain("'atlas_climate_acquire_read_slot'");
    expect(route.indexOf("'atlas_climate_acquire_read_slot'")).toBeLessThan(route.indexOf('await fetch(sourceUrl'));
    expect(route).toContain("'climate_provider_rate_limited', 429");
    expect(route).toContain("if (completionAuditError) return urbanTwinFail(req, 'climate_audit_unavailable', 503)");
    expect(route).not.toContain('await urbanTwinAudit(');
    expect(readGateSql).toContain('on conflict (org_id, window_start) do update');
    expect(readGateSql).toContain('where public.atlas_climate_provider_read_quota.request_count < 6');
    expect(readGateSql).toContain("'climate.noaa.request.reserved'");
    expect(readGateSql).toContain('revoke all on function public.atlas_climate_acquire_read_slot(uuid, uuid) from public, anon, authenticated');
    expect(readGateSql).toContain('grant execute on function public.atlas_climate_acquire_read_slot(uuid, uuid) to service_role');
  });
  it('keeps the NOAA request server-side, fixed-origin, read-only and bounded', () => {
    expect(edge).toContain("'https://api.weather.gov/alerts?active=true&point='");
    expect(edge).toContain("redirect: 'error'");
    expect(edge).toContain('AbortSignal.timeout(8000)');
    expect(edge).toContain('const limitBytes = 1_048_576');
    expect(edge).toContain("method: 'GET'");
    expect(edge).toContain("if (api === 'climate-noaa-alerts')");
  });
  it('calls the canonical session-scoped server endpoint rather than NOAA directly from a browser', () => {
    expect(client).toContain('getActiveAtlasOrganization()');
    expect(client).toContain('authorizedAtlasFetch(');
    expect(client).toContain("'x-atlas-org-id': organization.id");
    expect(client).toContain("/functions/v1/atlas-platform-controls?api=climate-noaa-alerts");
    expect(client).toContain("method: 'POST'");
    expect(client).toContain('body: JSON.stringify({ site_id: siteId })');
    expect(client).not.toContain('body: JSON.stringify({ latitude, longitude })');
    expect(edge).toContain("if (req.method !== 'POST') return urbanTwinFail(req, 'method_not_allowed', 405)");
    expect(edge).toContain('let selection: unknown;');
    expect(edge).toContain('selection = await req.json();');
    expect(edge).toContain(".from('atlas_urban_twin_entities')");
    expect(edge).toContain(".eq('org_id', ctx.orgId)");
    expect(edge).toContain(".eq('verification_state', 'verified')");
    expect(edge).toContain(".eq('lifecycle_state', 'active')");
    expect(edge).toContain('const latitude = site.latitude;');
    expect(edge).toContain('const longitude = site.longitude;');
    expect(edge).not.toContain('rawCoords.latitude');
    expect(client).not.toContain('URLSearchParams');
    expect(client).not.toContain('https://api.weather.gov');
    expect(edge).toContain('new globalThis.URL(req.url)');
  });
  it('checks verified site ownership and coordinates before provider quota reservation', () => {
    const route = edge.slice(edge.indexOf('async function handleClimateNoaaAlerts'), edge.indexOf('\nDeno.serve('));
    const siteLookup = route.indexOf(".from('atlas_urban_twin_entities')");
    expect(siteLookup).toBeGreaterThan(0);
    expect(siteLookup).toBeLessThan(route.indexOf("'atlas_climate_acquire_read_slot'"));
    expect(route).toContain("'climate_site_not_verified', 403");
    expect(route).toContain('urbanTwinUuid(siteId)');
    expect(route).not.toContain('endpoint.searchParams');
  });
  it('does not broadcast alerts or promote unverified evidence', () => {
    expect(normalizer).toContain('mayPublishAlert: false');
    expect(normalizer).toContain('rejectedCount');
    expect(normalizer).toContain('unprocessedCount');
    expect(policy).toContain('mayPublishAlert: false');
    expect(edge).toContain("'climate.noaa.read.completed'");
    expect(edge).not.toContain("if (api === 'climate-noaa-alerts') return await fetch(");
  });
});
