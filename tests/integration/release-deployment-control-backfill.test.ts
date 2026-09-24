import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const schema = readFileSync(
  'supabase/migrations/20260923235300_release_deployment_control_backfill.sql',
  'utf8'
);
const completion = readFileSync(
  'supabase/migrations/20260923235400_release_deployment_control_completion_gate.sql',
  'utf8'
);
const edge = readFileSync('supabase/functions/atlas-release-control/index.ts', 'utf8');
const authVerifier = readFileSync(
  'supabase/functions/atlas-release-control-auth-verifier/index.ts',
  'utf8'
);

describe('ATLAS Release & Deployment Control backfill', () => {
  it('restores the four governed release-control tables with RLS', () => {
    for (const table of [
      'atlas_releases',
      'atlas_release_components',
      'atlas_deployments',
      'atlas_deployment_gates'
    ]) {
      expect(schema).toContain(`public.${table}`);
      expect(schema).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('registers the canonical Supabase production baseline without rewriting history', () => {
    expect(schema).toContain('atlas-production-baseline-2026-09-08');
    expect(schema).toContain('2026.09.08.baseline.1');
    expect(schema).toContain('55b10d5a208094b9532c9ef7f61d6d17b8c854a833fc13dc5b447655498251c8');
    expect(schema).toContain('historical_registry_rewritten');
    expect(schema).toContain('on conflict (release_key) do nothing');
  });

  it('backfills the live release-control artifact inventory', () => {
    for (const component of [
      'atlas-enterprise-web',
      'atlas-public-health',
      'atlas-observability',
      'atlas-governance',
      'atlas-infra-status',
      'atlas-auth',
      'atlas-copilot',
      'atlas-release-control'
    ]) {
      expect(schema).toContain(component);
    }
    expect(schema).toContain('8899f6231a5b159a7770946fa533008f0e74b8e60e7a16f9d1628516f54ed5f9');
  });

  it('keeps release control authenticated and tenant-scoped', () => {
    expect(edge).toContain("req.headers.get('authorization')");
    expect(edge).toContain('organization_members');
    expect(edge).toContain('x-atlas-org-id');
    expect(edge).toContain('has_identity_permission');
  });

  it('includes the Supabase-native auth verifier', () => {
    expect(authVerifier).toContain('atlas-release-control');
    expect(authVerifier).toMatch(/runtime_verifier|verification/i);
  });

  it('fails closed at the completion gate', () => {
    expect(completion).toContain('atlas_release_completion_gate');
    expect(completion).toContain("d.status='promoted'");
    expect(completion).toContain("d.provider_execution_state='succeeded'");
    expect(completion).toContain("d.health_state='healthy'");
    expect(completion).toContain("g.required and g.status not in ('passed','waived')");
    expect(completion).toContain('blocking_count=0');
  });
});
