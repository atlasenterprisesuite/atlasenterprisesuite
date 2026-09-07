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

export type VoiceProviderCapabilities = {
  localPlayback: boolean;
  audioExport: boolean;
  realtimeStream: boolean;
  telephony: boolean;
  serverSynthesis: boolean;
};

export type VoiceProfile = {
  id: string;
  ownerActorId: string;
  tenantId: string;
  organizationId: string;
  name: string;
  language: string;
  providerKind: VoiceProviderKind;
  status: VoiceProfileStatus;
  capabilities: VoiceProviderCapabilities;
  createdAt: string;
};

export type VoiceSampleStatus = 'accepted' | 'needs_retry' | 'rejected' | 'missing';

export type RecordingSession = {
  id: string;
  profileId: string;
  ownerActorId: string;
  acceptedSampleIds: string[];
  challengeVerified: boolean;
  updatedAt: string;
};

export type VoiceSample = {
  id: string;
  profileId: string;
  phraseId: string;
  status: VoiceSampleStatus;
  createdAt: string;
};
