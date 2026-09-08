import type { VoiceCapability, VoiceProviderCapabilities } from './types';

export const APPLE_PERSONAL_VOICE_CAPABILITIES: VoiceProviderCapabilities = {
  localPlayback: true,
  audioExport: false,
  realtimeStream: false,
  telephony: false,
  serverSynthesis: false,
};

export const UNCONFIGURED_ATLAS_VOICE_CAPABILITIES: VoiceProviderCapabilities = {
  localPlayback: false,
  audioExport: false,
  realtimeStream: false,
  telephony: false,
  serverSynthesis: false,
};

export function providerSupports(
  capabilities: VoiceProviderCapabilities,
  capability: VoiceCapability,
): boolean {
  return capabilities[capability] === true;
}
