import type { AtlasCapabilityState } from './types';

export type BrowserMicrophonePermission = 'granted' | 'prompt' | 'denied' | 'unsupported';

export function microphoneCapabilityFromBrowser(input: {
  hasMediaDevices: boolean;
  permissionState: BrowserMicrophonePermission;
}): AtlasCapabilityState {
  if (!input.hasMediaDevices || input.permissionState === 'unsupported') return 'unavailable';
  if (input.permissionState === 'granted') return 'ready';
  return 'permission-required';
}

export function staticWebAssistantCapabilities(): Record<'streaming' | 'native-personal-voice', AtlasCapabilityState> {
  return {
    streaming: 'unavailable',
    'native-personal-voice': 'unavailable'
  };
}
