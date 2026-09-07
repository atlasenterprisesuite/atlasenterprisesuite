import type { VoicePermissionGrant, VoiceProfile } from './types';

export type VoiceGenerationGate = {
  consentAccepted: boolean;
  challengeVerified: boolean;
  sampleReviewComplete: boolean;
};

export function canGenerateVoice(gate: VoiceGenerationGate) {
  return gate.consentAccepted && gate.challengeVerified && gate.sampleReviewComplete;
}

export function canUseVoice(input: {
  ownerActorId: string;
  actorId: string;
  grantedActorIds: readonly string[];
}) {
  return input.actorId === input.ownerActorId || input.grantedActorIds.includes(input.actorId);
}

export function grantsForProfile(grants: readonly VoicePermissionGrant[], profileId: string) {
  return grants.filter((grant) => grant.profileId === profileId);
}

export function actorOwnsVoice(profile: VoiceProfile, actorId: string) {
  return profile.ownerActorId === actorId;
}
