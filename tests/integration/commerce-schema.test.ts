import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const path = 'supabase/migrations/20260918113000_atlas_commerce_core.sql';
const sql = existsSync(path) ? readFileSync(path, 'utf8') : '';

const scopedTables = [
  'commerce_storefronts',
  'commerce_products',
  'commerce_product_variants',
  'commerce_product_media',
  'commerce_carts',
  'commerce_cart_lines',
  'commerce_checkout_sessions',
  'commerce_orders',
  'commerce_order_lines',
  'commerce_order_adjustments',
  'commerce_order_payments',
  'commerce_order_status_history',
  'commerce_idempotency_keys',
  'commerce_outbox_events',
  'commerce_integration_deliveries',
  'commerce_integration_exceptions'
] as const;

describe('ATLAS Commerce persistence contract', () => {
  it('creates the canonical Commerce schema', () => {
    expect(existsSync(path)).toBe(true);
    for (const table of scopedTables) {
      expect(sql).toContain(`public.${table}`);
    }
  });

  it('enforces the current dual-scope tenancy convention and RLS', () => {
    expect(sql).toContain('tenant_id uuid not null references public.organizations(id)');
    expect(sql).toContain('org_id uuid not null references public.organizations(id)');
    expect(sql).toContain('tenant_id = org_id');

    for (const table of scopedTables) {
      expect(sql).toContain(`alter table public.${table} enable row level security`);
    }
  });

  it('stores ATLAS asset references instead of duplicated binary media', () => {
    expect(sql).toContain('asset_source');
    expect(sql).toContain('asset_id');
    expect(sql).toContain("'library_blueprint'");
    expect(sql).toContain("'library_image'");
    expect(sql).toContain("'library_video'");
    expect(sql).toContain("'library_audio'");
    expect(sql).toContain("'creator_asset'");
    expect(sql).not.toContain('bytea');
  });

  it('makes idempotency and downstream delivery uniqueness durable', () => {
    expect(sql).toContain('commerce_idempotency_scope_key_idx');
    expect(sql).toContain('commerce_delivery_once_idx');
    expect(sql).toContain('commerce_outbox_events');
    expect(sql).toContain('commerce_integration_exceptions');
  });

  it('keeps authoritative mutation tables server-controlled', () => {
    for (const table of [
      'commerce_orders',
      'commerce_order_payments',
      'commerce_idempotency_keys',
      'commerce_outbox_events',
      'commerce_integration_deliveries',
      'commerce_integration_exceptions'
    ]) {
      expect(sql).toContain(`revoke all on public.${table} from authenticated`);
      expect(sql).toContain(`grant select on public.${table} to authenticated`);
    }
  });
});
