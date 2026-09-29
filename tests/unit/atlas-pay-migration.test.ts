import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260929123000_atlas_pay_global_accounts.sql';
const migration = existsSync(migrationPath) ? readFileSync(migrationPath, 'utf8') : '';

describe('ATLAS Pay global accounts migration', () => {
  it('defines the four canonical Pay tables', () => {
    for (const table of ['pay_capabilities', 'pay_accounts', 'pay_activity', 'pay_compliance_states']) {
      expect(migration).toContain(`create table if not exists public.${table}`);
    }
  });

  it('keeps every table organization scoped with RLS', () => {
    expect(migration.match(/org_id uuid not null references public\.organizations\(id\) on delete cascade/g)?.length).toBeGreaterThanOrEqual(4);
    for (const table of ['pay_capabilities', 'pay_accounts', 'pay_activity', 'pay_compliance_states']) {
      expect(migration).toContain(`alter table public.${table} enable row level security`);
      expect(migration).toContain(`grant select on public.${table} to authenticated`);
      expect(migration).toContain(`revoke all on public.${table} from anon`);
    }
    expect(migration).toContain("om.status = 'active'");
  });

  it('uses integer minor units and the approved readiness vocabulary', () => {
    expect(migration).toContain('available_balance_minor bigint');
    expect(migration).toContain('ledger_balance_minor bigint');
    expect(migration).toContain('amount_minor bigint');
    expect(migration).toContain('fee_minor bigint');
    for (const state of [
      'unconfigured',
      'configuration_required',
      'provider_sandbox',
      'provider_verified',
      'eligible',
      'restricted',
      'suspended',
      'unavailable'
    ]) {
      expect(migration).toContain(`'${state}'`);
    }
  });

  it('does not seed fabricated accounts or balances', () => {
    expect(migration.toLowerCase()).not.toContain('insert into public.pay_accounts');
    expect(migration.toLowerCase()).not.toContain('insert into public.pay_activity');
  });
});
