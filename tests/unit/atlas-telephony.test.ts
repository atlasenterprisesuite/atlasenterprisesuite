import { describe, expect, it } from 'vitest';
import {
  AtlasTelephonyNotReadyError,
  requireVerifiedTelephony,
  startVerifiedAtlasCall,
  type AtlasTelephonyProvider
} from '../../packages/communication/src/telephony/core';
import type {
  AtlasCallRequest,
  AtlasTelephonyProviderReadiness
} from '../../packages/communication/src/telephony/types';

const baseReadiness: AtlasTelephonyProviderReadiness = {
  provider: 'test',
  state: 'verified',
  verifiedAt: '2026-09-26T00:00:00Z',
  reason: null,
  capabilities: {
    inbound: true,
    outbound: true,
    sms: false,
    recording: false,
    realtimeAudio: true,
    transfer: false,
    emergencyCalling: false
  }
};

function makeProvider(
  readiness: AtlasTelephonyProviderReadiness
): AtlasTelephonyProvider {
  return {
    name: readiness.provider,
    readiness: async () => readiness,
    startCall: async () => ({ providerCallId: 'provider-call-1', state: 'dialing' }),
    endCall: async () => undefined
  };
}

const request: AtlasCallRequest = {
  organizationId: 'org-1',
  actorId: 'actor-1',
  direction: 'outbound',
  from: null,
  to: 'destination',
  purpose: 'Authorized ATLAS test',
  consentReference: null,
  requestedRecording: false
};

describe('ATLAS telephony fail-closed gate', () => {
  it.each(['not_configured', 'configured', 'degraded', 'blocked'] as const)(
    'blocks provider state %s',
    async (state) => {
      const readiness = { ...baseReadiness, state };
      await expect(
        requireVerifiedTelephony(makeProvider(readiness), 'outbound')
      ).rejects.toBeInstanceOf(AtlasTelephonyNotReadyError);
    }
  );

  it('allows a verified provider with the requested direction', async () => {
    await expect(
      startVerifiedAtlasCall(makeProvider(baseReadiness), request)
    ).resolves.toEqual({
      providerCallId: 'provider-call-1',
      state: 'dialing'
    });
  });

  it('blocks recording without consent evidence', async () => {
    await expect(
      startVerifiedAtlasCall(makeProvider(baseReadiness), {
        ...request,
        requestedRecording: true
      })
    ).rejects.toThrow('atlas_telephony_recording_consent_required');
  });

  it('keeps emergency capability separate from ordinary outbound service', () => {
    expect(baseReadiness.capabilities.outbound).toBe(true);
    expect(baseReadiness.capabilities.emergencyCalling).toBe(false);
  });
});
