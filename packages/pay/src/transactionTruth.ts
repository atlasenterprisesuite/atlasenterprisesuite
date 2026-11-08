/**
 * ATLAS Transaction Truth Engine — provider-neutral, read-only projection.
 *
 * This module has no bank connectivity, storage, balance mutation or release power.
 * Callers MUST authenticate and authorize server-side and issue verifiedByServer
 * only after authenticating a provider event and its organization/account ownership.
 * Never accept client-supplied verification flags as authoritative.
 */
export type AtlasTransactionEventKind = 'authorization' | 'posting' | 'release';

export type AtlasTransactionScope = {
  organizationId: string;
  accountId: string;
  providerId: string;
  transactionReference: string;
};

export type AtlasTransactionEvidence = AtlasTransactionScope & {
  eventId: string;
  kind: AtlasTransactionEventKind;
  /** Non-negative currency minor units; positive amounts required for events. */
  amountMinor: bigint;
  currency: string;
  observedAt: string;
  /** Server-attested after authenticated provider and tenant checks, never client input. */
  verifiedByServer: boolean;
};

export type AtlasTransactionTruth = {
  status: 'unverified' | 'held' | 'posted' | 'released' | 'conflict';
  reason:
    | 'NO_VERIFIED_EVIDENCE'
    | 'INVALID_SCOPE'
    | 'INVALID_EVIDENCE'
    | 'CONFLICTING_EVENT_ID'
    | 'MIXED_CURRENCY'
    | 'MULTIPLE_AUTHORIZATIONS_NOT_SUPPORTED'
    | 'MULTIPLE_POSTINGS_NOT_SUPPORTED'
    | 'MISSING_AUTHORIZATION'
    | 'VERIFIED_AUTHORIZATION'
    | 'PARTIAL_RELEASE'
    | 'VERIFIED_FULL_RELEASE'
    | 'VERIFIED_POSTING';
  currency: string | null;
  /** The event-specific amount, NOT a current available account balance. */
  amountMinor: bigint | null;
  evidenceCount: number;
  lastVerifiedAt: string | null;
};

function truth(
  status: AtlasTransactionTruth['status'],
  reason: AtlasTransactionTruth['reason'],
  evidenceCount = 0,
  currency: string | null = null,
  amountMinor: bigint | null = null,
  lastVerifiedAt: string | null = null
): AtlasTransactionTruth {
  return { status, reason, currency, amountMinor, evidenceCount, lastVerifiedAt };
}

function isValidEvent(event: AtlasTransactionEvidence): boolean {
  return Boolean(event.eventId.trim())
    && ['authorization', 'posting', 'release'].includes(event.kind)
    && typeof event.amountMinor === 'bigint'
    && event.amountMinor > 0n
    && /^[A-Z]{3}$/.test(event.currency)
    && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(event.observedAt)
    && Number.isFinite(Date.parse(event.observedAt));
}

function sameEvidence(a: AtlasTransactionEvidence, b: AtlasTransactionEvidence): boolean {
  return a.kind === b.kind
    && a.amountMinor === b.amountMinor
    && a.currency === b.currency
    && a.observedAt === b.observedAt;
}

export function deriveTransactionTruth(
  scope: AtlasTransactionScope,
  evidence: readonly AtlasTransactionEvidence[]
): AtlasTransactionTruth {
  if (!scope.organizationId.trim() || !scope.accountId.trim()
    || !scope.providerId.trim() || !scope.transactionReference.trim()) {
    return truth('unverified', 'INVALID_SCOPE');
  }

  // A client-facing projection cannot infer another tenant's or provider's events.
  const scoped = evidence.filter((event) =>
    event.organizationId === scope.organizationId
    && event.accountId === scope.accountId
    && event.providerId === scope.providerId
    && event.transactionReference === scope.transactionReference
    && event.verifiedByServer === true
  );

  if (!scoped.length) return truth('unverified', 'NO_VERIFIED_EVIDENCE');

  const unique = new Map<string, AtlasTransactionEvidence>();
  for (const event of scoped) {
    if (!isValidEvent(event)) return truth('conflict', 'INVALID_EVIDENCE');
    const previous = unique.get(event.eventId);
    if (previous && !sameEvidence(previous, event)) {
      return truth('conflict', 'CONFLICTING_EVENT_ID');
    }
    unique.set(event.eventId, event);
  }

  const events = [...unique.values()].sort((a, b) =>
    Date.parse(a.observedAt) - Date.parse(b.observedAt)
    || a.eventId.localeCompare(b.eventId)
  );
  const count = events.length;
  const last = events[count - 1].observedAt;
  const currencies = new Set(events.map((event) => event.currency));
  if (currencies.size !== 1) return truth('conflict', 'MIXED_CURRENCY', count, null, null, last);
  const currency = events[0].currency;

  const authorizations = events.filter((event) => event.kind === 'authorization');
  const postings = events.filter((event) => event.kind === 'posting');
  const releases = events.filter((event) => event.kind === 'release');

  // V1 is intentionally limited to one authorization and one posting per
  // transaction reference. Provider adapters must split complex lifecycles
  // into unambiguous references before they can be rendered.
  if (authorizations.length > 1) {
    return truth('conflict', 'MULTIPLE_AUTHORIZATIONS_NOT_SUPPORTED', count, currency, null, last);
  }
  if (postings.length > 1) {
    return truth('conflict', 'MULTIPLE_POSTINGS_NOT_SUPPORTED', count, currency, null, last);
  }

  // A real posting remains a posted charge even if the residual authorization
  // was later released. Never equate that release with a refunded purchase.
  if (postings.length) {
    return truth('posted', 'VERIFIED_POSTING', count, currency, postings[0].amountMinor, last);
  }

  const authorization = authorizations[0];
  if (!authorization) {
    return truth('unverified', 'MISSING_AUTHORIZATION', count, currency, null, last);
  }

  const validReleases = releases.filter((release) =>
    Date.parse(release.observedAt) >= Date.parse(authorization.observedAt)
  );
  const releasedMinor = validReleases.reduce((total, release) => total + release.amountMinor, 0n);

  if (releasedMinor >= authorization.amountMinor) {
    // Confirmed release does NOT imply current account liquidity or settlement.
    return truth('released', 'VERIFIED_FULL_RELEASE', count, currency, authorization.amountMinor, last);
  }
  if (releasedMinor > 0n) {
    return truth('held', 'PARTIAL_RELEASE', count, currency, authorization.amountMinor, last);
  }
  return truth('held', 'VERIFIED_AUTHORIZATION', count, currency, authorization.amountMinor, last);
}
