import {
  unconfiguredAtlasCapabilities,
  type VoiceProviderCapabilities,
  type VoiceProviderKind
} from '../../../../../packages/voice/src';

export type VoiceProviderAvailability = 'available' | 'unavailable' | 'authorization_required';

export interface VoiceProviderAdapter {
  kind: VoiceProviderKind;
  capabilities: VoiceProviderCapabilities;
  availability(): Promise<VoiceProviderAvailability>;
  createVoice(input: { profileId: string; sampleIds: string[] }): Promise<{ jobId: string }>;
}

export class UnconfiguredAtlasVoiceProvider implements VoiceProviderAdapter {
  readonly kind = 'atlas' as const;
  readonly capabilities = unconfiguredAtlasCapabilities;

  async availability(): Promise<VoiceProviderAvailability> {
    return 'unavailable';
  }

  async createVoice(): Promise<{ jobId: string }> {
    throw new Error('provider_unavailable');
  }
}
