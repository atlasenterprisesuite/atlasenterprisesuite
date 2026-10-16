import { describe, expect, it } from 'vitest';
import { authorizeTransfer, canTransition, type TransferIntent } from '../../packages/pay/src/banking/transferEngine';

const intent: TransferIntent = {
  orgId: 'org-1', actorId: 'user-1', sourceAccountId: 'source-account',
  destinationAccountId: 'destination-account', amountCents: 1000, currency: 'USD',
  idempotencyKey: 'unique-request-0001', ownerVerified: true,
  consentVerified: true, stepUpVerified: true, bankRailEnabled: false,
  availableCents: 1000, spotMeCents: 2000
};
describe('ATLAS Banking Core fail-closed transfer intent', () => {
  it('blocks transfers without an authorized bank rail', () => {
    expect(authorizeTransfer(intent)).toMatchObject({ allowed: false, reasons: ['bank_rail_unavailable'] });
  });
  it('does not count SpotMe as transferable funds', () => {
    const result = authorizeTransfer({ ...intent, bankRailEnabled: true, amountCents: 3000 });
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
  it('rejects cross-account ambiguity and invalid idempotency', () => {
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true, destinationAccountId: intent.sourceAccountId }).allowed).toBe(false);
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true, idempotencyKey: 'short' }).allowed).toBe(false);
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true, orgId: '' }).allowed).toBe(false);
  });
  it('rejects non-integer, non-finite, and negative available balances', () => {
    for (const amountCents of [0, 0.5, Number.NaN, Number.POSITIVE_INFINITY, Number.MAX_SAFE_INTEGER + 1]) {
      expect(authorizeTransfer({ ...intent, bankRailEnabled: true, amountCents }).allowed).toBe(false);
    }
    expect(authorizeTransfer({ ...intent, bankRailEnabled: true, availableCents: -1 }).allowed).toBe(false);
  });
  it('does not permit settled or failed transfers to be submitted again', () => {
    expect(canTransition('settled', 'submitted')).toBe(false);
    expect(canTransition('failed', 'submitted')).toBe(false);
    expect(canTransition('returned', 'settled')).toBe(false);
  });

});
