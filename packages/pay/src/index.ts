export type AtlasPayEnvironment = 'sandbox' | 'production';

export type AtlasPayProviderKind =
  | 'stripe_connect'
  | 'sponsor_bank'
  | 'ach'
  | 'rtp'
  | 'fednow'
  | 'card_network';

export type AtlasPayCapability =
  | 'wallet'
  | 'card_issuing'
  | 'standard_payout'
  | 'instant_payout'
  | 'ach_transfer'
  | 'rtp_transfer'
  | 'fednow_transfer';

export type AtlasInstrumentKind =
  | 'wallet'
  | 'virtual_card'
  | 'physical_card'
  | 'business_card'
  | 'payroll_card'
  | 'vendor_card';

export type AtlasPayProviderReadiness = {
  id: string;
  displayName: string;
  kind: AtlasPayProviderKind;
  environment: AtlasPayEnvironment;
  authorized: boolean;
  credentialsConfigured: boolean;
  regulatoryCoverageVerified: boolean;
  capabilities: readonly AtlasPayCapability[];
  currencies: readonly string[];
  checkedAt: string | null;
};

export type AtlasPayEligibility =
  | {
      eligible: true;
      providerId: string;
      code: null;
    }
  | {
      eligible: false;
      providerId: null;
      code:
        | 'PROVIDER_REQUIRED'
        | 'PROVIDER_NOT_AUTHORIZED'
        | 'CREDENTIALS_REQUIRED'
        | 'REGULATORY_COVERAGE_REQUIRED'
        | 'CAPABILITY_UNAVAILABLE'
        | 'CURRENCY_UNSUPPORTED';
    };

export type AtlasIssuedInstrument = {
  id: string;
  providerId: string;
  kind: AtlasInstrumentKind;
  state: 'pending' | 'active' | 'suspended' | 'closed' | 'failed';
  currency: string;
  providerReference: string | null;
  createdAt: string;
};

export type AtlasInstrumentRequest = {
  organizationId: string;
  ownerReference: string;
  kind: AtlasInstrumentKind;
  currency: string;
  idempotencyKey: string;
};

export type AtlasPayoutRequest = {
  organizationId: string;
  ownerReference: string;
  amountMinor: bigint;
  currency: string;
  method: 'standard' | 'instant';
  destinationReference: string;
  idempotencyKey: string;
};

export type AtlasPayoutResult = {
  providerId: string;
  providerReference: string | null;
  state: 'pending' | 'paid' | 'failed' | 'unknown';
  amountMinor: bigint;
  currency: string;
  recordedAt: string;
};

export class AtlasPayError extends Error {
  readonly code: string;

  constructor(code: string) {
    super(code);
    this.name = 'AtlasPayError';
    this.code = code;
  }
}

export interface AtlasIssuingAdapter {
  issue(input: AtlasInstrumentRequest): Promise<AtlasIssuedInstrument>;
}

export interface AtlasPayoutAdapter {
  payout(input: AtlasPayoutRequest): Promise<AtlasPayoutResult>;
}

export class UnavailableIssuingAdapter implements AtlasIssuingAdapter {
  async issue(_input: AtlasInstrumentRequest): Promise<AtlasIssuedInstrument> {
    throw new AtlasPayError('ATLAS_PAY_ISSUER_UNAVAILABLE');
  }
}

export class UnavailablePayoutAdapter implements AtlasPayoutAdapter {
  async payout(_input: AtlasPayoutRequest): Promise<AtlasPayoutResult> {
    throw new AtlasPayError('ATLAS_PAY_PAYOUT_PROVIDER_UNAVAILABLE');
  }
}

export function requiredCapabilityForInstrument(
  kind: AtlasInstrumentKind
): AtlasPayCapability {
  return kind === 'wallet' ? 'wallet' : 'card_issuing';
}

function normalizedCurrency(value: string): string {
  return value.trim().toUpperCase();
}

