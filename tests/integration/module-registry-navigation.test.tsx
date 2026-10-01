import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(`${process.cwd()}/apps/web/src/components/AtlasShell.tsx`, 'utf8');

describe('ATLAS shell module-registry navigation contract', () => {
  it('consumes canonical registry navigation instead of a local hardcoded module list', () => {
    expect(source).toContain("from '../modules/registry'");
    expect(source).toContain('ATLAS_NAV_ITEMS');
    expect(source).not.toContain('const navItems = [');
  });

  it('keeps Accounting child workspaces out of the global shell navigation', () => {
    const registry = readFileSync(`${process.cwd()}/apps/web/src/modules/registry.ts`, 'utf8');
    expect(registry).not.toContain("{ to: '/finance/accounting/accounts-payable', label: 'Payables' }");
    expect(registry).not.toContain("{ to: '/finance/accounting/accounts-receivable', label: 'Receivables' }");
    expect(registry).not.toContain("{ to: '/finance/accounting/reports/automotive-sales', label: 'Automotive' }");
  });
});
