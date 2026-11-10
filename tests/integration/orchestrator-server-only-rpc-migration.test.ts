import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const sql = readFileSync(
  'supabase/migrations/20260920082420_restrict_orchestrator_rpc_to_server.sql',
  'utf8',
);

describe('ATLAS orchestrator server-only RPC migration', () => {
  it('revokes every privileged orchestrator RPC from public clients', () => {
    for (const name of [
      'atlas_orchestrator_create_task',
      'atlas_orchestrator_get_task',
      'atlas_orchestrator_save_task',
      'atlas_orchestrator_append_event',
      'atlas_orchestrator_list_events',
    ]) {
      expect(sql).toContain(`public.${name}`);
    }

    expect(sql.match(/from public, anon, authenticated/g)).toHaveLength(5);
    expect(sql.match(/to service_role/g)).toHaveLength(5);
    expect(sql).not.toMatch(/grant\s+execute[\s\S]+to\s+(anon|authenticated)/i);
  });
});
