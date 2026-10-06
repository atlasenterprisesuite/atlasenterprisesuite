import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const app = readFileSync('apps/web/src/App.tsx', 'utf8');
const registry = readFileSync('apps/web/src/modules/registry.ts', 'utf8');
const page = readFileSync('apps/web/src/modules/finance/pay/AtlasPayPage.tsx', 'utf8');
const core = readFileSync('packages/pay/src/index.ts', 'utf8');
const payApi = readFileSync('apps/web/src/lib/payApi.ts', 'utf8');
const accountsMigration = readFileSync('supabase/migrations/20261006190000_atlas_pay_accounts_center.sql', 'utf8');
const productionContract = JSON.parse(readFileSync('data/ops/global-production-verification.json', 'utf8')) as { public_routes: string[] };

describe('ATLAS Pay web integration', () => {
  it('exposes ATLAS Pay from Finance behind identity', () => {
    expect(app).toContain("import { AtlasPayPage } from './modules/finance/pay/AtlasPayPage'");
    expect(app).toContain('to="/finance/pay"');
    expect(app).toContain('path="/finance/pay" element={<RequireAtlasIdentity><AtlasPayPage /></RequireAtlasIdentity>}');
    expect(registry).toContain("id: 'pay'");
    expect(registry).toContain("route: '/finance/pay'");
    expect(registry).toContain("readiness: 'external-gated'");
  });

  it('never represents regulated issuing or payout rails as live by default', () => {
    expect(page).toContain('External-gated');
    expect(page).toContain('does not claim a bank charter');
    expect(page).toContain('without authenticated provider evidence');
    expect(core).toContain('UnavailableIssuingAdapter');
    expect(core).toContain('UnavailablePayoutAdapter');
    expect(core).toContain('regulatoryCoverageVerified');
  });

  it('reads provider readiness from organization-scoped Supabase evidence', () => {
    expect(payApi).toContain('authorizedAtlasFetch');
    expect(payApi).toContain('getActiveAtlasOrganization');
    expect(payApi).toContain('atlas_pay_provider_connections');
    expect(page).toContain('No regulated capability is treated as ready');
    expect(productionContract.public_routes).toContain('/finance/pay');
  });

  it('preserves Accounting as the canonical ledger', () => {
    expect(page).toContain('Accounting remains the canonical general ledger');
    expect(core).toContain('ATLAS Pay does not create a shadow ledger');
  });

  it('adds an evidence-backed Accounts Center without duplicating identity or Accounting', () => {
    expect(page).toContain('Accounts Center');
    expect(page).toContain('Balance domains');
    expect(page).toContain('Payout Hub');
    expect(page).toContain('Security & permissions');
    expect(page).toContain('source-backed evidence');
    expect(payApi).toContain('atlas_pay_accounts');
    expect(payApi).toContain('atlas_pay_balance_evidence');
    expect(accountsMigration).toContain('create table if not exists public.atlas_pay_accounts');
    expect(accountsMigration).toContain('create table if not exists public.atlas_pay_balance_evidence');
    expect(accountsMigration).toContain('revoke insert, update, delete on public.atlas_pay_accounts from authenticated');
    expect(accountsMigration).toContain('revoke insert, update, delete on public.atlas_pay_balance_evidence from authenticated');
  });
});
