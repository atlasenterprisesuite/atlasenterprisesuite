import { expect, it } from 'vitest';
import { canTransitionVoice, providerSupports } from '../../packages/voice/src';

it('allows recording to reviewing', () => {
  expect(canTransitionVoice('recording', 'reviewing')).toBe(true);
});

it('blocks draft to ready', () => {
  expect(canTransitionVoice('draft', 'ready')).toBe(false);
});

it('blocks unsupported telephony', () => {
  expect(
    providerSupports(
      {
        localPlayback: true,
        audioExport: false,
        realtimeStream: false,
        telephony: false,
        serverSynthesis: false
      },
      'telephony'
    )
  ).toBe(false);
});
