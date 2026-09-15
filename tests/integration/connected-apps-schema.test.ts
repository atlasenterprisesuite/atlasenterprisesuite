import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20260915161500_connected_apps_microsoft_foundation.sql';

describe('Connected Apps schema compatibility extension', () => {
  it('extends the canonical ATLAS integration registry instead of creating a parallel connection store', () => {
    const sql = readFileSync(path, 'utf8');

    expect(sql).toContain('public.atlas_integration_connections');
    expect(sql).toContain('public.atlas_integration_credentials');
    expect(sql).toContain('public.atlas_oauth_states');
    expect(sql).toContain('public.atlas_integration_providers');
    expect(sql).toContain('public.atlas_integration_grants');
    expect(sql).toContain('public.atlas_integration_events');
    expect(sql).not.toMatch(/create table(?: if not exists)? public\.integration_connections\b/i);
  });

  it('adds Microsoft and truthful Connected Apps lifecycle states without weakening legacy providers', () => {
    const sql = readFileSync(path, 'utf8');

    expect(sql).toMatch(/provider in \('google', 'hubspot', 'microsoft'\)/i);
    for (const state of [
      'not_connected',
      'authorizing',
      'connected_unverified',
      'verified',
      'degraded',
      'expired',
      'reconnect_required',
      'revoked',
      'error'
    ]) {
      expect(sql).toContain(`'${state}'`);
    }
    expect(sql).toMatch(/state not in \('connected', 'verified'\)[\s\S]*authorized[\s\S]*provider_verified/i);
  });

  it('stores OAuth state hashes and encrypted verifier references, never raw tokens or verifier plaintext', () => {
    const sql = readFileSync(path, 'utf8');

    expect(sql).toContain('code_verifier_credential_ref');
    expect(sql).toContain('nonce_hash');
    expect(sql).not.toMatch(/\baccess_token\s+text\b|\brefresh_token\s+text\b|\bclient_secret\s+text\b|\bcode_verifier\s+text\b/i);
  });

  it('keeps credentials server-only and scopes user-facing metadata through organization authorization', () => {
    const sql = readFileSync(path, 'utf8');

    expect(sql).toMatch(/revoke all on public\.atlas_integration_credentials from anon, authenticated/i);
    expect(sql).toMatch(/grant all on public\.atlas_integration_credentials to service_role/i);
    expect(sql).toMatch(/alter table public\.atlas_integration_grants enable row level security/i);
    expect(sql).toMatch(/alter table public\.atlas_integration_events enable row level security/i);
    expect(sql).toContain('has_identity_permission');
  });
});
