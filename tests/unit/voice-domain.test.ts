import { expect, it } from 'vitest';
import {
  canGenerateVoice,
  canTransitionVoice,
  canUseVoice,
  providerSupports
} from '../../packages/voice/src';

it('allows recording to reviewing', () => {
  expect(canTransitionVoice('recording', 'reviewing')).toBe(true);
});

it('blocks draft to ready', () => {
  expect(canTransitionVoice('draft', 'ready')).toBe(false);
});

it('blocks unsupported telephony', () => {
  expect(
    providerSupports(
      {
        localPlayback: true,
        audioExport: false,
        realtimeStream: false,
        telephony: false,
        serverSynthesis: false
      },
      'telephony'
    )
  ).toBe(false);
});

it('requires consent challenge and review before generation', () => {
  expect(
    canGenerateVoice({
      consentAccepted: true,
      challengeVerified: false,
      sampleReviewComplete: true
    })
  ).toBe(false);
  expect(
    canGenerateVoice({
      consentAccepted: true,
      challengeVerified: true,
      sampleReviewComplete: true
    })
  ).toBe(true);
});

it('does not grant another actor voice use without an explicit grant', () => {
  expect(
    canUseVoice({ ownerActorId: 'owner', actorId: 'other', grantedActorIds: [] })
  ).toBe(false);
  expect(
    canUseVoice({ ownerActorId: 'owner', actorId: 'owner', grantedActorIds: [] })
  ).toBe(true);
  expect(
    canUseVoice({
      ownerActorId: 'owner',
      actorId: 'other',
      grantedActorIds: ['other']
    })
  ).toBe(true);
});
