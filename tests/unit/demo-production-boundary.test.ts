import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const root = process.cwd();
const payables = readFileSync(`${root}/apps/web/src/modules/finance/accounting/PayablesPage.tsx`, 'utf8');
const seed = readFileSync(`${root}/data/demo/accounting/payablesSeed.ts`, 'utf8');

describe('demo versus production accounting truth boundary', () => {
  it('labels demo accounting data explicitly', () => {
    expect(seed).toContain('Demo accounting data');
    expect(seed).toContain('No bank, payment processor, or production ledger connection is active.');
    expect(payables).toContain('payablesDemoNotice');
  });

  it('describes authenticated accounting data as RLS scoped and never derives live state from demo data', () => {
    expect(payables).toContain('Live Supabase ledger · RLS protected');
    expect(payables).toContain('Demo data is shown only when there is no ATLAS session.');
    expect(payables).not.toContain('Demo data connected');
  });
});
