import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const routes=readFileSync('apps/web/src/modules/payroll/PayrollRoutes.tsx','utf8');

describe('payroll route contract',()=>{
  it('mounts operational canonical routes and compatibility redirects',()=>{
    for(const route of ['setup/:step','people','contractors','time','pto','runs','taxes','deductions','benefits','reports','settings','settings/permissions','settings/billing','help']){
      expect(routes).toContain('path="'+route+'"');
    }
    expect(routes).toContain('Navigate to="/payroll/time"');
    expect(routes).toContain('Navigate to="/payroll/runs"');
  });

  it('keeps filing and money movement as external gates',()=>{
    expect(routes).toContain('Filing and remittance require separately authenticated external rails');
    expect(routes).toContain('does not imply insurance issuance');
  });
});
