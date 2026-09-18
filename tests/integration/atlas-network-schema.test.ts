import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260916150000_atlas_network_core.sql';

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('ATLAS Network core schema contract', () => {
  it('creates every approved organization-scoped Network table', () => {
    const sql = readMigration();
    for (const table of [
      'network_partners',
      'network_referral_links',
      'network_attributions',
      'network_price_books',
      'network_product_prices',
      'network_commission_rules',
      'network_commission_events',
      'network_payout_batches',
      'network_partner_rank_history',
      'network_compliance_events'
    ]) {
      expect(sql).toMatch(new RegExp(`create table if not exists public\\.${table}\\b`, 'i'));
      expect(sql).toMatch(new RegExp(`alter table public\\.${table} enable row level security`, 'i'));
    }
  });

  it('uses tenant-scoped foreign keys and hard financial constraints', () => {
    const sql = readMigration();
    expect(sql).toMatch(/org_id uuid not null references public\.organizations\(id\)/i);
    expect(sql).toContain('check (pool_cap_bps between 0 and 2000)');
    expect(sql).toContain('check (margin_cap_bps between 0 and 3500)');
    expect(sql).toContain("check (currency ~ '^[A-Z]{3}$')");
    expect(sql).toMatch(/amount_minor bigint not null/i);
    expect(sql).toMatch(/base_usd_amount_minor bigint not null/i);
  });

  it('protects partner and administrative data with organization-aware RLS', () => {
    const sql = readMigration();
    expect(sql).toContain('create policy network_partners_read');
    expect(sql).toContain('public.is_org_member(org_id)');
    expect(sql).toContain("public.has_identity_permission(org_id,'network.partners.manage')");
    expect(sql).toContain("public.has_identity_permission(org_id,'network.pricing.manage')");
    expect(sql).toContain("public.has_identity_permission(org_id,'network.commissions.manage_rules')");
    expect(sql).toContain("public.has_identity_permission(org_id,'network.payouts.approve')");
    expect(sql).toContain("public.has_identity_permission(org_id,'network.compliance.manage')");
  });

  it('audits privileged financial and compliance tables', () => {
    const sql = readMigration();
    for (const table of [
      'network_price_books',
      'network_product_prices',
      'network_commission_rules',
      'network_commission_events',
      'network_payout_batches',
      'network_partner_rank_history',
      'network_compliance_events'
    ]) {
      expect(sql).toMatch(new RegExp(`create trigger ${table}_audit[\\s\\S]*on public\\.${table}[\\s\\S]*public\\.audit_row_change\\(\\)`, 'i'));
    }
  });

  it('keeps historical commercial evidence versioned instead of mutable by implication', () => {
    const sql = readMigration();
    expect(sql).toMatch(/network_price_books[\s\S]*version integer not null/i);
    expect(sql).toMatch(/network_commission_rules[\s\S]*version integer not null/i);
    expect(sql).toMatch(/network_attributions[\s\S]*policy_version text not null/i);
    expect(sql).toMatch(/network_product_prices[\s\S]*fx_rate numeric\(20,10\)/i);
    expect(sql).toMatch(/network_product_prices[\s\S]*fx_source text/i);
    expect(sql).toMatch(/network_product_prices[\s\S]*fx_captured_at timestamptz/i);
  });
});
