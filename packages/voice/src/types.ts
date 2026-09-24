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
  providerKind: 'atlas' | 'apple_personal_voice';
  status: VoiceProfileStatus;
  capabilities: VoiceProviderCapabilities;
  createdAt: string;
};
