import { describe, expect, it } from 'vitest';
import {
  deriveFinancingTruth,
  type AtlasFinancingEvidence,
  type AtlasFinancingEvidenceKind,
  type AtlasFinancingScope
} from '../../packages/pay/src/financingEvidence';

const scope: AtlasFinancingScope = {
  organizationId: 'tenant-atlas',
  financingReference: 'funding-case-001',
  currency: 'USD',
  expectedAmountMinor: 2_100_000_000n
};

function event(
  kind: AtlasFinancingEvidenceKind,
  overrides: Partial<AtlasFinancingEvidence> = {}
): AtlasFinancingEvidence {
  return {
    organizationId: scope.organizationId,
    financingReference: scope.financingReference,
    eventId: kind,
    kind,
    amountMinor: kind === 'official_approval' || kind === 'signed_agreement' || kind === 'bank_settlement'
      ? scope.expectedAmountMinor : null,
    currency: 'USD',
    observedAt: '2026-11-07T12:00:00Z',
    sourceKind: kind === 'receiving_account' || kind === 'bank_settlement'
      ? 'bank_provider' : 'reviewed_document',
    verifiedByServer: true,
    ...overrides
  };
}

const contractedEvidence: AtlasFinancingEvidence[] = [
  event('official_approval'),
  event('signed_agreement'),
  event('compliance_clearance'),
  event('receiving_account')
];

describe('ATLAS financing evidence projector (read-only, fail-closed)', () => {
  it('does not promote a self-declared approval into verified financing', () => {
    const result = deriveFinancingTruth(scope, [
      event('official_approval', { verifiedByServer: false })
    ]);
    expect(result.status).toBe('unverified');
    expect(result.reason).toBe('NO_VERIFIED_EVIDENCE');
    expect(result.accountAvailableMinor).toBeNull();
    expect(result.canExecute).toBe(false);
  });

  it('shows partial documentation as under review rather than funded', () => {
    const result = deriveFinancingTruth(scope, [event('official_approval')]);
    expect(result.status).toBe('under_review');
    expect(result.receivedMinor).toBeNull();
  });

  it('recognizes verified documents without inventing a received deposit', () => {
    const result = deriveFinancingTruth(scope, contractedEvidence);
    expect(result.status).toBe('contracted');
    expect(result.reason).toBe('CONTRACTED_NOT_FUNDED');
    expect(result.receivedMinor).toBeNull();
    expect(result.accountAvailableMinor).toBeNull();
  });

  it('rejects a settlement event with no validated documents or receiving account', () => {
    const result = deriveFinancingTruth(scope, [event('bank_settlement')]);
    expect(result.status).toBe('under_review');
    expect(result.reason).toBe('BANK_SETTLEMENT_WITHOUT_PREREQUISITES');
    expect(result.receivedMinor).toBeNull();
  });

  it('requires an independently authenticated bank settlement before recording receipt evidence', () => {
    const result = deriveFinancingTruth(scope, [
      ...contractedEvidence,
      event('bank_settlement', { verifiedByServer: false })
    ]);
    expect(result.status).toBe('contracted');
    expect(result.receivedMinor).toBeNull();
  });

  it('projects receipt evidence only with every prerequisite and verified bank settlement', () => {
    const result = deriveFinancingTruth(scope, [...contractedEvidence, event('bank_settlement')]);
    expect(result.status).toBe('received');
    expect(result.reason).toBe('BANK_SETTLEMENT_CONFIRMED');
    expect(result.receivedMinor).toBe(2_100_000_000n);
    expect(result.accountAvailableMinor).toBeNull();
    expect(result.canExecute).toBe(false);
    expect(result.evidenceCount).toBe(5);
  });

  it('ignores events outside the authenticated organization and financing case', () => {
    const result = deriveFinancingTruth(scope, [
      ...contractedEvidence.map((row) => ({ ...row, organizationId: 'tenant-other' })),
      event('bank_settlement', { financingReference: 'another-case' })
    ]);
    expect(result.status).toBe('unverified');
    expect(result.evidenceCount).toBe(0);
  });

  it('fails closed when a verified bank settlement has the wrong amount', () => {
    const result = deriveFinancingTruth(scope, [
      ...contractedEvidence,
      event('bank_settlement', { amountMinor: 100n })
    ]);
    expect(result.status).toBe('conflict');
    expect(result.reason).toBe('AMOUNT_MISMATCH');
    expect(result.receivedMinor).toBeNull();
  });

  it('fails closed when an account or settlement is not backed by a bank provider', () => {
    const result = deriveFinancingTruth(scope, [
      ...contractedEvidence,
      event('bank_settlement', { sourceKind: 'reviewed_document' })
    ]);
    expect(result.status).toBe('conflict');
    expect(result.reason).toBe('INVALID_SOURCE');
  });

  it('deduplicates exactly identical event IDs and rejects contradictory retries', () => {
    const same = event('official_approval');
    const result = deriveFinancingTruth(scope, [same, { ...same }]);
    expect(result.evidenceCount).toBe(1);
    expect(result.status).toBe('under_review');

    const conflict = deriveFinancingTruth(scope, [
      same,
      { ...same, observedAt: '2026-11-08T12:00:00Z' }
    ]);
    expect(conflict.status).toBe('conflict');
    expect(conflict.reason).toBe('CONFLICTING_EVENT_ID');
  });

  it('rejects mixed currency and malformed verification data', () => {
    expect(deriveFinancingTruth(scope, [
      event('official_approval', { currency: 'EUR' })
    ]).reason).toBe('CURRENCY_MISMATCH');
    expect(deriveFinancingTruth(scope, [
      event('official_approval', { observedAt: 'not-a-timestamp' })
    ]).reason).toBe('INVALID_EVIDENCE');
  });

  it('never treats multiple settlement events as multiple available balances', () => {
    const result = deriveFinancingTruth(scope, [
      ...contractedEvidence,
      event('bank_settlement'),
      event('bank_settlement', { eventId: 'second-settlement' })
    ]);
    expect(result.status).toBe('conflict');
    expect(result.reason).toBe('MULTIPLE_SETTLEMENTS_NOT_SUPPORTED');
    expect(result.accountAvailableMinor).toBeNull();
  });

  it('rejects invalid case identifiers or expected amounts', () => {
    expect(deriveFinancingTruth({ ...scope, organizationId: '' }, []).reason).toBe('INVALID_SCOPE');
    expect(deriveFinancingTruth({ ...scope, expectedAmountMinor: 0n }, []).reason).toBe('INVALID_SCOPE');
  });
});