export function providerEligibility(
  provider: AtlasPayProviderReadiness,
  capability: AtlasPayCapability,
  currency: string
): AtlasPayEligibility {
  if (!provider.authorized) {
    return { eligible: false, providerId: null, code: 'PROVIDER_NOT_AUTHORIZED' };
  }
  if (!provider.credentialsConfigured) {
    return { eligible: false, providerId: null, code: 'CREDENTIALS_REQUIRED' };
  }
  if (!provider.regulatoryCoverageVerified) {
    return { eligible: false, providerId: null, code: 'REGULATORY_COVERAGE_REQUIRED' };
  }
  if (!provider.capabilities.includes(capability)) {
    return { eligible: false, providerId: null, code: 'CAPABILITY_UNAVAILABLE' };
  }

  const currencyCode = normalizedCurrency(currency);
  if (!provider.currencies.map(normalizedCurrency).includes(currencyCode)) {
    return { eligible: false, providerId: null, code: 'CURRENCY_UNSUPPORTED' };
  }

  return { eligible: true, providerId: provider.id, code: null };
}

export function resolveInstrumentEligibility(
  providers: readonly AtlasPayProviderReadiness[],
  kind: AtlasInstrumentKind,
  currency: string
): AtlasPayEligibility {
  if (!providers.length) {
    return { eligible: false, providerId: null, code: 'PROVIDER_REQUIRED' };
  }

  const capability = requiredCapabilityForInstrument(kind);
  let lastFailure: AtlasPayEligibility = {
    eligible: false,
    providerId: null,
    code: 'PROVIDER_REQUIRED'
  };

  for (const provider of providers) {
    const result = providerEligibility(provider, capability, currency);
    if (result.eligible) return result;
    lastFailure = result;
  }

  return lastFailure;
}

export type AtlasPayoutRoute = {
  providerId: string;
  rail: 'provider_instant' | 'ach' | 'rtp' | 'fednow' | 'card_network';
  method: 'standard' | 'instant';
  available: boolean;
  verified: boolean;
  feeMinor: bigint;
  estimatedArrivalSeconds: number | null;
};

export type AtlasPayoutPreference = 'fastest' | 'lowest_fee';

export function selectPayoutRoute(
  routes: readonly AtlasPayoutRoute[],
  preference: AtlasPayoutPreference
): AtlasPayoutRoute | null {
  const eligible = routes.filter((route) => route.available && route.verified);
  if (!eligible.length) return null;

  return [...eligible].sort((left, right) => {
    if (preference === 'lowest_fee') {
      if (left.feeMinor !== right.feeMinor) {
        return left.feeMinor < right.feeMinor ? -1 : 1;
      }
      return (left.estimatedArrivalSeconds ?? Number.MAX_SAFE_INTEGER) -
        (right.estimatedArrivalSeconds ?? Number.MAX_SAFE_INTEGER);
    }

    const leftEta = left.estimatedArrivalSeconds ?? Number.MAX_SAFE_INTEGER;
    const rightEta = right.estimatedArrivalSeconds ?? Number.MAX_SAFE_INTEGER;
    if (leftEta !== rightEta) return leftEta - rightEta;
    if (left.feeMinor === right.feeMinor) return 0;
    return left.feeMinor < right.feeMinor ? -1 : 1;
  })[0];
}

export type AtlasPayoutQuote = {
  amountMinor: bigint;
  providerFeeMinor: bigint;
  atlasFeeMinor: bigint;
  netMinor: bigint;
};

export function quotePayout(
  amountMinor: bigint,
  providerFeeMinor: bigint,
  atlasFeeMinor: bigint
): AtlasPayoutQuote {
  if (amountMinor <= 0n || providerFeeMinor < 0n || atlasFeeMinor < 0n) {
    throw new AtlasPayError('ATLAS_PAY_INVALID_AMOUNT');
  }

  const netMinor = amountMinor - providerFeeMinor - atlasFeeMinor;
  if (netMinor <= 0n) {
    throw new AtlasPayError('ATLAS_PAY_FEES_EXCEED_AMOUNT');
  }

  return { amountMinor, providerFeeMinor, atlasFeeMinor, netMinor };
}

export const ATLAS_PAY_PRINCIPLES = [
  'ATLAS owns orchestration, policy, audit, reconciliation and user experience.',
  'Accounting remains the canonical general ledger; ATLAS Pay does not create a shadow ledger.',
  'External issuers, sponsor banks, processors and payment rails remain replaceable adapters.',
  'Issuance and payouts fail closed unless provider authorization, credentials, regulatory coverage and capability are verified.',
  'No UI state may claim issued, paid, settled, insured or bank-backed without authenticated evidence.'
] as const;
