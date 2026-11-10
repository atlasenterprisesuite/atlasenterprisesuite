import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const page = readFileSync(
  'apps/web/src/modules/business/network/NetworkPublicPage.tsx',
  'utf8'
);
const core = readFileSync(
  'supabase/migrations_legacy_pre_remote_sync/20260916150000_atlas_network_core.sql',
  'utf8'
);
const governance = readFileSync(
  'supabase/migrations_legacy_pre_remote_sync/20260916150500_atlas_network_governance.sql',
  'utf8'
);
const productionContract = JSON.parse(
  readFileSync('data/ops/global-production-verification.json', 'utf8')
) as { critical_network_routes: string[] };

const routes = [
  '/business/network',
  '/business/network/pricing',
  '/business/network/commissions',
  '/business/network/payouts',
  '/business/network/compliance'
];

describe('ATLAS Network critical public routes', () => {
  it('mounts every fail-closed production Network route in the real application graph', () => {
    expect(productionContract.critical_network_routes).toEqual(routes);

    for (const route of routes) {
      expect(app).toContain(`path="${route}"`);
    }

    const wildcard = app.indexOf('<Route path="*"');
    expect(wildcard).toBeGreaterThan(-1);
    for (const route of routes) {
      expect(app.indexOf(`path="${route}"`)).toBeGreaterThan(-1);
      expect(app.indexOf(`path="${route}"`)).toBeLessThan(wildcard);
    }
  });

  it('keeps public pages descriptive while live organization data remains identity-gated', () => {
    expect(page).toContain('Evidence boundary');
    expect(page).toContain('Authentication required');
    expect(page).toContain('organization membership, RBAC and row-level security');
    expect(page).toContain('does not');
    expect(page).not.toMatch(/\$\s?\d[\d,.]*/);
    expect(page).not.toContain('Connected provider');
    expect(page).not.toContain('Paid successfully');
  });

  it('maps UI explanations to existing Network persistence and governance contracts', () => {
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
      expect(core).toContain(table);
    }

    expect(governance).toContain('Recruitment alone is not commissionable');
    expect(governance).toContain('transition_network_payout_batch');
    expect(governance).toContain('record_network_compliance_event');
    expect(governance).toContain('override_network_partner_rank');
  });
});
