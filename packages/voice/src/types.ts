export type VoiceProfileStatus =
  | 'draft'
  | 'sound_check'
  | 'recording'
  | 'reviewing'
  | 'ready_to_generate'
  | 'generating'
  | 'ready'
  | 'suspended'
  | 'deleted';

export type VoiceProviderKind = 'atlas' | 'apple_personal_voice';

export type VoiceCapability =
  | 'localPlayback'
  | 'audioExport'
  | 'realtimeStream'
  | 'telephony'
  | 'serverSynthesis';

export type VoiceProviderCapabilities = Record<VoiceCapability, boolean>;

export type VoicePermission =
  | 'voice.personal.read'
  | 'voice.personal.create'
  | 'voice.personal.record'
  | 'voice.personal.generate'
  | 'voice.personal.use'
  | 'voice.personal.delete'
  | 'voice.apple.request'
  | 'voice.apple.use'
  | 'voice.integration.manage';

export type VoiceProfile = {
  id: string;
  ownerActorId: string;
  organizationId: string;
  name: string;
  language: string;
  providerKind: VoiceProviderKind;
  status: VoiceProfileStatus;
  capabilities: VoiceProviderCapabilities;
  createdAt: string;
  updatedAt: string;
};

export type VoiceGenerationEligibility = {
  consentAccepted: boolean;
  challengeVerified: boolean;
  sampleReviewComplete: boolean;
  providerConfigured: boolean;
};

export type VoiceUseContext = {
  ownerActorId: string;
  actorId: string;
  grantedActorIds: readonly string[];
};
