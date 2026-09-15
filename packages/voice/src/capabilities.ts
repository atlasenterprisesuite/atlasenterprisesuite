import type { VoiceProviderCapabilities } from './types';

export type VoiceProviderCapability = keyof VoiceProviderCapabilities;

export function providerSupports(
  capabilities: VoiceProviderCapabilities,
  capability: VoiceProviderCapability
) {
  return capabilities[capability] === true;
}
