import type { VoiceProfileStatus } from './types';

const transitions: Readonly<Record<VoiceProfileStatus, readonly VoiceProfileStatus[]>> = {
  draft: ['sound_check', 'deleted'],
  sound_check: ['recording', 'draft', 'deleted'],
  recording: ['reviewing', 'sound_check', 'deleted'],
  reviewing: ['recording', 'ready_to_generate', 'deleted'],
  ready_to_generate: ['generating', 'recording', 'deleted'],
  generating: ['ready', 'ready_to_generate', 'suspended'],
  ready: ['suspended', 'deleted'],
  suspended: ['ready', 'deleted'],
  deleted: [],
};

export function canTransitionVoice(from: VoiceProfileStatus, to: VoiceProfileStatus): boolean {
  return transitions[from].includes(to);
}
