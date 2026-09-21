import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = JSON.parse(readFileSync('data/ops/global-production-verification.json', 'utf8')) as {
  version: number;
  public_routes: string[];
};
const authorizedVerifier = readFileSync('supabase/functions/atlas-cloudflare-production-http-verify/index.ts', 'utf8');
const cloudflareWorkflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');
const globalWorkflow = readFileSync('.github/workflows/global-production-verify.yml', 'utf8');

const WORK_ROUTES = ['/work', '/work/new', '/work/connections', '/work/runtimes', '/work/policies', '/work/computer-operations'];

describe('ATLAS Work fail-closed production verification', () => {
  it('requires every critical Work route in the global production contract', () => {
    expect(contract.version).toBeGreaterThanOrEqual(8);
    for (const route of WORK_ROUTES) expect(contract.public_routes).toContain(route);
  });

  it('checks Work through the authorized production verifier and exact-version route set', () => {
    for (const route of WORK_ROUTES) expect(authorizedVerifier).toContain(`probe('${route}')`);
    expect(authorizedVerifier).toContain('work_routes_reachable: workRoutesOk');
    expect(authorizedVerifier).toContain('const verified = publicShellOk && commerceRouteOk && revenueRouteOk && analyticsRouteOk && criticalNetworkRoutesOk && workRoutesOk');
    expect(authorizedVerifier).toContain('routedProbes.every');
  });

  it('makes the Cloudflare deploy gate fail closed when Work is not reachable', () => {
    for (const route of WORK_ROUTES) {
      expect(cloudflareWorkflow).toContain(route);
    }
    expect(cloudflareWorkflow).toContain('work_routes_reachable');
    expect(cloudflareWorkflow).toContain('ATLAS Work production routes were not verified');
    expect(cloudflareWorkflow).toContain('Authorized runtime did not verify ATLAS Work');
  });

  it('requires authorized fallback to confirm Work routes in global verification', () => {
    expect(globalWorkflow).toContain('work_routes_reachable');
    expect(globalWorkflow).toContain('WORK_OK');
    expect(globalWorkflow).toContain('[ "$WORK_OK" = "true" ]');
  });
});
