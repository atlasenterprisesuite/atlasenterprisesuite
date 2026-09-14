import { describe, expect, it } from 'vitest';
import { selectHospitalityAccessRoute } from '../../packages/hospitality/access-routing';

const base = {
  providerReady: true,
  propertyMapped: true,
  roomMapped: true,
  stayStatus: 'checked_in' as const,
  hasRoomAssignment: true,
  policyEnabled: true,
  emergencyKillSwitch: false,
  hasEquivalentActiveCredential: false,
  replacementFlow: false,
  transport: 'nfc' as const,
  walletPlatform: 'apple_wallet' as const,
  supportedTransports: ['nfc'] as const,
  supportedPlatforms: ['apple_wallet'] as const
};

describe('Hospitality access transport routing', () => {
  it('allows only a fully verified matching route', () => {
    expect(selectHospitalityAccessRoute(base)).toEqual({
      allowed: true,
      blocker: null,
      transport: 'nfc',
      walletPlatform: 'apple_wallet',
      replacementRequired: false
    });
  });

  it('rejects NFC Wallet and BLE provider-app mismatches', () => {
    expect(selectHospitalityAccessRoute({ ...base, transport: 'ble' }).blocker).toBe('transport_not_supported');
    expect(selectHospitalityAccessRoute({
      ...base,
      transport: 'nfc',
      walletPlatform: 'provider_app',
      supportedPlatforms: ['provider_app']
    }).blocker).toBe('platform_transport_mismatch');
  });

  it('fails closed on missing mapping, inactive stay, or unready provider', () => {
    expect(selectHospitalityAccessRoute({ ...base, roomMapped: false }).blocker).toBe('room_mapping_missing');
    expect(selectHospitalityAccessRoute({ ...base, stayStatus: 'reserved' }).blocker).toBe('stay_not_checked_in');
    expect(selectHospitalityAccessRoute({ ...base, providerReady: false }).blocker).toBe('provider_not_ready');
  });

  it('requires explicit replacement for an equivalent active credential', () => {
    expect(selectHospitalityAccessRoute({ ...base, hasEquivalentActiveCredential: true }).blocker)
      .toBe('active_credential_exists');
    expect(selectHospitalityAccessRoute({ ...base, hasEquivalentActiveCredential: true, replacementFlow: true }).replacementRequired)
      .toBe(true);
  });
});
