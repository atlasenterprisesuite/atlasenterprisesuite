import {
  authorize,
  createAuditEvent,
  type AuthorizationContext
} from '../../core/src';
import type { VoiceRepository } from './repository';
import type { VoiceProfile } from './types';

export type DeleteVoiceResult =
  | { ok: true; externalProviderDeletionRequired: boolean }
  | {
      ok: false;
      reason: 'scope_mismatch' | 'permission_denied' | 'not_owner';
    };

function profileScope(profile: VoiceProfile) {
  return {
    tenantId: profile.tenantId,
    organizationId: profile.organizationId
  };
}

function providerCleanupMayBeRequired(profile: VoiceProfile) {
  return (
    profile.providerKind === 'atlas' &&
    (profile.status === 'generating' ||
      profile.status === 'ready' ||
      profile.status === 'suspended')
  );
}

export async function deleteVoice(input: {
  actorId: string;
  actor: AuthorizationContext;
  profile: VoiceProfile;
  repository: VoiceRepository;
  occurredAt: string;
}): Promise<DeleteVoiceResult> {
  const scope = profileScope(input.profile);
  const authorization = authorize(input.actor, {
    scope,
    permission: 'voice.personal.delete'
  });

  if (!authorization.ok) {
    await input.repository.appendAudit(
      createAuditEvent({
        scope,
        actorId: input.actorId,
        action: 'voice.personal.delete',
        resource: `voice-profile:${input.profile.id}`,
        result: 'denied',
        occurredAt: input.occurredAt
      })
    );

    return { ok: false, reason: authorization.reason };
  }

  if (input.actorId !== input.profile.ownerActorId) {
    await input.repository.appendAudit(
      createAuditEvent({
        scope,
        actorId: input.actorId,
        action: 'voice.personal.delete',
        resource: `voice-profile:${input.profile.id}`,
        result: 'denied',
        occurredAt: input.occurredAt
      })
    );

    return { ok: false, reason: 'not_owner' };
  }

  await input.repository.replacePermissionGrants(input.profile.id, []);
  await input.repository.deleteSamplesForProfile(input.profile.id);
  await input.repository.saveProfile({
    ...input.profile,
    status: 'deleted'
  });
  await input.repository.appendAudit(
    createAuditEvent({
      scope,
      actorId: input.actorId,
      action: 'voice.personal.delete',
      resource: `voice-profile:${input.profile.id}`,
      result: 'success',
      occurredAt: input.occurredAt
    })
  );

  return {
    ok: true,
    externalProviderDeletionRequired: providerCleanupMayBeRequired(input.profile)
  };
}
