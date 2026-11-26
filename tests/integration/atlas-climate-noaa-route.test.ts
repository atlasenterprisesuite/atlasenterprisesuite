import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const edge = readFileSync('supabase/functions/atlas-platform-controls/index.ts', 'utf8');
const config = readFileSync('supabase/config.toml', 'utf8');
const normalizer = readFileSync('packages/analytics/src/noaa-active-alerts.ts', 'utf8');
const policy = readFileSync('packages/analytics/src/climate-resilience.ts', 'utf8');
const client = readFileSync('apps/web/src/modules/city/climateNoaaApi.ts', 'utf8');

describe('ATLAS Climate / NOAA endpoint tenant and provider boundaries', () => {
  it('uses the canonical JWT-protected control plane and no public endpoint', () => {
    expect(config).toContain('[functions.atlas-platform-controls]');
    expect(config).toContain('verify_jwt = true');
    expect(edge).toContain("if (api === 'climate-noaa-alerts') return await handleClimateNoaaAlerts(req, u)");
  });
  it('checks identity, organization membership and RBAC before provider request', () => {
    expect(edge).toContain('const ctx = await urbanTwinContext(req)');
    expect(edge).toContain("await urbanTwinPermission(ctx, 'city.twin.manage')");
    expect(edge).toContain("auth.getUser(token)");
    expect(edge).toContain(".from('organization_members')");
    const start = edge.indexOf('async function handleClimateNoaaAlerts');
    const end = edge.indexOf('\nDeno.serve(', start);
    const route = edge.slice(start, end);
    expect(route.indexOf('const ctx = await urbanTwinContext(req)')).toBeLessThan(route.indexOf('await fetch(sourceUrl'));
  });
  it('keeps the NOAA request server-side, fixed-origin, read-only and bounded', () => {
    expect(edge).toContain("'https://api.weather.gov/alerts/active?point='");
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
    expect(client).toContain("api: 'climate-noaa-alerts'");
    expect(client).not.toContain('https://api.weather.gov');
    expect(edge).toContain('new globalThis.URL(req.url)');
  });
  it('does not broadcast alerts or promote unverified evidence', () => {
    expect(normalizer).toContain('mayPublishAlert: false');
    expect(normalizer).toContain('rejectedCount');
    expect(normalizer).toContain('unprocessedCount');
    expect(policy).toContain('mayPublishAlert: false');
    expect(edge).toContain("'climate.noaa.read'");
    expect(edge).not.toContain("if (api === 'climate-noaa-alerts') return await fetch(");
  });
});
