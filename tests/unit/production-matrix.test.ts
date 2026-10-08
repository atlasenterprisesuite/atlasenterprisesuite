import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const contract = JSON.parse(readFileSync('data/ops/global-production-verification.json', 'utf8')) as {
  public_routes: string[];
  p1_routes: string[];
  critical_network_routes: string[];
  critical_crm_routes: string[];
};

const preload = `
globalThis.fetch = async (input) => {
  const parsed = new URL(String(input));
  const path = parsed.pathname;
  const p0Fail = process.env.ATLAS_MOCK_P0 === path;
  const p1Fail = process.env.ATLAS_MOCK_P1 === path;
  const status = path === '/deployment.json' ? 401 : (p0Fail || p1Fail ? 404 : 200);
  return new Response(status === 200 ? '<!doctype html><title>ATLAS</title>' : 'not found', {
    status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'strict-transport-security': 'max-age=31536000',
      'content-security-policy': "default-src 'self'",
      'x-atlas-version-id': 'mock-version-1',
      'x-atlas-version-tag': process.env.ATLAS_MOCK_SHA ?? 'correct-sha'
    }
  });
};
`;

function verify(options: { sha?: string; p0Fail?: string; p1Fail?: string; mode?: string } = {}) {
  const run = spawnSync(
    process.execPath,
    [
      '--import',
      'data:text/javascript,' + encodeURIComponent(preload),
      'scripts/verify-global-production.mjs',
      '--expected-sha',
      options.sha ?? 'correct-sha',
      '--mode',
      options.mode ?? 'fail-closed'
    ],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      timeout: 20_000,
      env: {
        ...process.env,
        ATLAS_MOCK_SHA: 'correct-sha',
        ATLAS_MOCK_P0: options.p0Fail ?? '',
        ATLAS_MOCK_P1: options.p1Fail ?? ''
      }
    }
  );
  if (run.error) throw run.error;
  return { exitCode: run.status, output: JSON.parse(run.stdout) };
}

describe('ATLAS 777 production matrix — live-probe contract with controlled HTTP responses', () => {
  it('keeps public core, identity, and Network revenue/compliance routes at P0', () => {
    expect(contract.public_routes).toContain('/');
    expect(contract.public_routes).toContain('/identity?app=%2Ffinance');
    expect(contract.critical_network_routes).toContain('/business/network/payouts');
    expect(contract.critical_network_routes).toContain('/business/network/compliance');
    const p0 = [
      ...contract.public_routes,
      ...contract.critical_network_routes,
      ...contract.critical_crm_routes
    ];
    expect(contract.p1_routes.length).toBeGreaterThan(0);
    expect(new Set([...p0, ...contract.p1_routes]).size).toBe(p0.length + contract.p1_routes.length);
  });

  it('passes clean P0 and P1 responses only when expected production SHA matches', () => {
    const result = verify();
    expect(result.exitCode).toBe(0);
    expect(result.output.ok).toBe(true);
    expect(result.output.status).toBe('passed');
    expect(result.output.checks.production_commit_sha_verified).toBe(true);
    expect(result.output.p1_warning_count).toBe(0);
  });

  it('fails closed on a real HTTP 404 on P0 Network payouts', () => {
    const result = verify({ p0Fail: '/business/network/payouts' });
    expect(result.exitCode).toBe(1);
    expect(result.output.ok).toBe(false);
    expect(result.output.p0_failure_count).toBeGreaterThan(0);
  });

  it('does not certify an older deployed SHA even when all routes return HTTP 200', () => {
    const result = verify({ sha: 'different-commit-sha' });
    expect(result.exitCode).toBe(1);
    expect(result.output.ok).toBe(false);
    expect(result.output.checks.production_commit_sha_verified).toBe(false);
  });

  it('reports P1 route errors without falsely failing valid P0 certification', () => {
    const result = verify({ p1Fail: '/cloud/observability' });
    expect(result.exitCode).toBe(0);
    expect(result.output.ok).toBe(true);
    expect(result.output.status).toBe('passed-with-warnings');
    expect(result.output.p1_warning_count).toBe(1);
    expect(result.output.checks.p1_routes_reachable).toBe(false);
  });

  it('preserves warning-only exit semantics without claiming verification', () => {
    const result = verify({ p0Fail: '/business/network/payouts', mode: 'warning-only' });
    expect(result.exitCode).toBe(0);
    expect(result.output.ok).toBe(false);
    expect(result.output.status).toBe('warning');
  });
});
