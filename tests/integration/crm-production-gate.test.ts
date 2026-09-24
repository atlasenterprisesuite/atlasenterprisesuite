import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

const CRM_ROUTES = [
  '/crm',
  '/crm/contacts',
  '/crm/companies',
  '/crm/deals',
  '/crm/service',
  '/crm/integrations/hubspot'
] as const;

describe('ATLAS CRM production gate', () => {
  it('defines the canonical critical CRM route contract', () => {
    const contract = JSON.parse(read('data/ops/global-production-verification.json')) as {
      critical_crm_routes?: string[];
    };

    expect(contract.critical_crm_routes).toEqual(CRM_ROUTES);
  });

  it('requires critical CRM routes in the portable fail-closed verifier', () => {
    const verifier = read('scripts/verify-global-production.mjs');
    expect(verifier).toContain('contract.critical_crm_routes');
    expect(verifier).toContain('critical_crm_routes_reachable');
  });

  it('requires CRM route evidence from the authorized runtime fallback', () => {
    const verifier = read('supabase/functions/atlas-cloudflare-production-http-verify/index.ts');
    for (const route of CRM_ROUTES) expect(verifier).toContain(`'${route}'`);
    expect(verifier).toContain('critical_crm_routes_reachable');
  });

  it('fails the reusable global production workflow when CRM evidence is absent', () => {
    const workflow = read('.github/workflows/global-production-verify.yml');
    expect(workflow).toContain('critical_crm_routes_reachable');
    expect(workflow).toContain('CRM_OK');
    expect(workflow).toContain('[ "$CRM_OK" = "true" ]');
  });

  it('probes all critical CRM routes in the Cloudflare deploy gate', () => {
    const workflow = read('.github/workflows/cloudflare-deploy.yml');
    for (const route of CRM_ROUTES) expect(workflow).toContain(route);
    expect(workflow).toContain('critical_crm_routes_reachable');
    expect(workflow).toContain('Critical ATLAS CRM production routes were not verified');
  });
});
