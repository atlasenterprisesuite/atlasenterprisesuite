import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations_legacy_pre_remote_sync/20261002133000_integration_auth_kind_alignment.sql',
  'utf8'
);
const core = readFileSync('packages/core/src/integrations.ts', 'utf8');

describe('canonical integration auth-kind schema alignment', () => {
  it('persists every modern auth kind advertised by the core integration contract', () => {
    for (const kind of [
      'oauth2',
      'oidc',
      'api_key',
      'service_token',
      'service_jwt',
      'signed_token',
      'opaque_reference',
      'password'
    ]) {
      expect(core).toContain(`'${kind}'`);
      expect(migration).toContain(`'${kind}'`);
    }
  });

  it('preserves fail-closed connected truth at the database boundary', () => {
    expect(migration).toContain('atlas_integration_connections_connected_truth_check');
    expect(migration).toMatch(
      /state\s*<>\s*'connected'[\s\S]*authorized\s*=\s*true[\s\S]*provider_verified\s*=\s*true/i
    );
  });

  it('does not weaken the legacy password exception contract', () => {
    expect(core).toContain('legacy_auth_not_approved');
    expect(migration).toContain('atlas_integration_connections_password_exception_check');
  });
});
