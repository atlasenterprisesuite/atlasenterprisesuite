import type { VoiceGenerationEligibility, VoiceUseContext } from './types';

export function canGenerateVoice(eligibility: VoiceGenerationEligibility): boolean {
  return eligibility.consentAccepted
    && eligibility.challengeVerified
    && eligibility.sampleReviewComplete
    && eligibility.providerConfigured;
}

export function canUseVoice(context: VoiceUseContext): boolean {
  if (context.actorId === context.ownerActorId) return true;
  return context.grantedActorIds.includes(context.actorId);
}
