import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('payroll accessibility and truthful state contract',()=>{
  const routes=readFileSync('apps/web/src/modules/payroll/PayrollRoutes.tsx','utf8');
  const setup=readFileSync('apps/web/src/modules/payroll/SetupWizard.tsx','utf8');
  const css=readFileSync('apps/web/src/modules/payroll/payroll.css','utf8');

  it('provides named local navigation and explicit alert/status semantics',()=>{
    expect(routes).toContain('aria-label="Payroll"');
    expect(setup).toContain('role="alert"');
    expect(setup).toContain('role="status"');
  });

  it('keeps controls at mobile-friendly minimum height',()=>{
    expect(css).toContain('min-height: 44px');
  });

  it('never labels setup as direct-deposit enabled or fully compliant',()=>{
    const text=(routes+setup).toLowerCase();
    expect(text).not.toContain('direct deposit enabled');
    expect(text).not.toContain('fully compliant');
    expect(text).not.toContain('taxes filed');
  });
});
