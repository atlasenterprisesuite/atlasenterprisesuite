import { describe, expect, it } from 'vitest';
import {
  canGenerateVoice,
  canTransitionVoice,
  canUseVoice,
  providerSupports,
  type VoiceProviderCapabilities,
} from '../../packages/voice/src';

const appleCapabilities: VoiceProviderCapabilities = {
  localPlayback: true,
  audioExport: false,
  realtimeStream: false,
  telephony: false,
  serverSynthesis: false,
};

describe('ATLAS Voice lifecycle and capabilities', () => {
  it('allows only explicit lifecycle transitions', () => {
    expect(canTransitionVoice('recording', 'reviewing')).toBe(true);
    expect(canTransitionVoice('draft', 'ready')).toBe(false);
  });

  it('never elevates unsupported provider capabilities', () => {
    expect(providerSupports(appleCapabilities, 'localPlayback')).toBe(true);
    expect(providerSupports(appleCapabilities, 'audioExport')).toBe(false);
    expect(providerSupports(appleCapabilities, 'telephony')).toBe(false);
    expect(providerSupports(appleCapabilities, 'serverSynthesis')).toBe(false);
  });
});

describe('ATLAS Voice consent and ownership', () => {
  it('requires explicit consent, challenge and complete sample review before generation', () => {
    expect(canGenerateVoice({
      consentAccepted: true,
      challengeVerified: false,
      sampleReviewComplete: true,
      providerConfigured: true,
    })).toBe(false);

    expect(canGenerateVoice({
      consentAccepted: true,
      challengeVerified: true,
      sampleReviewComplete: true,
      providerConfigured: false,
    })).toBe(false);

    expect(canGenerateVoice({
      consentAccepted: true,
      challengeVerified: true,
      sampleReviewComplete: true,
      providerConfigured: true,
    })).toBe(true);
  });

  it('does not grant another actor voice use without an explicit grant', () => {
    expect(canUseVoice({ ownerActorId: 'owner-a', actorId: 'owner-a', grantedActorIds: [] })).toBe(true);
    expect(canUseVoice({ ownerActorId: 'owner-a', actorId: 'other-a', grantedActorIds: [] })).toBe(false);
    expect(canUseVoice({ ownerActorId: 'owner-a', actorId: 'other-a', grantedActorIds: ['other-a'] })).toBe(true);
  });
});
