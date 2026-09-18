import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20260918114500_atlas_commerce_order_commit.sql';
const sql = existsSync(path) ? readFileSync(path, 'utf8') : '';

describe('Commerce atomic order commit SQL contract', () => {
  it('defines a locked, service-role-only order commit function', () => {
    expect(existsSync(path)).toBe(true);
    expect(sql).toContain('create or replace function public.commerce_commit_order');
    expect(sql).toContain('security definer');
    expect(sql).toContain('set search_path = public, pg_temp');
    expect(sql).toContain('for update');
    expect(sql).toContain('IDEMPOTENCY_CONFLICT');
    expect(sql).toContain('grant execute on function public.commerce_commit_order');
    expect(sql).toContain('to service_role');
  });

  it('persists all order facts before returning', () => {
    for (const target of [
      'public.commerce_orders',
      'public.commerce_order_lines',
      'public.commerce_order_payments',
      'public.commerce_order_status_history',
      'public.commerce_idempotency_keys',
      'public.commerce_outbox_events'
    ]) {
      expect(sql).toContain(target);
    }
    expect(sql).toContain('commerce.order.completed.v1');
    expect(sql).toContain('returning');
  });

  it('keeps authoritative money in bigint minor units', () => {
    expect(sql).toContain('p_total_minor bigint');
    expect(sql).toContain('p_tax_minor bigint');
    expect(sql).toContain('p_shipping_minor bigint');
  });
});
