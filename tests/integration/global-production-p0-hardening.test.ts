import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => (existsSync(path) ? readFileSync(path, 'utf8') : '');

const contractPath = 'data/ops/global-production-verification.json';
const verifierPath = 'scripts/verify-global-production.mjs';
const workerPath = 'worker/index.ts';

describe('ATLAS global production P0 hardening', () => {
  it('defines and serves a dedicated machine health contract without replacing Health OS', () => {
    const contract = JSON.parse(read(contractPath)) as {
      public_routes?: string[];
      health_check?: { path?: string; expected_status?: string };
    };
    const worker = read(workerPath);

    expect(contract.public_routes).toContain('/health');
    expect(contract.health_check).toEqual({
      path: '/api/v1/health',
      expected_status: 'healthy'
    });
    expect(worker).toContain("url.pathname === '/api/v1/health'");
    expect(worker).toContain("status: 'healthy'");
    expect(worker).toContain('withSecurityHeaders(');
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
    expect(verifier).toContain("expected_status");
    expect(verifier).toContain("strict-transport-security");
    expect(verifier).toContain("content-security-policy");
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
