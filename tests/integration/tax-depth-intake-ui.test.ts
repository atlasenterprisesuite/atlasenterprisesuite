import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('ATLAS Tax depth intake UI contract', () => {
  const intake = readFileSync(process.cwd() + '/apps/web/src/modules/tax/DepthTaxIntake.tsx', 'utf8');
  const workspace = readFileSync(process.cwd() + '/apps/web/src/modules/tax/ProfessionalReturnWorkspace.tsx', 'utf8');
  const routes = readFileSync(process.cwd() + '/apps/web/src/modules/tax/TaxRoutes.tsx', 'utf8');

  it('supports the four depth source families', () => {
    for (const label of ['1098', '1095-A', 'SSA-1099', '1099-B']) {
      expect(intake).toContain(label);
    }
    expect(intake).toContain('map1098ToReturn');
    expect(intake).toContain('map1095AToReturn');
    expect(intake).toContain('mapSSA1099ToReturn');
    expect(intake).toContain('map1099BToReturn');
  });

  it('persists mappings into the return ledger when a returnId is present', () => {
    expect(intake).toContain("params.get('returnId')");
    expect(intake).toContain('importTaxSourceMapping');
    expect(intake).toContain('Save to return ledger');
  });

  it('links the depth intake from the persisted income-document workflow', () => {
    expect(workspace).toContain('/tax/documents/depth?returnId=');
    expect(routes).toContain('path="documents/depth"');
  });

  it('preserves all 12 Marketplace months instead of annual-only totals', () => {
    expect(intake).toContain("Array.from({ length: 12 }");
    expect(intake).toContain("Column A · Enrollment premium");
    expect(intake).toContain("Column B · SLCSP premium");
    expect(intake).toContain("Column C · APTC");
  });

  it('captures brokerage basis, term and wash-sale inputs', () => {
    expect(intake).toContain('Basis reported to IRS');
    expect(intake).toContain('Wash-sale loss disallowed');
    expect(intake).toContain('Holding period');
  });
});
