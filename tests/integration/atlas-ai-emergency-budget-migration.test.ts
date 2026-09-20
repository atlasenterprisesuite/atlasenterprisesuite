import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20260920160000_atlas_ai_emergency_fallback_budget.sql',
  'utf8'
);

describe('ATLAS AI emergency fallback budget migration', () => {
  it('creates a server-only reservation ledger with RLS', () => {
    expect(migration).toContain('atlas_ai_emergency_budget_reservations');
    expect(migration).toContain('enable row level security');
    expect(migration).toContain('revoke all on table public.atlas_ai_emergency_budget_reservations from public, anon, authenticated');
  });

  it('reserves budget atomically and fails closed at the configured daily limit', () => {
    expect(migration).toContain('pg_advisory_xact_lock');
    expect(migration).toContain('emergency_daily_budget_exhausted');
    expect(migration).toContain('v_authorized + p_reserve_usd > p_daily_budget_usd');
    expect(migration).toContain("p_provider <> 'openai'");
  });

  it('exposes the reservation RPC only to service_role', () => {
    expect(migration).toContain('atlas_reserve_ai_emergency_budget');
    expect(migration).toContain('from public, anon, authenticated');
    expect(migration).toContain('to service_role');
  });
});
