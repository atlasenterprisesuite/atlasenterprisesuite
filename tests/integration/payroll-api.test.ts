import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source=readFileSync('apps/web/src/lib/payrollApi.ts','utf8');

describe('payroll API organization contract',()=>{
  it('derives active organization and scopes reads/writes',()=>{
    expect(source).toContain('getActiveAtlasOrganization');
    expect(source).toContain('organization_id=');
    expect(source).toContain('tenant_id:organization.id');
    expect(source).toContain('organization_id:organization.id');
  });

  it('never accepts client-supplied payroll totals as authoritative',()=>{
    expect(source).not.toContain('grossPayCents');
    expect(source).not.toContain('netPayCents');
    expect(source).toContain("'/functions/v1/atlas-payroll-run'");
  });

  it('creates bank setup as unverified metadata only',()=>{
    expect(source).toContain("verification_status:'not_configured'");
    expect(source).toContain('account_last4');
    expect(source).not.toContain('routingNumber');
  });
});
