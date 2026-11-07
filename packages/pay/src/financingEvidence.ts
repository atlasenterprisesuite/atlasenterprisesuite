/**
 * ATLAS Bank: pure, read-only financing evidence projection.
 *
 * NO bank integration, custody, ledger posting, funding execution, or account creation.
 * verifiedByServer is meaningful ONLY when assigned by an authenticated server
 * after binding the source evidence to the exact organization and financing case.
 * Never deserialize an untrusted browser/client flag as trusted evidence.
 */
export type AtlasFinancingEvidenceKind =
  | 'official_approval'
  | 'signed_agreement'
  | 'compliance_clearance'
  | 'receiving_account'
  | 'bank_settlement';

export type AtlasFinancingScope = {
  organizationId: string;
  financingReference: string;
  currency: string;
  expectedAmountMinor: bigint;
};

export type AtlasFinancingEvidence = Pick<AtlasFinancingScope, 'organizationId' | 'financingReference'> & {
  eventId: string;
  kind: AtlasFinancingEvidenceKind;
  amountMinor: bigint | null;
  currency: string;
  observedAt: string;
  sourceKind: 'reviewed_document' | 'bank_provider';
  /** Set only by a trusted server adapter after authentication and case scoping. */
  verifiedByServer: boolean;
};

export type AtlasFinancingTruth = {
  status: 'unverified' | 'under_review' | 'contracted' | 'received' | 'conflict';
  reason:
    | 'INVALID_SCOPE'
    | 'NO_VERIFIED_EVIDENCE'
    | 'INVALID_EVIDENCE'
    | 'CURRENCY_MISMATCH'
    | 'AMOUNT_MISMATCH'
    | 'INVALID_SOURCE'
    | 'CONFLICTING_EVENT_ID'
    | 'MULTIPLE_SETTLEMENTS_NOT_SUPPORTED'
    | 'MISSING_PREREQUISITES'
    | 'BANK_SETTLEMENT_WITHOUT_PREREQUISITES'
    | 'CONTRACTED_NOT_FUNDED'
    | 'BANK_SETTLEMENT_CONFIRMED';
  evidenceCount: number;
  lastVerifiedAt: string | null;
  /** Case-specific bank receipt evidence, not a deposit account balance. */
  receivedMinor: bigint | null;
  /** This projector MUST NOT infer current account liquidity. */
  accountAvailableMinor: null;
  /** Never authorize a payment or payout from an evidence projector. */
  canExecute: false;
};

const financingKinds: readonly AtlasFinancingEvidenceKind[] = [
  'official_approval',
  'signed_agreement',
  'compliance_clearance',
  'receiving_account',
  'bank_settlement'
];

function truth(
  status: AtlasFinancingTruth['status'],
  reason: AtlasFinancingTruth['reason'],
  evidenceCount = 0,
  lastVerifiedAt: string | null = null,
  receivedMinor: bigint | null = null
): AtlasFinancingTruth {
  return { status, reason, evidenceCount, lastVerifiedAt, receivedMinor, accountAvailableMinor: null, canExecute: false };
}

function isValidEvent(row: AtlasFinancingEvidence): boolean {
  return typeof row.eventId === 'string' && Boolean(row.eventId.trim())
    && financingKinds.includes(row.kind)
    && /^[A-Z]{3}$/.test(row.currency)
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(row.observedAt)
    && Number.isFinite(Date.parse(row.observedAt))
    && (row.amountMinor === null || (typeof row.amountMinor === 'bigint' && row.amountMinor > 0n));
}

function equivalent(left: AtlasFinancingEvidence, right: AtlasFinancingEvidence): boolean {
  return left.kind === right.kind
    && left.amountMinor === right.amountMinor
    && left.currency === right.currency
    && left.observedAt === right.observedAt
    && left.sourceKind === right.sourceKind;
}

/** Server-only projection. The caller MUST verify every attestation before passing it. */
export function deriveFinancingTruth(
  scope: AtlasFinancingScope,
  evidence: readonly AtlasFinancingEvidence[]
): AtlasFinancingTruth {
  if (!scope.organizationId?.trim() || !scope.financingReference?.trim()
    || !/^[A-Z]{3}$/.test(scope.currency)
    || typeof scope.expectedAmountMinor !== 'bigint' || scope.expectedAmountMinor <= 0n) {
    return truth('unverified', 'INVALID_SCOPE');
  }

  const scoped = evidence.filter((row) =>
    row.organizationId === scope.organizationId
    && row.financingReference === scope.financingReference
    && row.verifiedByServer === true
  );
  if (!scoped.length) return truth('unverified', 'NO_VERIFIED_EVIDENCE');

  const unique = new Map<string, AtlasFinancingEvidence>();
  for (const row of scoped) {
    if (!isValidEvent(row)) return truth('conflict', 'INVALID_EVIDENCE');
    const previous = unique.get(row.eventId);
    if (previous && !equivalent(previous, row)) return truth('conflict', 'CONFLICTING_EVENT_ID');
    unique.set(row.eventId, row);
  }

  const rows = [...unique.values()].sort((a, b) =>
    Date.parse(a.observedAt) - Date.parse(b.observedAt) || a.eventId.localeCompare(b.eventId)
  );
  const evidenceCount = rows.length;
  const lastVerifiedAt = rows[evidenceCount - 1].observedAt;
  for (const row of rows) {
    if (row.currency !== scope.currency) {
      return truth('conflict', 'CURRENCY_MISMATCH', evidenceCount, lastVerifiedAt);
    }
    const amountRequired = row.kind === 'official_approval'
      || row.kind === 'signed_agreement' || row.kind === 'bank_settlement';
    if ((amountRequired && row.amountMinor !== scope.expectedAmountMinor)
      || (!amountRequired && row.amountMinor !== null)) {
      return truth('conflict', 'AMOUNT_MISMATCH', evidenceCount, lastVerifiedAt);
    }
    const bankSourceRequired = row.kind === 'receiving_account' || row.kind === 'bank_settlement';
    if ((bankSourceRequired && row.sourceKind !== 'bank_provider')
      || (!bankSourceRequired && row.sourceKind !== 'reviewed_document')) {
      return truth('conflict', 'INVALID_SOURCE', evidenceCount, lastVerifiedAt);
    }
  }

  const settlements = rows.filter((row) => row.kind === 'bank_settlement');
  if (settlements.length > 1) {
    return truth('conflict', 'MULTIPLE_SETTLEMENTS_NOT_SUPPORTED', evidenceCount, lastVerifiedAt);
  }
  const required: readonly AtlasFinancingEvidenceKind[] = [
    'official_approval', 'signed_agreement', 'compliance_clearance', 'receiving_account'
  ];
  const prerequisitesComplete = required.every((kind) => rows.some((row) => row.kind === kind));
  if (!prerequisitesComplete) {
    return truth('under_review', settlements.length
      ? 'BANK_SETTLEMENT_WITHOUT_PREREQUISITES' : 'MISSING_PREREQUISITES', evidenceCount, lastVerifiedAt);
  }
  if (!settlements.length) return truth('contracted', 'CONTRACTED_NOT_FUNDED', evidenceCount, lastVerifiedAt);
  return truth('received', 'BANK_SETTLEMENT_CONFIRMED', evidenceCount, lastVerifiedAt, settlements[0].amountMinor);
}
