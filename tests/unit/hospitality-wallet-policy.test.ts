import { describe, expect, it } from 'vitest';
import { buildHospitalityIdempotencyKey, evaluateWalletEligibility } from '../../packages/hospitality/wallet-policy';

const eligibleApple = {
  pmsReady: true,
  providerReady: true,
  propertyMapped: true,
  roomMapped: true,
  stayStatus: 'checked_in' as const,
  hasRoomAssignment: true,
  withinValidityWindow: true,
  hasEquivalentActiveCredential: false,
  replacementFlow: false,
  policyEnabled: true,
  emergencyKillSwitch: false,
  policyVersion: 3,
  requestedPlatform: 'apple_wallet' as const,
  providerCapabilities: ['wallet.apple.issue', 'wallet.apple.provision'] as const,
  supportedDeliveryPath: true
};

describe('Hospitality Wallet policy', () => {
  it('blocks automatic issuance when policy is disabled', () => {
    expect(evaluateWalletEligibility({ ...eligibleApple, policyEnabled: false }).blocker)
      .toBe('automation_policy_disabled');
  });

  it('requires platform-specific provider capabilities', () => {
    expect(evaluateWalletEligibility({ ...eligibleApple, requestedPlatform: 'google_wallet' }).blocker)
      .toBe('wallet_platform_not_supported');
    expect(evaluateWalletEligibility({
      ...eligibleApple,
      requestedPlatform: 'google_wallet',
      providerCapabilities: ['wallet.google.issue', 'wallet.google.provision']
    }).eligible).toBe(true);
  });

  it('requires explicit replacement when an equivalent active credential exists', () => {
    expect(evaluateWalletEligibility({ ...eligibleApple, hasEquivalentActiveCredential: true }).blocker)
      .toBe('active_credential_exists');
    expect(evaluateWalletEligibility({ ...eligibleApple, hasEquivalentActiveCredential: true, replacementFlow: true }))
      .toMatchObject({ eligible: true, replacementRequired: true });
  });

  it('fails closed before lower-priority gates when the emergency kill switch is active', () => {
    expect(evaluateWalletEligibility({ ...eligibleApple, emergencyKillSwitch: true, pmsReady: false }).blocker)
      .toBe('emergency_kill_switch');
  });

  it('builds stable provider-event idempotency keys', () => {
    const input = { organizationId: 'org 1', propertyId: 'hotel/1', providerInstanceId: 'pms-1', sourceEventId: 'evt-42', sourceVersion: '7' };
    expect(buildHospitalityIdempotencyKey(input)).toBe('org%201:hotel%2F1:pms-1:evt-42:7');
  });
});
