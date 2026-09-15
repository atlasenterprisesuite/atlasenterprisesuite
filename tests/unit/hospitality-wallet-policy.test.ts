import { describe, expect, it } from 'vitest';
import {
  buildHospitalityIdempotencyKey,
  evaluateWalletEligibility
} from '../../packages/hospitality/wallet-policy';

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

describe('ATLAS Hospitality Wallet policy', () => {
  it('blocks automatic issuance when policy is disabled', () => {
    expect(evaluateWalletEligibility({ ...eligibleApple, policyEnabled: false })).toEqual({
      eligible: false,
      blocker: 'automation_policy_disabled',
      replacementRequired: false,
      deliveryReady: false
    });
  });

  it('allows issuance but reports delivery pending when no handoff exists yet', () => {
    expect(evaluateWalletEligibility({ ...eligibleApple, supportedDeliveryPath: false })).toEqual({
      eligible: true,
      blocker: null,
      replacementRequired: false,
      deliveryReady: false
    });
  });

  it('requires explicit replacement flow when an active equivalent credential exists', () => {
    expect(evaluateWalletEligibility({
      ...eligibleApple,
      hasEquivalentActiveCredential: true,
      replacementFlow: false
    }).blocker).toBe('active_credential_exists');

    expect(evaluateWalletEligibility({
      ...eligibleApple,
      hasEquivalentActiveCredential: true,
      replacementFlow: true
    })).toEqual({
      eligible: true,
      blocker: null,
      replacementRequired: true,
      deliveryReady: true
    });
  });

  it('keeps blocker evaluation in fail-closed priority order', () => {
    expect(evaluateWalletEligibility({
      ...eligibleApple,
      emergencyKillSwitch: true,
      policyEnabled: false,
      pmsReady: false
    }).blocker).toBe('emergency_kill_switch');
  });

  it('requires platform-specific provider capabilities', () => {
    expect(evaluateWalletEligibility({
      ...eligibleApple,
      requestedPlatform: 'google_wallet'
    }).blocker).toBe('wallet_platform_not_supported');

    expect(evaluateWalletEligibility({
      ...eligibleApple,
      requestedPlatform: 'google_wallet',
      providerCapabilities: ['wallet.google.issue', 'wallet.google.provision']
    }).eligible).toBe(true);
  });

  it('builds a stable PMS event idempotency key', () => {
    const input = {
      organizationId: 'org 1',
      propertyId: 'hotel/1',
      providerInstanceId: 'pms-1',
      sourceEventId: 'evt-42',
      sourceVersion: '7'
    };
    expect(buildHospitalityIdempotencyKey(input)).toBe('org%201:hotel%2F1:pms-1:evt-42:7');
    expect(buildHospitalityIdempotencyKey(input)).toBe(buildHospitalityIdempotencyKey(input));
  });

  it('rejects empty idempotency components', () => {
    expect(() => buildHospitalityIdempotencyKey({
      organizationId: ' ',
      propertyId: 'hotel-1',
      providerInstanceId: 'pms-1',
      sourceEventId: 'evt-42',
      sourceVersion: '7'
    })).toThrow('idempotency_component_required');
  });
});
