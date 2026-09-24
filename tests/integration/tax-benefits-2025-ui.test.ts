import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax 2025 benefits workspace UI', () => {
  const ui = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxBenefits2025.tsx', 'utf8');
  const routes = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxRoutes.tsx', 'utf8');

  it('exposes the exact ordinary line 16 calculator', () => {
    expect(ui).toContain('calculateOrdinaryLine16Tax2025');
    expect(ui).toContain('Taxable income · Form 1040 line 15');
    expect(ui).toContain('2025 Tax Table');
    expect(ui).toContain('Tax Computation Worksheet');
  });

  it('renders official credits and deductions from one governed registry', () => {
    expect(ui).toContain('FEDERAL_BENEFITS_2025');
    expect(ui).toContain('Refundability');
    expect(ui).toContain('IRS official source');
  });

  it('keeps complex benefits fail-closed', () => {
    expect(ui).toContain('Worksheet/source-document benefits are never granted from maximum amount alone.');
  });

  it('routes the workspace inside authenticated ATLAS Tax', () => {
    expect(routes).toContain("import { TaxBenefits2025 }");
    expect(routes).toContain('path="benefits"');
    expect(routes).toContain('/tax/benefits');
  });
});
