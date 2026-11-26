import { describe, expect, it } from 'vitest';
import { evaluateAtlasSovereignDeployReadiness } from '../../packages/core/src/deploymentControl';

const SHA = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const now = Date.parse('2026-11-26T12:00:00.000Z');
const infra = () => ({
  scope: { organization_id: 'tenant-A', role: 'owner' },
  canonical_repository: 'atlasenterprisesuite/atlasenterprisesuite',
  production_readiness: 'ready',
  provider_requirements: {
    github: false, supabase: true, cloudflare: true, production: true, vercel: false
  },
  provider_status: {
    github: { state: 'ready', required: false },
    supabase: { state: 'ready', required: true },
    cloudflare: { state: 'ready', required: true },
    production: { state: 'ready', required: true },
    vercel: { state: 'failed', required: false }
  },
  blockers: [],
  evidence: { generated_at: '2026-11-26T11:59:00.000Z' }
});
const release = () => ({
  id: 'release-1', release_key: 'atlas-enterprise-web', channel: 'production',
  status: 'promoted', version: 'v1', source_ref: SHA, manifest_hash: 'manifest'
});

describe('ATLAS sovereign deploy — release/readiness synchronization', () => {
  it('ignores optional Vercel failures and never calls CI readiness production proof', () => {
    const result = evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: infra(), release: release(), now
    });
    expect(result.status).toBe('review_required');
    expect(result.verifiedProduction).toBe(false);
    expect(result.targetSha).toBe(SHA);
    expect(result.blockers).toHaveLength(0);
    expect(result.providerStates.cloudflare).toBe('ready');
    expect(result.providerStates.vercel).toBe('optional');
  });

  it('fails closed on foreign tenant evidence', () => {
    const result = evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-B', infra: infra(), release: release(), now
    });
    expect(result.status).toBe('blocked');
    expect(result.blockers).toContain('organization_scope_mismatch');
  });

  it('fails closed on stale, missing, and future dated evidence', () => {
    const input = infra();
    input.evidence.generated_at = '2026-11-25T10:00:00.000Z';
    expect(evaluateAtlasSovereignDeployReadiness({ organizationId: 'tenant-A', infra: input, release: release(), now }).blockers).toContain('infrastructure_evidence_stale');
    input.evidence.generated_at = 'invalid';
    expect(evaluateAtlasSovereignDeployReadiness({ organizationId: 'tenant-A', infra: input, release: release(), now }).blockers).toContain('infrastructure_evidence_stale');
    input.evidence.generated_at = '2026-11-26T12:10:00.000Z';
    expect(evaluateAtlasSovereignDeployReadiness({ organizationId: 'tenant-A', infra: input, release: release(), now }).blockers).toContain('infrastructure_evidence_stale');
  });

  it('requires exact source SHA and an actual release row, not a green provider badge', () => {
    expect(evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: infra(), release: null, now
    }).blockers).toContain('release_not_selected');
    expect(evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: infra(), release: { ...release(), source_ref: 'main' }, now
    }).blockers).toContain('release_source_sha_missing');
  });

  it('fails closed on blocking required provider while ignoring optional outages', () => {
    const input = infra();
    input.provider_status.cloudflare.state = 'failed';
    input.production_readiness = 'blocked';
    expect(evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: input, release: release(), now
    }).blockers).toEqual(expect.arrayContaining(['infrastructure_not_ready', 'required_cloudflare_not_ready']));
  });

  it('blocks when Vercel is made required against sovereign policy', () => {
    const input = infra();
    input.provider_requirements.vercel = true;
    expect(evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: input, release: release(), now
    }).blockers).toContain('legacy_vercel_required');
  });

  it('treats missing payload, non-canonical repository and absent required states as blockers', () => {
    expect(evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: null, release: release(), now
    }).status).toBe('blocked');
    const input = infra();
    input.canonical_repository = 'wrong/repository';
    expect(evaluateAtlasSovereignDeployReadiness({
      organizationId: 'tenant-A', infra: input, release: release(), now
    }).blockers).toContain('canonical_repository_mismatch');
  });
});
