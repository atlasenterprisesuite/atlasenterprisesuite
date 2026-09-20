import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'utf8'
);
const workflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('ATLAS Commerce production release gate', () => {
  it('requires /commerce in the authorized runtime verifier', () => {
    expect(verifier).toContain("probe('/commerce')");
    expect(verifier).toContain('commerce_route_reachable');
    expect(verifier).toContain('commerce.status === 200');
    expect(verifier).toContain('publicShellOk && commerceRouteOk && criticalNetworkRoutesOk && workRoutesOk && deploymentPathProtected && productionCommitVerified');
  });

  it('requires /commerce in direct Worker verification', () => {
    const direct = workflow.match(
      /- name: Verify public Worker web shell([\s\S]*?)- name:/
    )?.[1] ?? '';
    expect(direct).toContain("probe_worker '/commerce' 'commerce'");
    expect(direct).toContain('COMMERCE_VERSION');
    expect(direct).toContain('commerce_route_reachable=true');
  });

  it('verifies /commerce on the public production domain after either deployment mode', () => {
    const production = workflow.match(
      /- name: Verify public ATLAS production routes([\s\S]*?)- name: Verify production shell through authorized ATLAS runtime/
    )?.[1] ?? '';
    expect(production).toContain('probe_route "ATLAS Commerce" "/commerce" "commerce_route_reachable"');
    expect(production).not.toContain('deployment_mode.outputs.mode');
  });

  it('fails closed when challenged unless authorized verification also proves Commerce', () => {
    const authorized = workflow.match(
      /- name: Verify production shell through authorized ATLAS runtime([\s\S]*?)- name: Record Cloudflare deployment evidence/
    )?.[1] ?? '';
    expect(authorized).toContain('COMMERCE_OK');
    expect(authorized).toContain('commerce_route_reachable');
    expect(authorized).toContain('"$COMMERCE_OK" = "true"');
    expect(workflow).toContain('AUTHORIZED_COMMERCE_REACHABLE');
    expect(workflow).toContain('PUBLIC_COMMERCE_REACHABLE');
  });

  it('preserves all critical ATLAS Network routes', () => {
    for (const route of [
      '/business/network',
      '/business/network/pricing',
      '/business/network/commissions',
      '/business/network/payouts',
      '/business/network/compliance'
    ]) {
      expect(verifier).toContain(`'${route}'`);
      expect(workflow).toContain(route);
    }
  });
});
