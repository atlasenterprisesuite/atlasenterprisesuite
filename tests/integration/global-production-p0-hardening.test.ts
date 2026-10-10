import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const contractPath = 'data/ops/global-production-verification.json';
const verifierPath = 'scripts/verify-production-p0.mjs';
const workerEntryPath = 'worker/entry.ts';
const workerCorePath = 'worker/index.ts';

describe('ATLAS global production P0 hardening', () => {
  it('defines and serves a dedicated machine health contract without replacing Health OS', () => {
    const contract = JSON.parse(read(contractPath)) as {
      public_routes?: string[];
      health_check?: { path?: string; expected_status?: string; scope?: string };
    };
    const workerEntry = read(workerEntryPath);
    const workerCore = read(workerCorePath);
    const wrangler = read('wrangler.jsonc');

    expect(contract.public_routes).toContain('/health');
    expect(contract.health_check).toEqual({
      path: '/api/v1/health',
      expected_status: 'healthy',
      scope: 'worker_liveness'
    });
    expect(wrangler).toContain('"main": "worker/entry.ts"');
    expect(workerEntry).toContain("url.pathname === '/api/v1/health'");
    expect(workerEntry).toContain("healthy ? 'healthy' : 'unhealthy'");
    expect(workerEntry).toContain("new URL('/status', request.url)");
    expect(workerCore).toContain('withSecurityHeaders(');
    expect(workerEntry).toContain('AtlasLocalRealtimeBus');
    expect(workerEntry).toContain('AtlasChatRealtimeBus');
  });

  it('fails closed unless health JSON and required security headers are verified', () => {
    const contract = JSON.parse(read(contractPath)) as {
      required_security_headers?: string[];
    };
    const verifier = read(verifierPath);

    expect(contract.required_security_headers).toEqual([
      'strict-transport-security',
      'content-security-policy'
    ]);
    expect(verifier).toContain('health_contract_verified');
    expect(verifier).toContain('security_headers_verified');
    expect(verifier).toContain('expected_status');
    expect(verifier).toContain('strict-transport-security');
    expect(verifier).toContain('content-security-policy');
    expect(verifier).toContain('process.exit(1)');
  });


  it('labels Worker liveness without pretending to have checked backend readiness', () => {
    const workerEntry = read(workerEntryPath);
    const verifier = read(verifierPath);
    const contract = JSON.parse(read(contractPath)) as { health_check?: { scope?: string } };

    expect(contract.health_check?.scope).toBe('worker_liveness');
    expect(workerEntry).toContain("scope: 'worker_liveness'");
    expect(workerEntry).toContain("supabase_database: 'not_checked'");
    expect(workerEntry).toContain("supabase_auth: 'not_checked'");
    expect(verifier).toContain("healthPayload.scope === 'worker_liveness'");
    expect(verifier).toContain("healthPayload.dependencies?.supabase_database === 'not_checked'");
    expect(verifier).toContain('backend_readiness_verified: false');
    expect(verifier).toContain("verification_scope: 'worker_liveness_and_edge_security_only'");
  });

  it('runs the P0 verifier before the existing global verifier', () => {
    const pkg = JSON.parse(read('package.json')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.['verify:production:global']).toBe(
      'node scripts/verify-production-p0.mjs && node scripts/verify-global-production.mjs'
    );
  });

  it('uses Node-24-compatible GitHub Action majors in adjacent production gates', () => {
    for (const path of [
      '.github/workflows/cloudflare-deploy.yml',
      '.github/workflows/production-deploy.yml'
    ]) {
      const workflow = read(path);
      expect(workflow, path).toContain('actions/checkout@v7');
      expect(workflow, path).toContain('actions/setup-node@v7');
      expect(workflow, path).not.toContain('actions/checkout@v4');
      expect(workflow, path).not.toContain('actions/setup-node@v4');
    }
  });
});
