import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';

const cliPath = 'scripts/verify-commercial-release.mjs';
const policyPath = 'data/ops/commercial-release-verification.json';

function evidenceFixture() {
  return {
    catalog_version: '2026.10.04-v1',
    public_surface: {
      routes: {
        '/': true,
        '/suite': true,
        '/pricing': true,
        '/request-demo': true,
        '/contact': true,
        '/terms': true,
        '/privacy': true,
        '/security': true,
        '/status': true
      }
    },
    enterprise: {
      tenant_isolation_verified: true,
      rbac_server_authoritative: true,
      audit_verified: true,
      privileged_auth_policy_verified: true,
      backup_restore_evidence_current: true,
      p0_security_findings: []
    },
    revenue: {
      lead_entrypoint_verified: true,
      authoritative_lead_workflow: true,
      price_order_semantics_verified: true,
      provisioning_governed: true,
      browser_authoritative_state: false
    },
    legal: {
      terms_published: true,
      privacy_published: true,
      security_published: true,
      legal_review_verified: true,
      owner_verified: true
    },
    capabilities: [
      {
        module_id: 'business',
        required: true,
        catalog_state: 'SELLABLE',
        evidence_current: true,
        regulated: false,
        external_evidence_verified: false
      }
    ]
  };
}

function runCli(input: { blocked?: boolean; mode?: 'fail-closed' | 'warning-only' } = {}) {
  const root = mkdtempSync(join(tmpdir(), 'atlas-commercial-cli-'));
  const sha = 'c'.repeat(40);
  const globalPath = join(root, 'global.json');
  const evidencePath = join(root, 'evidence.json');
  const outputPath = join(root, 'result.json');
  const evidence = evidenceFixture();
  if (input.blocked) evidence.legal.legal_review_verified = false;

  writeFileSync(globalPath, JSON.stringify({
    ok: true,
    expected_sha: sha,
    deployed_sha: sha,
    production_commit_sha_verified: true
  }));
  writeFileSync(evidencePath, JSON.stringify(evidence));

  const result = spawnSync(process.execPath, [
    cliPath,
    '--offer', 'atlas-business',
    '--expected-sha', sha,
    '--global-result', globalPath,
    '--evidence', evidencePath,
    '--json-output', outputPath,
    '--mode', input.mode ?? 'fail-closed'
  ], { encoding: 'utf8' });

  return {
    ...result,
    outputPath,
    json: existsSync(outputPath) ? JSON.parse(readFileSync(outputPath, 'utf8')) : null
  };
}

describe('ATLAS Commercial Release CLI', () => {
  it('adds the CLI and versioned commercial verification policy', () => {
    expect(existsSync(cliPath)).toBe(true);
    expect(existsSync(policyPath)).toBe(true);
  });

  it('emits SELLABLE JSON and exits zero only for complete evidence', () => {
    if (!existsSync(cliPath) || !existsSync(policyPath)) return;
    const run = runCli();
    expect(run.status, run.stderr).toBe(0);
    expect(run.json).toMatchObject({
      outcome: 'SELLABLE',
      ok: true,
      offer_id: 'atlas-business',
      evaluated_sha: 'c'.repeat(40)
    });
  });

  it('exits nonzero in fail-closed mode when a P0 condition is blocked', () => {
    if (!existsSync(cliPath) || !existsSync(policyPath)) return;
    const run = runCli({ blocked: true });
    expect(run.status).toBe(1);
    expect(run.json?.outcome).toBe('BLOCKED');
    expect(run.json?.blockers.some((entry: { code: string }) => entry.code === 'legal_review_unverified')).toBe(true);
  });

  it('keeps BLOCKED truth in warning-only mode while allowing diagnostic exit zero', () => {
    if (!existsSync(cliPath) || !existsSync(policyPath)) return;
    const run = runCli({ blocked: true, mode: 'warning-only' });
    expect(run.status, run.stderr).toBe(0);
    expect(run.json?.outcome).toBe('BLOCKED');
    expect(run.json?.ok).toBe(false);
    expect(run.json?.mode).toBe('warning-only');
  });

  it('pins required public routes and the three allowed offer ids in policy', () => {
    if (!existsSync(policyPath)) return;
    const policy = JSON.parse(readFileSync(policyPath, 'utf8')) as {
      gate_version: number;
      required_public_routes: string[];
      allowed_offer_ids: string[];
      evidence_freshness_hours: number;
    };
    expect(policy.gate_version).toBeGreaterThan(0);
    expect(policy.evidence_freshness_hours).toBeGreaterThan(0);
    expect(policy.required_public_routes).toEqual([
      '/', '/suite', '/pricing', '/request-demo', '/contact', '/terms', '/privacy', '/security', '/status'
    ]);
    expect(policy.allowed_offer_ids).toEqual(['atlas-business', 'atlas-enterprise', 'atlas-custom']);
  });
});
