import { describe, expect, it } from 'vitest';
import {
  canGenerateVoice,
  canTransitionVoice,
  canUseVoice,
  deleteVoice,
  InMemoryVoiceRepository,
  providerSupports,
  type VoiceProfile
} from '../../packages/voice/src';

const baseProfile: VoiceProfile = {
  id: 'vp-1',
  ownerActorId: 'owner',
  tenantId: 'tenant-demo',
  organizationId: 'org-demo',
  name: 'Owner voice',
  language: 'en-US',
  providerKind: 'atlas',
  status: 'reviewing',
  capabilities: {
    localPlayback: false,
    audioExport: false,
    realtimeStream: false,
    telephony: false,
    serverSynthesis: false
  },
  createdAt: '2026-09-06T00:00:00.000Z'
};

describe('ATLAS Voice domain', () => {
  it('allows recording to reviewing', () => {
    expect(canTransitionVoice('recording', 'reviewing')).toBe(true);
  });

  it('blocks draft to ready', () => {
    expect(canTransitionVoice('draft', 'ready')).toBe(false);
  });

  it('blocks unsupported telephony', () => {
    expect(providerSupports({
      localPlayback: true,
      audioExport: false,
      realtimeStream: false,
      telephony: false,
      serverSynthesis: false
    }, 'telephony')).toBe(false);
  });

  it('requires consent and challenge before generation', () => {
    expect(canGenerateVoice({ consentAccepted: true, challengeVerified: false, sampleReviewComplete: true })).toBe(false);
    expect(canGenerateVoice({ consentAccepted: true, challengeVerified: true, sampleReviewComplete: true })).toBe(true);
  });

  it('does not grant use to another actor without a grant', () => {
    expect(canUseVoice({ ownerActorId: 'owner', actorId: 'other', grantedActorIds: [] })).toBe(false);
    expect(canUseVoice({ ownerActorId: 'owner', actorId: 'owner', grantedActorIds: [] })).toBe(true);
  });

  it('deletes samples, revokes grants, and leaves metadata-only audit', async () => {
    const repository = new InMemoryVoiceRepository();
    await repository.saveProfile(baseProfile);
    await repository.saveSample({ id: 'sample-1', profileId: baseProfile.id, phraseId: 'p1', status: 'accepted', createdAt: baseProfile.createdAt });
    await repository.replacePermissionGrants(baseProfile.id, [{
      profileId: baseProfile.id,
      grantedActorId: 'other',
      consumer: 'atlas_assistant',
      grantedAt: baseProfile.createdAt
    }]);

    await deleteVoice(repository, baseProfile.id, 'owner', '2026-09-06T01:00:00.000Z');

    expect((await repository.getProfile(baseProfile.id))?.status).toBe('deleted');
    expect(repository.samples.size).toBe(0);
    expect(repository.grants.get(baseProfile.id)).toEqual([]);
    expect(repository.audit[0].metadata).toEqual({ providerKind: 'atlas' });
    expect(JSON.stringify(repository.audit[0])).not.toContain('sample-1');
  });
});
