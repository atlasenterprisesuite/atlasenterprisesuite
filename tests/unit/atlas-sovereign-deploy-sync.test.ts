import { describe, expect, it } from 'vitest';
import { buildAtlasSovereignReleaseDraft, canWriteAtlasSovereignReleaseDraft, evaluateAtlasSovereignDeployReadiness } from '../../packages/core/src/deploymentControl';

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

describe('ATLAS Deploy controlled write contract', () => {
  const validInput = () => ({
    releaseKey: 'atlas-deploy-777-rw',
    version: '2026.11.26-rc1',
    channel: 'development' as const,
    sourceSha: 'a'.repeat(40),
    artifactSha256: 'b'.repeat(64)
  });

  it('writes a server-authorized draft manifest with distinct commit SHA and immutable artifact digest', () => {
    const result = buildAtlasSovereignReleaseDraft(validInput());
    expect(result).toEqual({
      release_key: 'atlas-deploy-777-rw',
      version: '2026.11.26-rc1',
      channel: 'development',
      source_ref: 'a'.repeat(40),
      notes: expect.stringContaining('Unverified'),
      metadata: { github_ci_required: true },
      components: [{
        component_type: 'web_bundle',
        component_key: 'atlas-enterprise-suite-web',
        artifact_ref: null,
        artifact_sha256: 'b'.repeat(64),
        target_version: '2026.11.26-rc1',
        provider: 'cloudflare',
        deployment_order: 100,
        rollback_strategy: 'manual_only',
        rollback_ref: null,
        requires_migration: false,
        migration_ref: null,
        metadata: {}
      }]
    });
    expect(JSON.stringify(result)).not.toContain('organization_id');
  });

  it('rejects missing, invalid or placeholder checksums; never invents one', () => {
    const inputs = [
      { sourceSha: 'main' },
      { sourceSha: 'a'.repeat(39) },
      { artifactSha256: '' },
      { artifactSha256: '0'.repeat(64) },
      { artifactSha256: 'z'.repeat(64) },
      { releaseKey: 'not allowed spaces' },
      { version: '' },
      { channel: 'unknown' },
    ];
    for (const item of inputs) {
      expect(() => buildAtlasSovereignReleaseDraft({ ...validInput(), ...item } as never)).toThrow();
    }
  });

  it('prevents writes with revoked permissions, wrong tenant and expired infrastructure evidence', () => {
    expect(canWriteAtlasSovereignReleaseDraft({ organizationId: 'tenant-A', infra: infra(), granted: true, now })).toBe(true);
    expect(canWriteAtlasSovereignReleaseDraft({ organizationId: 'tenant-B', infra: infra(), granted: true, now })).toBe(false);
    expect(canWriteAtlasSovereignReleaseDraft({ organizationId: 'tenant-A', infra: infra(), granted: false, now })).toBe(false);
    expect(canWriteAtlasSovereignReleaseDraft({ organizationId: 'tenant-A', infra: null, granted: true, now })).toBe(false);
    const stale = infra();
    stale.evidence.generated_at = '2026-11-25T00:00:00.000Z';
    expect(canWriteAtlasSovereignReleaseDraft({ organizationId: 'tenant-A', infra: stale, granted: true, now })).toBe(false);
  });
});
