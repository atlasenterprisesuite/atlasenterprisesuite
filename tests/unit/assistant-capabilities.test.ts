import { describe, expect, it } from 'vitest';
import {
  microphoneCapabilityFromBrowser,
  staticWebAssistantCapabilities
} from '../../apps/web/src/assistant/capabilities';

describe('assistant capability mapping', () => {
  it('marks missing microphone APIs unavailable', () => {
    expect(microphoneCapabilityFromBrowser({ hasMediaDevices: false, permissionState: 'unsupported' })).toBe('unavailable');
  });

  it('requires permission until capture permission is granted', () => {
    expect(microphoneCapabilityFromBrowser({ hasMediaDevices: true, permissionState: 'prompt' })).toBe('permission-required');
    expect(microphoneCapabilityFromBrowser({ hasMediaDevices: true, permissionState: 'denied' })).toBe('permission-required');
  });

  it('marks microphone ready only after granted permission', () => {
    expect(microphoneCapabilityFromBrowser({ hasMediaDevices: true, permissionState: 'granted' })).toBe('ready');
  });

  it('does not claim web streaming or native personal voice', () => {
    expect(staticWebAssistantCapabilities()).toEqual({
      streaming: 'unavailable',
      'native-personal-voice': 'unavailable'
    });
  });
});
