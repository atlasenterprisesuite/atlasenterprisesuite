export type VoiceGenerationEligibility = {
  consentAccepted: boolean;
  challengeVerified: boolean;
  sampleReviewComplete: boolean;
};

export function canGenerateVoice(input: VoiceGenerationEligibility) {
  return (
    input.consentAccepted &&
    input.challengeVerified &&
    input.sampleReviewComplete
  );
}

export type VoiceUseRequest = {
  ownerActorId: string;
  actorId: string;
  grantedActorIds: readonly string[];
};

export function canUseVoice(input: VoiceUseRequest) {
  return (
    input.ownerActorId === input.actorId ||
    input.grantedActorIds.includes(input.actorId)
  );
}
