import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260912_hospitality_wallet_hotel_key.sql'
);

const walletTables = [
  'hospitality_pms_provider_instances',
  'hospitality_stays',
  'hospitality_room_assignments',
  'hospitality_wallet_provisioning_sessions',
  'hospitality_integration_events',
  'hospitality_automation_policies'
];

describe('ATLAS Hospitality Wallet Hotel Key schema contract', () => {
  it('defines the six organization/property-scoped wallet-key tables', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    for (const table of walletTables) {
      expect(sql).toContain(`create table if not exists public.${table}`);
    }

    expect(sql).toContain(
      'unique (org_id, property_id, pms_provider_instance_id, idempotency_key)'
    );
  });

  it('extends credential references with constrained wallet and actor metadata', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).toContain('wallet_platform');
    expect(sql).toContain('wallet_state');
    expect(sql).toContain("issuance_actor in ('user','service')");
    expect(sql).toContain('hospitality_credential_references_actor_identity_check');
  });

  it('enables member-scoped RLS and authenticated read-only access on all new tables', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql.match(/enable row level security/g)?.length).toBe(6);
    for (const table of walletTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
      expect(sql).toContain(`revoke all on table public.${table} from authenticated`);
      expect(sql).toContain(`grant select on table public.${table} to authenticated`);
      expect(sql).toContain(`where om.org_id = ${table}.org_id`);
    }
    expect(sql.match(/from public\.organization_members om/g)?.length).toBe(6);
    expect(sql.match(/om\.user_id = \(select auth\.uid\(\)\)/g)?.length).toBe(6);
    expect(sql.match(/om\.status = 'active'/g)?.length).toBe(6);
  });

  it('does not define columns for credential, token, or provider secret material', () => {
    expect(existsSync(migrationPath)).toBe(true);
    const sql = readFileSync(migrationPath, 'utf8').toLowerCase();

    expect(sql).not.toMatch(
      /\b(master_key|private_key|provider_token|key_bytes|encoder_secret|decrypted_token)\s+/
    );
  });
});
