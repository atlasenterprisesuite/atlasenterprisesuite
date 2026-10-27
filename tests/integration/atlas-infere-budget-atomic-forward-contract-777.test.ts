import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * RED safety contract. These are STATIC assertions only, not PostgreSQL tests.
 * Runtime concurrency, RLS, transaction rollback and role impersonation require
 * a disposable DB with isolated roles before any migration is certified.
 */
const original = readFileSync('supabase/migrations/20260920160000_atlas_ai_emergency_fallback_budget.sql', 'utf8');

describe('ATLAS emergency budget — forward-only safety contract (RED)', () => {
  it('does not use a session-local day to acquire its budget lock', () => {
    expect(original).not.toMatch(/current_date::text/i);
  });

  it('bounds the UTC ledger period on both sides', () => {
    expect(original).toMatch(/created_at\s*>=\s*v_period_start/i);
    expect(original).toMatch(/created_at\s*<\s*v_period_end/i);
  });

  it('rejects changed actor and budget terms for a reused trace', () => {
    expect(original).toMatch(/v_existing\.actor_id\s+is distinct from\s+p_actor_id/i);
    expect(original).toMatch(/v_existing\.reserve_usd\s+is distinct from\s+p_reserve_usd/i);
    expect(original).toMatch(/v_existing\.daily_budget_usd\s+is distinct from\s+p_daily_budget_usd/i);
  });

  it('rejects inactive or cross-tenant membership in the RPC', () => {
    expect(original).toMatch(/public\.organization_members/i);
    expect(original).toMatch(/status\s*=\s*'active'/i);
  });

  it('keeps conservative server-only privileges and RLS', () => {
    expect(original).toMatch(/enable row level security/i);
    expect(original).toMatch(/grant execute on function public\.atlas_reserve_ai_emergency_budget[\s\S]*?to service_role/i);
    expect(original).toMatch(/revoke all on function[\s\S]*?from public, anon, authenticated/i);
  });
});

/*
Disposable PostgreSQL runtime fixtures, NOT covered by these static tests:
A/B parallel transactions at UTC midnight with different session timezones;
duplicate trace with changed actor/limit; revoked membership; spoofed org;
direct anon/authenticated RPC; cross-tenant SELECT/INSERT; injected exception
after reservation with zero committed ledger rows; no secret-bearing errors.
*/
