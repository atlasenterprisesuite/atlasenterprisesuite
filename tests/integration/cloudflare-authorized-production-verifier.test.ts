import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const verifier = readFileSync(
  'supabase/functions/atlas-cloudflare-production-http-verify/index.ts',
  'utf8'
);
const workflow = readFileSync('.github/workflows/cloudflare-deploy.yml', 'utf8');

describe('Cloudflare authorized production HTTP verifier', () => {
  it('accepts only scoped GitHub OIDC from the main Cloudflare deployment workflow', () => {
    expect(verifier).toContain("const AUDIENCE = 'atlas-production-http-verifier'");
    expect(verifier).toContain(".github/workflows/cloudflare-deploy.yml@refs/heads/main");
    expect(verifier).toContain("payload.repository !== REPO");
    expect(verifier).toContain("payload.ref !== 'refs/heads/main'");
  });

  it('checks the public shell while preserving the protected deployment path', () => {
    expect(verifier).toContain("'/identity?app=%2Ffinance'");
    expect(verifier).toContain("'/finance'");
    expect(verifier).toContain("'/commerce'");
    expect(verifier).toContain("'/revenue'");
    expect(verifier).toContain("'/analytics'");
    expect(verifier).toContain("'/health'");
    expect(verifier).toContain(
      "'/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel'"
    );
    expect(verifier).toContain('health_route_reachable');
    expect(verifier).toContain('commerce_route_reachable');
    expect(verifier).toContain('revenue_route_reachable');
    expect(verifier).toContain('analytics_route_reachable');
    expect(verifier).toContain('jaque_mate_sentinel_route_reachable');
    expect(verifier).toContain("'/deployment.json'");
    expect(verifier).toContain("[302, 401, 403].includes(deployment.status)");
    expect(verifier).toContain("verification_source: 'atlas-authorized-supabase-runtime'");
    expect(verifier).toContain('verifier_version: VERSION');
  });

  it('returns observed Cloudflare version metadata without exposing the protected manifest path', () => {
    expect(verifier).toContain("response.headers.get('x-atlas-version-id')");
    expect(verifier).toContain("response.headers.get('x-atlas-version-tag')");
    expect(verifier).toContain('observed_version_id');
    expect(verifier).toContain('observed_version_tag');
  });

  it('lets the workflow fall back to authorized runtime verification when GitHub is challenged', () => {
    expect(workflow).toContain('Verify production shell through authorized ATLAS runtime');
    expect(workflow).toContain('audience=atlas-production-http-verifier');
    expect(workflow).toContain('/functions/v1/atlas-cloudflare-production-http-verify?api=verify');
    expect(workflow).toContain('AUTHORIZED_EDGE_VERIFIED');
    expect(workflow).toContain('AUTHORIZED_VERIFIER_VERSION');
    expect(workflow).toContain('[ "$AUTHORIZED_VERIFIER_VERSION" = "16" ]');
    expect(workflow).toContain('OBSERVED_VERSION_ID');
    expect(workflow).toContain('OBSERVED_VERSION_TAG');
    expect(workflow).toContain('AUTHORIZED_HEALTH_REACHABLE');
    expect(workflow).toContain('AUTHORIZED_JAQUE_MATE_SENTINEL_REACHABLE');
  });

  it('verifies the production domain after either deployment mode and covers critical ATLAS Network routes', () => {
    const productionStep = workflow.match(
      /- name: Verify public ATLAS production routes([\s\S]*?)- name: Verify production shell through authorized ATLAS runtime/
    )?.[1] ?? '';

    expect(productionStep).not.toBe('');
    expect(productionStep).not.toContain('deployment_mode.outputs.mode ==');
    expect(productionStep).toContain('https://www.atlasenterprisesuite.com');
    expect(productionStep).toContain('--location');
    expect(productionStep).toContain("%{url_effective}");
    expect(workflow).toContain("if: steps.production_edge.outputs.edge_challenge_detected == 'true'");

    const criticalRoutes = [
      '/business/network',
      '/business/network/pricing',
      '/business/network/commissions',
      '/business/network/payouts',
      '/business/network/compliance'
    ];

    for (const route of criticalRoutes) {
      expect(productionStep).toContain(route);
      expect(verifier).toContain(`'${route}'`);
    }

    expect(productionStep).toContain('/health');
    expect(productionStep).toContain('/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel');
    expect(workflow).toContain('health_route_reachable');
    expect(workflow).toContain('jaque_mate_sentinel_route_reachable');
    expect(workflow).toContain('Direct Health route verification missing');
    expect(workflow).toContain('Direct Jaque Mate + Sentinel route verification missing');

    expect(workflow).toContain('global-production-verification:');
    expect(workflow).toContain('uses: ./.github/workflows/global-production-verify.yml');
    expect(workflow).toContain('mode: fail-closed');
  });
});
