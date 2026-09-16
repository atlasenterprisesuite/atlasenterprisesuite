import { describe, expect, it } from 'vitest';
import { ATLAS_NETWORK_LAUNCH_RANK_POLICY_V1, qualifyPartnerRank } from '../../packages/network/src';

describe('ATLAS Network rank qualification', () => {
  it('publishes a versioned launch policy with customer-sales thresholds', () => {
    expect(ATLAS_NETWORK_LAUNCH_RANK_POLICY_V1.version).toBe('network-rank-v1');
    expect(ATLAS_NETWORK_LAUNCH_RANK_POLICY_V1.ranks.builder).toMatchObject({
      activeThirdPartyCustomers: 5,
      trailingCnrMinor: 50_000,
      retentionBps: 7_000,
      maxChargebackBps: 500,
      qualifiedOrganizationDepth: 0
    });
  });

  it('does not advance a partner without third-party customers even when trailing CNR is high', () => {
    expect(qualifyPartnerRank({
      activeThirdPartyCustomers: 0,
      trailingCnrMinor: 1_000_000,
      retentionBps: 10_000,
      chargebackBps: 0,
      complianceStatus: 'clear',
      qualifiedOrganizationDepth: 3
    })).toBe('partner');
  });

  it('qualifies the highest fully satisfied rank', () => {
    expect(qualifyPartnerRank({
      activeThirdPartyCustomers: 80,
      trailingCnrMinor: 1_200_000,
      retentionBps: 8_200,
      chargebackBps: 250,
      complianceStatus: 'clear',
      qualifiedOrganizationDepth: 2
    })).toBe('director');
  });

  it('does not advance when chargeback performance breaches the target rank threshold', () => {
    expect(qualifyPartnerRank({
      activeThirdPartyCustomers: 80,
      trailingCnrMinor: 1_200_000,
      retentionBps: 8_200,
      chargebackBps: 450,
      complianceStatus: 'clear',
      qualifiedOrganizationDepth: 2
    })).toBe('builder');
  });

  it('caps held or restricted partners at partner rank', () => {
    for (const complianceStatus of ['held', 'restricted'] as const) {
      expect(qualifyPartnerRank({
        activeThirdPartyCustomers: 500,
        trailingCnrMinor: 10_000_000,
        retentionBps: 9_500,
        chargebackBps: 0,
        complianceStatus,
        qualifiedOrganizationDepth: 5
      })).toBe('partner');
    }
  });
});
