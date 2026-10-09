import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const repoSource = (path: string) => readFileSync(path, 'utf8');
const workflow = repoSource('.github/workflows/cloudflare-deploy.yml');
const monitor = repoSource('tools/certificate-monitor/probe.mjs');
const adapter = repoSource('supabase/migrations/20261009155535_atlas_certificate_evidence_ref_operator_fix.sql');
const targets = repoSource('supabase/migrations/20261009150152_atlas_certificate_lifecycle_inventory.sql');

describe('ATLAS authenticated certificate monitor contract', () => {
  it('uses the already deployed GitHub-OIDC infrastructure receiver', () => {
    expect(monitor).toContain("const audience = 'atlas-infrastructure-evidence'");
    expect(monitor).toContain("approvedUrl.pathname !== '/functions/v1/atlas-infra-evidence'");
    expect(monitor).toContain("approvedUrl.searchParams.get('api') !== 'record'");
    expect(monitor).toContain("verification_type: 'public-edge-verification'");
    expect(monitor).toContain("target_service: 'atlas-certificate-monitor'");
    expect(monitor).toContain('rejectUnauthorized: true');
    expect(monitor).toContain('servername: hostname');
  });

  it('runs scheduled probes without triggering production deployments', () => {
    expect(workflow).toContain("- cron: '20 12 * * *'");
    expect(workflow).toContain("if: github.event_name != 'schedule'");
    expect(workflow).toContain("if: github.event_name == 'schedule' || github.event_name == 'push'");
    expect(workflow).toContain('id-token: write');
    expect(workflow).toContain('tools/certificate-monitor/probe.mjs');
  });

  it('rejects unauthenticated and forged observations at database level', () => {
    expect(adapter).toContain("new.metadata->>'source' is distinct from 'github-actions-oidc'");
    expect(adapter).toContain("new.metadata->>'workflow' is distinct from");
    expect(adapter).toContain("new.metadata->>'ref' is distinct from 'refs/heads/main'");
    expect(adapter).toContain("new.checks->>'chain_verified' is distinct from 'true'");
    expect(adapter).toContain("new.checks->>'hostname_verified' is distinct from 'true'");
    expect(adapter).toContain('certificate_tls_validation_not_proven');
    expect(targets).toContain('enable row level security');
    expect(targets).toContain('atlas_certificate_observations_owner_read');
    expect(targets).toContain('grant select on public.atlas_certificate_observations to authenticated');
    expect(targets).not.toContain('grant insert on public.atlas_certificate_observations to authenticated');
  });

  it('never claims public TLS is mutual TLS', () => {
    expect(monitor).toContain('mtls_verified: false');
    expect(adapter).toContain("new.checks->>'mtls_verified' is distinct from 'false'");
    expect(adapter).toContain('v_success,v_success,false');
  });
});
