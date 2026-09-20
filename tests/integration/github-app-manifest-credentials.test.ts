import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260920160000_atlas_github_app_manifest_credentials.sql',
  'utf8',
);

describe('ATLAS GitHub App manifest credential vault', () => {
  it('stores GitHub App credentials only in Supabase Vault', () => {
    expect(sql).toContain('vault.create_secret');
    expect(sql).toContain('vault.update_secret');
    expect(sql).toContain('vault.decrypted_secrets');
    expect(sql).toContain('atlas_github_private_key');
    expect(sql).toContain('atlas_github_webhook_secret');
  });

  it('requires service role or the existing orchestrator runtime authorization boundary', () => {
    expect(sql).toContain("auth.role() = 'service_role'");
    expect(sql).toContain('private.atlas_orchestrator_runtime_authorized()');
    expect(sql).toContain('atlas_orchestrator_runtime_unauthorized');
    expect(sql).toContain('security definer');
    expect(sql).toContain("set search_path = ''");
  });

  it('does not grant authenticated users access to credential RPCs', () => {
    expect(sql).toContain('revoke all on function public.atlas_orchestrator_get_github_app_credentials()');
    expect(sql).toContain('from public, authenticated');
    expect(sql).toContain('to anon, service_role');
  });
});
