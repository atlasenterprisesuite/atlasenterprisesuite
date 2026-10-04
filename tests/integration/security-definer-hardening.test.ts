import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync('supabase/migrations/20260926131500_harden_exposed_security_definer_functions.sql', 'utf8');

describe('exposed SECURITY DEFINER hardening', () => {
  it('moves privileged implementations out of the exposed schema', () => {
    expect(migration).toContain('alter function public.atlas_chat_can_access(uuid, uuid, uuid) set schema private');
    expect(migration).toContain('alter function public.atlas_chat_api(text, uuid, jsonb) set schema private');
    expect(migration).toContain('alter function public.has_oracle_entitlement(text) set schema private');
  });

  it('exposes only SECURITY INVOKER facades and keeps anonymous callers revoked', () => {
    expect(migration.match(/security invoker/g)).toHaveLength(3);
    expect(migration.match(/from public, anon/g)?.length).toBeGreaterThanOrEqual(6);
    expect(migration).toContain("set search_path = ''");
  });
});
