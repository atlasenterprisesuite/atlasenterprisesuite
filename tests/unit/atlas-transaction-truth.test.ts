import { describe, expect, it } from 'vitest';
import {
  deriveTransactionTruth,
  type AtlasTransactionEvidence,
  type AtlasTransactionScope
} from '../../packages/pay/src';

const scope: AtlasTransactionScope = {
  organizationId: 'org-a',
  accountId: 'account-a',
  providerId: 'provider-a',
  transactionReference: 'hotel-hold-1'
};

function event(
  eventId: string,
  kind: AtlasTransactionEvidence['kind'],
  amountMinor = 10000n,
  observedAt = '2026-10-10T19:21:00Z'
): AtlasTransactionEvidence {
  return { ...scope, eventId, kind, amountMinor, currency: 'USD', observedAt, verifiedByServer: true };
}

describe('ATLAS Financial OS transaction truth (Day 1)', () => {
  it('fails closed when no verified provider event exists', () => {
    expect(deriveTransactionTruth(scope, []).status).toBe('unverified');
    expect(deriveTransactionTruth(scope, [{ ...event('auth', 'authorization'), verifiedByServer: false }]))
      .toMatchObject({ status: 'unverified', evidenceCount: 0 });
  });

  it('distinguishes a verified authorization from a posted debit', () => {
    expect(deriveTransactionTruth(scope, [event('auth', 'authorization')])).toMatchObject({
      status: 'held', evidenceCount: 1, currency: 'USD', amountMinor: 10000n
    });
    expect(deriveTransactionTruth(scope, [
      event('auth', 'authorization'),
      event('posted', 'posting', 10000n, '2026-10-11T13:00:00Z')
    ])).toMatchObject({ status: 'posted', evidenceCount: 2, amountMinor: 10000n });
  });

  it('requires a confirmed full release after authorization before showing released', () => {
    const authorization = event('auth', 'authorization');
    expect(deriveTransactionTruth(scope, [
      authorization, event('partial', 'release', 2000n, '2026-10-11T13:00:00Z')
    ])).toMatchObject({ status: 'held', reason: 'PARTIAL_RELEASE' });

    expect(deriveTransactionTruth(scope, [
      authorization, event('release', 'release', 10000n, '2026-10-11T13:00:00Z')
    ])).toMatchObject({ status: 'released', reason: 'VERIFIED_FULL_RELEASE' });
  });

  it('never treats an orphan or stale release as proof that funds were freed', () => {
    expect(deriveTransactionTruth(scope, [event('release', 'release')]))
      .toMatchObject({ status: 'unverified', reason: 'MISSING_AUTHORIZATION' });
    expect(deriveTransactionTruth(scope, [
      event('old-release', 'release', 10000n, '2026-10-09T12:00:00Z'),
      event('auth', 'authorization')
    ])).toMatchObject({ status: 'held', reason: 'VERIFIED_AUTHORIZATION' });
  });

  it('preserves posting truth even after a later release event', () => {
    expect(deriveTransactionTruth(scope, [
      event('auth', 'authorization'),
      event('post', 'posting', 10000n, '2026-10-11T13:00:00Z'),
      event('release', 'release', 10000n, '2026-10-11T14:00:00Z')
    ])).toMatchObject({ status: 'posted', reason: 'VERIFIED_POSTING' });
  });

  it('does not mix different tenants, accounts, providers or transaction references', () => {
    const other = event('other', 'posting');
    expect(deriveTransactionTruth(scope, [
      { ...other, organizationId: 'org-b' },
      { ...other, accountId: 'account-b' },
      { ...other, providerId: 'provider-b' },
      { ...other, transactionReference: 'other-reference' }
    ])).toMatchObject({ status: 'unverified', evidenceCount: 0 });
  });

  it('deduplicates provider retries without double-counting evidence', () => {
    const auth = event('same-event', 'authorization');
    expect(deriveTransactionTruth(scope, [auth, { ...auth }]))
      .toMatchObject({ status: 'held', evidenceCount: 1 });
  });

  it('fails closed on conflicting duplicates, invalid evidence or mixed currencies', () => {
    const auth = event('same-event', 'authorization');
    expect(deriveTransactionTruth(scope, [auth, { ...auth, amountMinor: 9999n }]))
      .toMatchObject({ status: 'conflict', reason: 'CONFLICTING_EVENT_ID' });
    expect(deriveTransactionTruth(scope, [{ ...auth, amountMinor: -1n }]))
      .toMatchObject({ status: 'conflict', reason: 'INVALID_EVIDENCE' });
    expect(deriveTransactionTruth(scope, [{ ...auth, observedAt: 'not-a-date' }]))
      .toMatchObject({ status: 'conflict', reason: 'INVALID_EVIDENCE' });
    expect(deriveTransactionTruth(scope, [auth, event('eur-post', 'posting'), { ...event('eur-auth', 'authorization'), currency: 'EUR' }]))
      .toMatchObject({ status: 'conflict', reason: 'MIXED_CURRENCY' });
  });
});
