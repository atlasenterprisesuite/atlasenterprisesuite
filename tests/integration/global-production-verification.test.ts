import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const contractPath = 'data/ops/global-production-verification.json';
const verifierPath = 'scripts/verify-global-production.mjs';
const workflowPath = '.github/workflows/global-production-verify.yml';
const authorizedVerifierPath = 'supabase/functions/atlas-cloudflare-production-http-verify/index.ts';

describe('ATLAS global production verification', () => {
  it('defines one canonical fail-closed production route contract', () => {
    expect(existsSync(contractPath)).toBe(true);
    if (!existsSync(contractPath)) return;

    const contract = JSON.parse(read(contractPath)) as {
      production_origin: string;
      default_mode: string;
      public_routes: string[];
      critical_network_routes: string[];
      protected_routes: Array<{ path: string; allowed_statuses: number[] }>;
    };

    expect(contract.production_origin).toBe('https://www.atlasenterprisesuite.com');
    expect(contract.default_mode).toBe('fail-closed');
    expect(contract.public_routes).toEqual([
      '/',
      '/identity?app=%2Ffinance',
      '/finance',
      '/health',
      '/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel',
      '/studio/teleprompter',
      '/studio/web-launch',
      '/crm'
    ]);
    expect(contract.critical_network_routes).toEqual([
      '/business/network',
      '/business/network/pricing',
      '/business/network/commissions',
      '/business/network/payouts',
      '/business/network/compliance'
    ]);
    expect(contract.protected_routes).toEqual([
      { path: '/deployment.json', allowed_statuses: [302, 401, 403] }
    ]);
  });

  it('provides a portable provider-neutral verifier with fail-closed semantics', () => {
    expect(existsSync(verifierPath)).toBe(true);
    const verifier = read(verifierPath);

    expect(verifier).toContain('global-production-verification.json');
    expect(verifier).toContain("'fail-closed'");
    expect(verifier).toContain("'warning-only'");
    expect(verifier).toContain('--defer-edge-challenge');
    expect(verifier).toContain('--expected-sha');
    expect(verifier).toContain('x-atlas-version-id');
    expect(verifier).toContain('x-atlas-version-tag');
    expect(verifier).not.toContain('passed-edge-secured');
    expect(verifier).toContain('challenge-deferred');
    expect(verifier).toContain('classified_root_challenge_deferred');
    expect(verifier).toContain('const verified = directlyVerified;');
    expect(verifier).toContain('AbortSignal.timeout');
    expect(verifier).toContain("redirect: 'manual'");
    expect(verifier).toContain('blocked-cross-origin-redirect');
  });

  it('exposes the portable verifier through package scripts', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['verify:production:global']).toBe(
      'node scripts/verify-global-production.mjs'
    );
  });

  it('provides a reusable post-deploy workflow for any provider path', () => {
    expect(existsSync(workflowPath)).toBe(true);
    const workflow = read(workflowPath);

    expect(workflow).toContain('workflow_call:');
    expect(workflow).toContain('workflow_dispatch:');
    expect(workflow).toContain('deployment_status:');
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('verify:production:global');
    expect(workflow).toContain('--defer-edge-challenge');
    expect(workflow).toContain('--expected-sha "$GITHUB_SHA"');
    expect(workflow).toContain('audience=atlas-production-http-verifier');
    expect(workflow).toContain('/functions/v1/atlas-cloudflare-production-http-verify?api=verify');
    expect(workflow).toContain('fail-closed');

    const cloudflareWorkflow = read('.github/workflows/cloudflare-deploy.yml');
    expect(cloudflareWorkflow).toContain('global-production-verification:');
    expect(cloudflareWorkflow).toContain('uses: ./.github/workflows/global-production-verify.yml');
    expect(cloudflareWorkflow).toContain('mode: fail-closed');
    expect(cloudflareWorkflow).toContain('- "scripts/verify-global-production.mjs"');
    expect(cloudflareWorkflow).toContain('- ".github/workflows/global-production-verify.yml"');
  });

  it('keeps warning-only diagnostics from turning authorized fallback into a blocking gate', () => {
    const workflow = read(workflowPath);
    expect(workflow).toContain(
      "steps.direct.outputs.requires_authorized_fallback == 'true' && steps.policy.outputs.mode == 'fail-closed'"
    );
  });

  it('never treats a Cloudflare challenge on the public root as direct production success', () => {
    const verifier = read(verifierPath);
    const workflow = read(workflowPath);

    expect(verifier).toContain('challengeOnlyOnRoot');
    expect(verifier).toContain('const verified = directlyVerified;');
    expect(verifier).toContain('requires_authorized_fallback: challengeDeferred');
    expect(verifier).not.toContain('passed-edge-secured');
    expect(workflow).toContain('Verify through authorized ATLAS runtime after classified edge challenge');
  });

  it('keeps authorized runtime verification aligned with the shared Network route contract', () => {
    expect(existsSync(contractPath)).toBe(true);
    if (!existsSync(contractPath)) return;

    const contract = JSON.parse(read(contractPath)) as { critical_network_routes: string[] };
    const authorizedVerifier = read(authorizedVerifierPath);

    for (const route of contract.critical_network_routes) {
      expect(authorizedVerifier, route).toContain(`'${route}'`);
    }

    expect(authorizedVerifier).toContain("'/health'");
    expect(authorizedVerifier).toContain(
      "'/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel'"
    );
    expect(authorizedVerifier).toContain('health_route_reachable');
    expect(authorizedVerifier).toContain('jaque_mate_sentinel_route_reachable');
  });

  it('authorizes only the canonical Cloudflare and global verification workflows through OIDC', () => {
    const authorizedVerifier = read(authorizedVerifierPath);

    expect(authorizedVerifier).toContain('ALLOWED_WORKFLOWS');
    expect(authorizedVerifier).not.toContain('Set([\\n');
    expect(authorizedVerifier).toContain(
      '.github/workflows/cloudflare-deploy.yml@refs/heads/main'
    );
    expect(authorizedVerifier).toContain(
      '.github/workflows/global-production-verify.yml@refs/heads/main'
    );
    expect(authorizedVerifier).toContain("payload.ref !== 'refs/heads/main'");
  });
});
