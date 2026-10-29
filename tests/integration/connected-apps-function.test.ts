import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-connected-apps/index.ts', 'utf8');

describe('atlas-connected-apps lifecycle function contract', () => {
  it('exposes the canonical lifecycle operations', () => {
    for (const operation of [
      'catalog.list', 'connection.list', 'connection.get', 'connection.prepare_auth',
      'connection.complete_auth', 'connection.verify', 'connection.reconnect',
      'connection.disconnect', 'capability.list'
    ]) expect(source).toContain(`'${operation}'`);
  });

  it('uses authenticated organization-scoped permission checks', () => {
    expect(source).toContain('has_identity_permission');
    expect(source).toContain('connected_apps.read');
    expect(source).toContain('connected_apps.connect');
    expect(source).toContain('connected_apps.manage');
    expect(source).toContain('connected_apps.disconnect');
    expect(source).toContain('org_id');
  });

  it('never selects or returns secret credential material', () => {
    expect(source).not.toContain("select('*')");
    expect(source).not.toContain('refresh_token');
    expect(source).not.toContain('access_token');
    expect(source).not.toContain('client_secret');
  });

  it('makes local disconnect authoritative even when provider revocation cannot be verified', () => {
    expect(source).toContain('revocation_pending');
    expect(source).toContain("state: 'unconfigured'");
    expect(source).toContain('provider_revoked');
  });
});
