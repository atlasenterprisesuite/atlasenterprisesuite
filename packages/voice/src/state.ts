import type { VoiceProfileStatus } from './types';

const allowedTransitions: Record<VoiceProfileStatus, readonly VoiceProfileStatus[]> = {
  draft: ['sound_check', 'deleted'],
  sound_check: ['recording', 'deleted'],
  recording: ['reviewing', 'deleted'],
  reviewing: ['recording', 'ready_to_generate', 'deleted'],
  ready_to_generate: ['generating', 'recording', 'deleted'],
  generating: ['ready', 'ready_to_generate', 'deleted'],
  ready: ['suspended', 'deleted'],
  suspended: ['ready', 'deleted'],
  deleted: []
};

export function canTransitionVoice(from: VoiceProfileStatus, to: VoiceProfileStatus) {
  return allowedTransitions[from].includes(to);
}
