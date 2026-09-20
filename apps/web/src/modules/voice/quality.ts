export type MeasuredAudioStats = {
  peak: number;
  rms: number;
  silenceRatio: number;
  noiseFloor: number;
  volumeStdDev: number;
};

export const QUALITY_THRESHOLDS = {
  clippingPeak: 0.98,
  minimumRms: 0.04,
  maximumSilenceRatio: 0.45,
  maximumNoiseFloor: 0.08,
  maximumVolumeStdDev: 0.18
} as const;

export type VoiceQualityReason =
  | 'clipping'
  | 'volume_too_low'
  | 'too_much_silence'
  | 'background_noise'
  | 'unstable_volume';

export type VoiceQualityAssessment = {
  status: 'accepted' | 'needs_retry';
  reasons: VoiceQualityReason[];
};

export function assessVoiceQuality(stats: MeasuredAudioStats): VoiceQualityAssessment {
  const reasons: VoiceQualityReason[] = [];
  if (stats.peak >= QUALITY_THRESHOLDS.clippingPeak) reasons.push('clipping');
  if (stats.rms < QUALITY_THRESHOLDS.minimumRms) reasons.push('volume_too_low');
  if (stats.silenceRatio > QUALITY_THRESHOLDS.maximumSilenceRatio) reasons.push('too_much_silence');
  if (stats.noiseFloor > QUALITY_THRESHOLDS.maximumNoiseFloor) reasons.push('background_noise');
  if (stats.volumeStdDev > QUALITY_THRESHOLDS.maximumVolumeStdDev) reasons.push('unstable_volume');
  return { status: reasons.length === 0 ? 'accepted' : 'needs_retry', reasons };
}
