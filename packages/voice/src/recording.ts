export type VoiceRecordingState =
  | 'unsupported'
  | 'disabled'
  | 'awaiting_consent'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'error';

export type RecordingRuntimeState =
  | 'idle'
  | 'recording'
  | 'paused'
  | 'stopped'
  | 'error';

export type RecordingEvidence = {
  captureSupported: boolean;
  enabledByPolicy: boolean;
  consentSatisfied: boolean;
  runtimeState: RecordingRuntimeState;
};

export function deriveRecordingState(
  input: RecordingEvidence
): VoiceRecordingState {
  if (!input.captureSupported) return 'unsupported';
  if (!input.enabledByPolicy) return 'disabled';
  if (!input.consentSatisfied) return 'awaiting_consent';
  if (input.runtimeState === 'recording') return 'recording';
  if (input.runtimeState === 'paused') return 'paused';
  if (input.runtimeState === 'error') return 'error';
  return 'stopped';
}
