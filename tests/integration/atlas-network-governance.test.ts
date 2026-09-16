import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const migrationPath = 'supabase/migrations/20260916150500_atlas_network_governance.sql';

function readMigration() {
  return readFileSync(migrationPath, 'utf8');
}

describe('ATLAS Network governance contract', () => {
  it('registers Network permissions and guarded RPCs', () => {
    const sql = readMigration();
    for (const permission of [
      'network.view',
      'network.partner.self',
      'network.partners.manage',
      'network.pricing.view',
      'network.pricing.manage',
      'network.commissions.view',
      'network.commissions.manage_rules',
      'network.payouts.view',
      'network.payouts.approve',
      'network.compliance.view',
      'network.compliance.manage',
      'network.analytics.view',
      'network.audit.view'
    ]) {
      expect(sql).toContain(`'${permission}'`);
    }

    for (const rpc of [
      'bootstrap_network_launch_price_book',
      'create_network_partner',
      'post_network_commission_event',
      'reverse_network_commission_event',
      'override_network_partner_rank',
      'transition_network_payout_batch',
      'record_network_compliance_event'
    ]) {
      expect(sql).toMatch(new RegExp(`create or replace function public\\.${rpc}\\b`, 'i'));
    }
  });

  it('requires authentication and operation-specific permissions', () => {
    const sql = readMigration();
    expect(sql).toContain('Authentication required');
    expect(sql).toContain("has_identity_permission(organization_uuid,'network.pricing.manage')");
    expect(sql).toContain("has_identity_permission(organization_uuid,'network.commissions.manage_rules')");
    expect(sql).toContain("has_identity_permission(current_batch.org_id,'network.payouts.approve')");
    expect(sql).toContain("has_identity_permission(organization_uuid,'network.compliance.manage')");
  });

  it('makes partner enrollment free and non-commissionable', () => {
    const sql = readMigration();
    expect(sql).toContain('Recruitment alone is not commissionable');
    expect(sql).toMatch(/atlas-network-partner[\s\S]*amount_minor[\s\S]*0/i);
    expect(sql).toMatch(/atlas-network-partner[\s\S]*commissionable[\s\S]*false/i);
    expect(sql).not.toMatch(/create_network_partner[\s\S]{0,2500}insert into public\.network_commission_events/i);
  });

  it('preserves commission history through idempotent posting and reversal events', () => {
    const sql = readMigration();
    expect(sql).toMatch(/post_network_commission_event[\s\S]*on conflict[\s\S]*do nothing/i);
    expect(sql).toMatch(/reverse_network_commission_event[\s\S]*reversal_of_event_id/i);
    expect(sql).toMatch(/reverse_network_commission_event[\s\S]*reason_value/i);
    expect(sql).not.toMatch(/reverse_network_commission_event[\s\S]{0,3000}delete from public\.network_commission_events/i);
  });

  it('allows only governed payout lifecycle transitions and settlement-backed paid status', () => {
    const sql = readMigration();
    expect(sql).toContain('Paid status requires settlement evidence');
    expect(sql).toContain("'accruing','pending_review'");
    expect(sql).toContain("'pending_review','approved'");
    expect(sql).toContain("'approved','processing'");
    expect(sql).toContain("'processing','paid'");
    expect(sql).toMatch(/next_status = 'paid'[\s\S]*provider_reference_value/i);
  });

  it('requires audited reasons for rank overrides and compliance actions', () => {
    const sql = readMigration();
    expect(sql).toMatch(/override_network_partner_rank[\s\S]*reason_value/i);
    expect(sql).toMatch(/override_network_partner_rank[\s\S]*network_partner_rank_history/i);
    expect(sql).toMatch(/record_network_compliance_event[\s\S]*network_compliance_events/i);
    expect(sql).toMatch(/record_network_compliance_event[\s\S]*evidence_value jsonb/i);
  });
});
