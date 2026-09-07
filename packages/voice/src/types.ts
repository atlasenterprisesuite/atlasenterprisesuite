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

export type VoiceConsent = {
  id: string;
  profileId: string;
  ownerActorId: string;
  version: string;
  acceptedAt: string;
  scopes: readonly ('create' | 'synthesize' | 'assistant' | 'telephony' | 'external')[];
};

export type VoiceConsumer = 'atlas_assistant' | 'atlas_connect' | 'atlas_telecom' | 'external_stream';

export type VoicePermissionGrant = {
  profileId: string;
  grantedActorId: string;
  consumer: VoiceConsumer;
  grantedAt: string;
};

export type VoiceAuditAction =
  | 'consent.accepted'
  | 'voice.created'
  | 'voice.generation.requested'
  | 'voice.permission.changed'
  | 'voice.deleted';

export type VoiceAuditMetadata = Record<string, string | number | boolean | null>;

export type VoiceAuditEvent = {
  id: string;
  profileId: string;
  actorId: string;
  action: VoiceAuditAction;
  createdAt: string;
  metadata: VoiceAuditMetadata;
};
