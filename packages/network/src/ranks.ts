export type NetworkRank = 'partner' | 'builder' | 'leader' | 'director' | 'global_ambassador';

export type NetworkComplianceStatus = 'clear' | 'review' | 'held' | 'restricted';

export type NetworkRankQualificationInput = {
  activeThirdPartyCustomers: number;
  trailingCnrMinor: number;
  retentionBps: number;
  chargebackBps: number;
  complianceStatus: NetworkComplianceStatus;
  qualifiedOrganizationDepth: number;
};

export type NetworkRankThreshold = {
  activeThirdPartyCustomers: number;
  trailingCnrMinor: number;
  retentionBps: number;
  maxChargebackBps: number;
  qualifiedOrganizationDepth: number;
};

export const ATLAS_NETWORK_LAUNCH_RANK_POLICY_V1 = {
  version: 'network-rank-v1',
  ranks: {
    partner: {
      activeThirdPartyCustomers: 0,
      trailingCnrMinor: 0,
      retentionBps: 0,
      maxChargebackBps: 10_000,
      qualifiedOrganizationDepth: 0
    },
    builder: {
      activeThirdPartyCustomers: 5,
      trailingCnrMinor: 50_000,
      retentionBps: 7_000,
      maxChargebackBps: 500,
      qualifiedOrganizationDepth: 0
    },
    leader: {
      activeThirdPartyCustomers: 20,
      trailingCnrMinor: 250_000,
      retentionBps: 7_500,
      maxChargebackBps: 400,
      qualifiedOrganizationDepth: 1
    },
    director: {
      activeThirdPartyCustomers: 75,
      trailingCnrMinor: 1_000_000,
      retentionBps: 8_000,
      maxChargebackBps: 300,
      qualifiedOrganizationDepth: 2
    },
    global_ambassador: {
      activeThirdPartyCustomers: 250,
      trailingCnrMinor: 5_000_000,
      retentionBps: 8_500,
      maxChargebackBps: 200,
      qualifiedOrganizationDepth: 3
    }
  }
} as const satisfies {
  version: string;
  ranks: Readonly<Record<NetworkRank, NetworkRankThreshold>>;
};

const RANK_ORDER: readonly NetworkRank[] = [
  'partner',
  'builder',
  'leader',
  'director',
  'global_ambassador'
];

function assertNonNegativeFinite(value: number, label: string): void {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} must be a non-negative finite number`);
  }
}

function satisfiesThreshold(
  input: NetworkRankQualificationInput,
  threshold: NetworkRankThreshold
): boolean {
  return input.activeThirdPartyCustomers >= threshold.activeThirdPartyCustomers
    && input.trailingCnrMinor >= threshold.trailingCnrMinor
    && input.retentionBps >= threshold.retentionBps
    && input.chargebackBps <= threshold.maxChargebackBps
    && input.qualifiedOrganizationDepth >= threshold.qualifiedOrganizationDepth;
}

export function qualifyPartnerRank(input: NetworkRankQualificationInput): NetworkRank {
  assertNonNegativeFinite(input.activeThirdPartyCustomers, 'activeThirdPartyCustomers');
  assertNonNegativeFinite(input.trailingCnrMinor, 'trailingCnrMinor');
  assertNonNegativeFinite(input.retentionBps, 'retentionBps');
  assertNonNegativeFinite(input.chargebackBps, 'chargebackBps');
  assertNonNegativeFinite(input.qualifiedOrganizationDepth, 'qualifiedOrganizationDepth');

  if (input.retentionBps > 10_000 || input.chargebackBps > 10_000) {
    throw new Error('retentionBps and chargebackBps must be at most 10000');
  }

  if (input.complianceStatus === 'held' || input.complianceStatus === 'restricted') {
    return 'partner';
  }

  let qualified: NetworkRank = 'partner';
  for (const rank of RANK_ORDER.slice(1)) {
    if (satisfiesThreshold(input, ATLAS_NETWORK_LAUNCH_RANK_POLICY_V1.ranks[rank])) {
      qualified = rank;
    }
  }
  return qualified;
}
