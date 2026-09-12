import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(process.cwd(), 'supabase/migrations/20260911_hospitality_room_access.sql');

describe('ATLAS Hospitality Supabase schema contract', () => {
  it('defines the three organization/property-scoped Hospitality tables', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).toContain('create table if not exists public.hospitality_provider_instances');
    expect(sql).toContain('create table if not exists public.hospitality_room_mappings');
    expect(sql).toContain('create table if not exists public.hospitality_credential_references');
  });

  it('enables RLS on every Hospitality persistence table', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql.match(/enable row level security/g)?.length).toBe(3);
    expect(sql).toContain('organization_members');
    expect(sql).toContain('auth.uid()');
    expect(sql).toContain("status = 'active'");
  });

  it('constrains provider/readiness and credential lifecycle states', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    for (const state of ['not_configured', 'configured_unverified', 'ready', 'degraded', 'offline', 'disabled']) {
      expect(sql).toContain(`'${state}'`);
    }
    for (const status of ['issued', 'revoked', 'expired', 'failed', 'unknown']) {
      expect(sql).toContain(`'${status}'`);
    }
  });

  it('does not define columns for raw provider secret material', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();
    expect(sql).not.toMatch(/\b(master_key|private_key|provider_token|key_bytes|rfid_dump|encoder_secret)\s+/);
  });
});
