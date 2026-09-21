import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Business Launch 360 commercial pipeline', () => {
  it('exposes the exact public sales route before the protected Advisory resolver', () => {
    const app = read('apps/web/src/App.tsx');
    expect(app).toContain("location.pathname === '/advisory/business-launch-360'");
    expect(app).toContain('PublicBusinessLaunch360Page');
    expect(app).toContain("'www.atlasenterprisesuite.com'");
    expect(app).toContain('publicAdvisoryHost');
    expect(app.indexOf("location.pathname === '/advisory/business-launch-360'"))
      .toBeLessThan(app.indexOf('resolveAtlasExtension(location.pathname)'));
  });

  it('keeps the operational Launch 360 workspace protected on a distinct route', () => {
    const routes = read('apps/web/src/modules/advisory/AdvisoryRoutes.tsx');
    expect(routes).toContain('/advisory/business-launch-360/workspace');
    expect(routes).toContain('<Route path="/advisory/business-launch-360" element={<LaunchPage />} />');
    expect(routes).toContain('createReceivablesCustomer');
    expect(routes).toContain('createDraftInvoice');
    expect(routes).toContain('addInvoiceLine');
    expect(routes).toContain('issueInvoice');
    expect(routes).toContain('<LaunchCommercialPipeline onChanged={workspace.refresh} />');
  });

  it('persists intake and conversion through governed server contracts', () => {
    const sql = read('supabase/migrations/20260920223000_business_launch_360_commercial.sql');
    expect(sql).toContain('public.advisory_launch_intakes');
    expect(sql).toContain('enable row level security');
    expect(sql).toContain('advisory_set_launch_quote');
    expect(sql).toContain('advisory_accept_launch_quote');
    expect(sql).toContain('quote_tax_rate');
    expect(sql).toContain('quote_payment_terms_days');
    expect(sql).toContain('quote_acceptance_reference');
    expect(sql).toContain('advisory_convert_launch_intake');
    expect(sql).toContain('advisory_set_launch_billing_refs');
    expect(sql).toContain("status = 'quoted'");
    expect(sql).toContain("status = 'accepted'");
    expect(sql).toContain('Quote acceptance evidence required before conversion');
    expect(sql).toContain("'business-launch-360'");
  });

  it('keeps anonymous access write-only through the public edge boundary', () => {
    const fn = read('supabase/functions/atlas-advisory-public/index.ts');
    expect(fn).toContain("from('advisory_firms')");
    expect(fn).toContain("from('advisory_launch_intakes').insert");
    expect(fn).toContain("firms.length !== 1");
    expect(fn).toContain("throw new IntakeError('rate_limited', 429)");
    expect(fn).not.toContain(".select('*').from('advisory_launch_intakes')");
  });

  it('adds Launch 360 to fail-closed global production verification', () => {
    const contract = read('data/ops/global-production-verification.json');
    expect(contract).toContain('"/advisory/business-launch-360"');
    expect(contract).toContain('"default_mode": "fail-closed"');
  });
});
