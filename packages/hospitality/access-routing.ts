import type { HospitalityAccessTransport, HospitalityStayStatus, WalletPlatform } from './types';

export type HospitalityAccessRouteBlocker =
  | 'emergency_kill_switch'
  | 'automation_policy_disabled'
  | 'provider_not_ready'
  | 'property_mapping_missing'
  | 'room_mapping_missing'
  | 'stay_not_checked_in'
  | 'room_assignment_missing'
  | 'transport_not_supported'
  | 'wallet_platform_not_supported'
  | 'platform_transport_mismatch'
  | 'active_credential_exists';

export type HospitalityAccessRouteInput = {
  providerReady: boolean;
  propertyMapped: boolean;
  roomMapped: boolean;
  stayStatus: HospitalityStayStatus;
  hasRoomAssignment: boolean;
  policyEnabled: boolean;
  emergencyKillSwitch: boolean;
  hasEquivalentActiveCredential: boolean;
  replacementFlow: boolean;
  transport: HospitalityAccessTransport;
  walletPlatform: WalletPlatform;
  supportedTransports: readonly HospitalityAccessTransport[];
  supportedPlatforms: readonly WalletPlatform[];
};

export type HospitalityAccessRouteDecision = {
  allowed: boolean;
  blocker: HospitalityAccessRouteBlocker | null;
  transport: HospitalityAccessTransport;
  walletPlatform: WalletPlatform;
  replacementRequired: boolean;
};

function expectedTransport(platform: WalletPlatform): HospitalityAccessTransport | null {
  if (platform === 'apple_wallet' || platform === 'google_wallet') return 'nfc';
  if (platform === 'provider_app') return 'ble';
  return null;
}

export function selectHospitalityAccessRoute(input: HospitalityAccessRouteInput): HospitalityAccessRouteDecision {
  const blocked = (blocker: HospitalityAccessRouteBlocker): HospitalityAccessRouteDecision => ({
    allowed: false,
    blocker,
    transport: input.transport,
    walletPlatform: input.walletPlatform,
    replacementRequired: false
  });

  if (input.emergencyKillSwitch) return blocked('emergency_kill_switch');
  if (!input.policyEnabled) return blocked('automation_policy_disabled');
  if (!input.providerReady) return blocked('provider_not_ready');
  if (!input.propertyMapped) return blocked('property_mapping_missing');
  if (!input.roomMapped) return blocked('room_mapping_missing');
  if (input.stayStatus !== 'checked_in') return blocked('stay_not_checked_in');
  if (!input.hasRoomAssignment) return blocked('room_assignment_missing');
  if (!input.supportedTransports.includes(input.transport)) return blocked('transport_not_supported');
  if (!input.supportedPlatforms.includes(input.walletPlatform)) return blocked('wallet_platform_not_supported');
  const expected = expectedTransport(input.walletPlatform);
  if (!expected || expected !== input.transport) return blocked('platform_transport_mismatch');
  if (input.hasEquivalentActiveCredential && !input.replacementFlow) return blocked('active_credential_exists');

  return {
    allowed: true,
    blocker: null,
    transport: input.transport,
    walletPlatform: input.walletPlatform,
    replacementRequired: input.hasEquivalentActiveCredential && input.replacementFlow
  };
}
