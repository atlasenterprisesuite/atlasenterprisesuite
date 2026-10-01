export type PayReadinessState =
  | 'unconfigured'
  | 'configuration_required'
  | 'provider_sandbox'
  | 'provider_verified'
  | 'eligible'
  | 'restricted'
  | 'suspended'
  | 'unavailable';

export type PayCapability = {
  id: string;
  orgId: string;
  provider: string;
  country: string;
  currency: string;
  productType: string;
  operation: string;
  readinessState: PayReadinessState;
  eligibilityState: PayReadinessState;
  complianceTier: string | null;
  limits: Record<string, unknown>;
  unavailableReason: string | null;
  verifiedAt: string | null;
};

export type PayAccount = {
  id: string;
  orgId: string;
  provider: string;
  providerAccountRef: string;
  accountType: string;
  country: string;
  currency: string;
  status: PayReadinessState;
  displayName: string;
  maskedIdentifier: string | null;
  availableBalanceMinor: number | null;
  ledgerBalanceMinor: number | null;
  balanceAsOf: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type PayActivityItem = {
  id: string;
  orgId: string;
  accountId: string | null;
  provider: string;
  providerEventRef: string | null;
  activityType: string;
  status: string;
  currency: string | null;
  amountMinor: number | null;
  feeMinor: number | null;
  description: string | null;
  occurredAt: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type PayComplianceState = {
  id: string;
  orgId: string;
  subjectType: string;
  subjectRef: string;
  provider: string;
  status: PayReadinessState;
  requirementCode: string | null;
  safeReason: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

const PAY_READINESS_STATES = new Set<PayReadinessState>([
  'unconfigured',
  'configuration_required',
  'provider_sandbox',
  'provider_verified',
  'eligible',
  'restricted',
  'suspended',
  'unavailable'
]);

export function normalizePayReadiness(value: unknown): PayReadinessState {
  return typeof value === 'string' && PAY_READINESS_STATES.has(value as PayReadinessState)
    ? value as PayReadinessState
    : 'unavailable';
}

export function isOperationalPayCapability(capability: PayCapability): boolean {
  return capability.readinessState === 'provider_verified' || capability.readinessState === 'eligible';
}

export function formatMinorAmount(amountMinor: number | null, currency: string): string | null {
  if (amountMinor === null || !Number.isSafeInteger(amountMinor)) return null;

  try {
    const formatter = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    });
    const digits = formatter.resolvedOptions().maximumFractionDigits;
    if (typeof digits !== 'number') return null;
    return formatter.format(amountMinor / (10 ** digits));
  } catch {
    return null;
  }
}

const STALE_BALANCE_MS = 24 * 60 * 60 * 1000;

export function isBalanceStale(balanceAsOf: string | null, nowMs = Date.now()): boolean {
  if (!balanceAsOf) return true;
  const timestamp = Date.parse(balanceAsOf);
  if (!Number.isFinite(timestamp)) return true;
  return nowMs - timestamp > STALE_BALANCE_MS;
}
