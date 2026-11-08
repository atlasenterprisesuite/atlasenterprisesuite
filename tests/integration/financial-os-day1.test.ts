import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pay = readFileSync('packages/pay/src/index.ts', 'utf8');
const projector = readFileSync('packages/pay/src/transactionTruth.ts', 'utf8');
const workspace = readFileSync('apps/web/src/modules/finance/pay/AtlasPayPage.tsx', 'utf8');
const publicPay = readFileSync('apps/web/src/modules/finance/pay/PublicAtlasPayPage.tsx', 'utf8');

describe('Financial OS Day 1 integration boundary', () => {
  it('reuses the canonical Pay package and workspace rather than creating another product shell', () => {
    expect(pay).toContain("from './transactionTruth'");
    expect(workspace).toContain('Transaction Truth Engine');
    expect(workspace).toContain('Provider-gated: no server-attested transaction event feed');
  });
  it('requires a trusted server provider event to declare an observed transaction state', () => {
    expect(projector).toContain('verifiedByServer === true');
    expect(projector).toContain('event.organizationId === scope.organizationId');
    expect(projector).toContain('event.providerId === scope.providerId');
    expect(projector).toContain('event.accountId === scope.accountId');
    expect(projector).toContain("truth('conflict', 'CONFLICTING_EVENT_ID')");
  });
  it('does not expose private transactions on the public ATLAS Pay landing page', () => {
    expect(publicPay).not.toContain('deriveTransactionTruth');
    expect(publicPay).not.toContain('loadAtlasPaySnapshot');
    expect(workspace).toContain('This read-only foundation cannot release bank holds or infer available funds.');
  });
});
