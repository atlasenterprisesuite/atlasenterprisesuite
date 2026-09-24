import { describe, expect, it } from 'vitest';
import {
  InMemoryVoiceRepository,
  deleteVoice,
  type VoiceProfile
} from '../../packages/voice/src';

const profile: VoiceProfile = {
  id: 'voice-1',
  ownerActorId: 'owner-1',
  tenantId: 'tenant-1',
  organizationId: 'org-1',
  name: 'Primary Voice',
  language: 'en-US',
  providerKind: 'atlas',
  status: 'ready',
  capabilities: {
    localPlayback: true,
    audioExport: true,
    realtimeStream: false,
    telephony: false,
    serverSynthesis: true
  },
  createdAt: '2026-09-06T20:00:00.000Z'
};

describe('ATLAS Voice deletion governance', () => {
  it('revokes grants, deletes samples, marks deleted, and audits owner deletion', async () => {
    const repository = new InMemoryVoiceRepository();
    await repository.saveProfile(profile);
    await repository.saveSample({
      id: 'sample-1',
      profileId: profile.id,
      sessionId: 'session-1',
      encryptedAudioRef: 'encrypted://sample-1',
      qualityStatus: 'accepted',
      createdAt: '2026-09-06T20:05:00.000Z'
    });
    await repository.replacePermissionGrants(profile.id, [
      {
        profileId: profile.id,
        granteeActorId: 'user-2',
        consumerId: 'atlas-assistant',
        grantedAt: '2026-09-06T20:10:00.000Z'
      }
    ]);

    const result = await deleteVoice({
      actorId: 'owner-1',
      actor: {
        scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
        permissions: ['voice.personal.delete']
      },
      profile,
      repository,
      occurredAt: '2026-09-06T21:45:00.000Z'
    });

    expect(result.ok).toBe(true);
    expect(result.externalProviderDeletionRequired).toBe(true);
    expect((await repository.getProfile(profile.id))?.status).toBe('deleted');
    expect(await repository.listSamplesForProfile(profile.id)).toEqual([]);
    expect(await repository.listPermissionGrants(profile.id)).toEqual([]);
    expect((await repository.listAuditEvents()).at(-1)?.result).toBe('success');
  });

  it('does not let a different actor delete the owner voice', async () => {
    const repository = new InMemoryVoiceRepository();
    await repository.saveProfile(profile);

    const result = await deleteVoice({
      actorId: 'other-user',
      actor: {
        scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
        permissions: ['voice.personal.delete']
      },
      profile,
      repository,
      occurredAt: '2026-09-06T21:45:00.000Z'
    });

    expect(result).toMatchObject({ ok: false, reason: 'not_owner' });
    expect((await repository.getProfile(profile.id))?.status).toBe('ready');
    expect((await repository.listAuditEvents()).at(-1)?.result).toBe('denied');
  });
});
