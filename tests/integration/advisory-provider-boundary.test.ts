import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes = readFileSync('apps/web/src/modules/advisory/AdvisoryRoutes.tsx', 'utf8');
const api = readFileSync('apps/web/src/lib/advisoryApi.ts', 'utf8');

describe('Advisory external provider boundary', () => {
  it('exposes a provider-readiness route instead of a dead disabled card', () => {
    expect(routes).toContain('/advisory/providers');
    expect(routes).toContain('External providers');
    expect(routes).toContain('Authorization required');
  });

  it('reads only safe integration metadata from the canonical provider registry', () => {
    expect(api).toContain('atlas_integration_connections');
    expect(api).toContain('provider_verified');
    expect(api).toContain('last_verified_at');
    expect(api).toContain('advisory_firm_id');
    expect(api).toContain('bootstrapAdvisoryFirm');
    expect(api).not.toMatch(/select=[^\n]*secret_ref/);
    expect(api).not.toMatch(/select=[^\n]*credential_ref/);
    expect(api).not.toContain('atlas_integration_credentials');
  });

  it('does not expose browser-side provider authorization writes', () => {
    expect(api).not.toContain('createAdvisoryProviderConnection');
    expect(api).not.toContain('authorizeAdvisoryProvider');
  });
});
