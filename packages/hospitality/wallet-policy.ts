import type {
  HospitalityCapability,
  HospitalityStayStatus,
  WalletPlatform
} from './types';

export type WalletEligibilityInput = {
  pmsReady: boolean;
  providerReady: boolean;
  propertyMapped: boolean;
  roomMapped: boolean;
  stayStatus: HospitalityStayStatus;
  hasRoomAssignment: boolean;
  withinValidityWindow: boolean;
  hasEquivalentActiveCredential: boolean;
  replacementFlow: boolean;
  policyEnabled: boolean;
  emergencyKillSwitch: boolean;
  policyVersion: number;
  requestedPlatform: WalletPlatform;
  providerCapabilities: readonly HospitalityCapability[];
  supportedDeliveryPath: boolean;
};

export type WalletEligibilityBlocker =
  | 'emergency_kill_switch'
  | 'automation_policy_disabled'
  | 'pms_not_ready'
  | 'wallet_provider_not_ready'
  | 'property_mapping_missing'
  | 'room_mapping_missing'
  | 'stay_not_checked_in'
  | 'room_assignment_missing'
  | 'validity_window_invalid'
  | 'wallet_platform_not_supported'
  | 'active_credential_exists';

export type WalletEligibilityDecision = {
  eligible: boolean;
  blocker: WalletEligibilityBlocker | null;
  replacementRequired: boolean;
  deliveryReady: boolean;
};

function supportsWalletPlatform(
  platform: WalletPlatform,
  capabilities: readonly HospitalityCapability[]
) {
  if (platform === 'apple_wallet') {
    return capabilities.includes('wallet.apple.issue') && capabilities.includes('wallet.apple.provision');
  }
  if (platform === 'google_wallet') {
    return capabilities.includes('wallet.google.issue') && capabilities.includes('wallet.google.provision');
  }
  return false;
}

export function evaluateWalletEligibility(input: WalletEligibilityInput): WalletEligibilityDecision {
  const replacementRequired = input.hasEquivalentActiveCredential && input.replacementFlow;
  const blocked = (blocker: WalletEligibilityBlocker): WalletEligibilityDecision => ({
    eligible: false,
    blocker,
    replacementRequired: false,
    deliveryReady: false
  });

  if (input.emergencyKillSwitch) return blocked('emergency_kill_switch');
  if (!input.policyEnabled) return blocked('automation_policy_disabled');
  if (!input.pmsReady) return blocked('pms_not_ready');
  if (!input.providerReady) return blocked('wallet_provider_not_ready');
  if (!input.propertyMapped) return blocked('property_mapping_missing');
  if (!input.roomMapped) return blocked('room_mapping_missing');
  if (input.stayStatus !== 'checked_in') return blocked('stay_not_checked_in');
  if (!input.hasRoomAssignment) return blocked('room_assignment_missing');
  if (!input.withinValidityWindow) return blocked('validity_window_invalid');
  if (!supportsWalletPlatform(input.requestedPlatform, input.providerCapabilities)) {
    return blocked('wallet_platform_not_supported');
  }
  if (input.hasEquivalentActiveCredential && !input.replacementFlow) {
    return blocked('active_credential_exists');
  }

  return {
    eligible: true,
    blocker: null,
    replacementRequired,
    deliveryReady: input.supportedDeliveryPath
  };
}

export function buildHospitalityIdempotencyKey(input: {
  organizationId: string;
  propertyId: string;
  providerInstanceId: string;
  sourceEventId: string;
  sourceVersion: string;
}) {
  const components = [
    input.organizationId,
    input.propertyId,
    input.providerInstanceId,
    input.sourceEventId,
    input.sourceVersion
  ];
  if (components.some((value) => value.trim().length === 0)) {
    throw new Error('idempotency_component_required');
  }
  return components.map((value) => encodeURIComponent(value.trim())).join(':');
}
