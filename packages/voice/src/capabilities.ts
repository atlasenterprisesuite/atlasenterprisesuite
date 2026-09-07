import type { VoiceProviderCapabilities } from './types';

export type VoiceProviderCapability = keyof VoiceProviderCapabilities;

export function providerSupports(
  capabilities: VoiceProviderCapabilities,
  capability: VoiceProviderCapability
) {
  return capabilities[capability] === true;
}

export const unconfiguredAtlasCapabilities: VoiceProviderCapabilities = {
  localPlayback: false,
  audioExport: false,
  realtimeStream: false,
  telephony: false,
  serverSynthesis: false
};

export const appleWebCapabilities: VoiceProviderCapabilities = {
  localPlayback: false,
  audioExport: false,
  realtimeStream: false,
  telephony: false,
  serverSynthesis: false
};
