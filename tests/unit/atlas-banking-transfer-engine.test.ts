import { describe, expect, it } from 'vitest';
import { authorizeTransfer, canTransition, type TransferIntent } from '../../packages/core/src/banking/transferEngine';

const intent: TransferIntent = {
  orgId: 'org-1', actorId: 'user-1', sourceAccountId: 'chime-8712',
  destinationAccountId: 'uber-8849', amountCents: 1849, currency: 'USD',
  idempotencyKey: 'unique-request-0001', ownerVerified: true,
  consentVerified: true, stepUpVerified: true, bankRailEnabled: false,
  availableCents: 1849, spotMeCents: 2000
};
describe('ATLAS Banking Core fail-closed transfer intent', () => {
  it('blocks transfers without an authorized bank rail', () => {
    expect(authorizeTransfer(intent)).toMatchObject({ allowed: false, reasons: ['bank_rail_unavailable'] });
  });
  it('does not count SpotMe as transferable funds', () => {
    const result = authorizeTransfer({ ...intent, bankRailEnabled: true, amountCents: 3849 });
    expect(result).toMatchObject({ allowed: false, reasons: ['insufficient_verified_funds'] });
  });
  it('blocks absent consent, MFA, or ownership', () => {
    const result = authorizeTransfer({ ...intent, bankRailEnabled: true, consentVerified: false, stepUpVerified: false, ownerVerified: false });
    expect(result.allowed).toBe(false);
  });
  it('blocks unknown balances and invalid amounts', () => {
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true, availableCents: null }).allowed).toBe(false);
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true, amountCents: -1 }).allowed).toBe(false);
  });
  it('permits only authorized intent when all gates pass', () => {
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true })).toEqual({ allowed: true, status: 'authorized' });
  });
  it('prevents jumping straight to settlement', () => {
    expect(canTransition('draft', 'settled')).toBe(false);
    expect(canTransition('submitted', 'settled')).toBe(true);
  });
});
