import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('supabase/functions/atlas-connected-apps/index.ts', 'utf8');
const migration = readFileSync('supabase/migrations/20261005130000_atlas_connected_apps_control_plane.sql', 'utf8');

describe('Connected Apps governance operations', () => {
  it('separates policy audit and retention permissions', () => {
    for (const operation of ['policy.list', 'policy.upsert', 'audit.list', 'retention.list', 'retention.request_delete']) {
      expect(source).toContain(`'${operation}'`);
    }
    expect(source).toContain('connected_apps.policy.manage');
    expect(source).toContain('connected_apps.audit.read');
    expect(source).toContain('connected_apps.retention.manage');
  });

  it('persists explicit allow approval-required deny policy effects', () => {
    expect(migration).toContain("effect in ('allow','approval_required','deny')");
  });

  it('records truthful retention and deletion-request state', () => {
    expect(migration).toContain("storage_mode in ('transient','cached','persisted')");
    expect(migration).toContain('deletion_request_state');
    expect(source).toContain('deletion_requested');
    expect(source).not.toContain("provider_deleted: true");
  });
});
