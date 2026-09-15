import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const sql = readFileSync(resolve(process.cwd(), 'supabase/migrations/20260914_hospitality_wallet_key_core.sql'), 'utf8').toLowerCase();

const tables = [
  'hospitality_pms_provider_instances',
  'hospitality_stays',
  'hospitality_room_assignments',
  'hospitality_wallet_provisioning_sessions',
  'hospitality_integration_events',
  'hospitality_automation_policies'
];

describe('Hospitality Wallet Hotel Key current schema', () => {
  it('defines PMS/stay/assignment/wallet/event/policy tables', () => {
    for (const table of tables) expect(sql).toContain(`create table if not exists public.${table}`);
  });

  it('uses canonical Hospitality properties for the recovered model', () => {
    expect(sql.match(/property_id uuid not null references public\.hospitality_properties\(id\)/g)?.length)
      .toBeGreaterThanOrEqual(5);
  });

  it('extends credential references with lifecycle metadata without raw credentials', () => {
    expect(sql).toContain('wallet_platform');
    expect(sql).toContain('wallet_state');
    expect(sql).toContain('stay_id uuid');
    expect(sql).not.toMatch(/\b(master_key|private_key|provider_token|key_bytes|encoder_secret|decrypted_token|raw_credential|ble_frame|nfc_dump)\s+/);
  });

  it('uses property membership in RLS rather than granting every org member every stay', () => {
    expect(sql).toContain('hospitality_property_memberships');
    expect(sql).toContain('hpm.user_id = auth.uid()');
    expect(sql).toContain("hpm.status = 'active'");
  });

  it('keeps integration processing idempotent', () => {
    expect(sql).toContain('unique (org_id, property_id, pms_provider_instance_id, idempotency_key)');
  });
});
