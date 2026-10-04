import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migration = readFileSync(
  'supabase/migrations/20261004143000_atlas_telephony_provider_state_clock.sql',
  'utf8'
);

describe('ATLAS telephony provider-state clock migration', () => {
  it('serializes provider lifecycle updates under a row lock', () => {
    expect(migration).toContain('create or replace function public.atlas_apply_call_provider_state');
    expect(migration).toContain('for update');
    expect(migration).toContain("v_state in ('completed','failed','canceled','blocked')");
    expect(migration).toContain('v_incoming_rank < v_current_rank');
    expect(migration).toContain('p_occurred_at > v_provider_state_at');
    expect(migration).toContain('p_occurred_at = v_provider_state_at');
    expect(migration).toContain('provider_state_event_id = p_event_id');
  });

  it('keeps the transition function server-only without privilege elevation', () => {
    expect(migration).toContain('security invoker');
    expect(migration).toContain("set search_path = ''");
    expect(migration).not.toContain('security definer');
    expect(migration).toContain('revoke all on function public.atlas_apply_call_provider_state');
    expect(migration).toContain('grant execute on function public.atlas_apply_call_provider_state');
    expect(migration).toContain('to service_role');
  });
});
