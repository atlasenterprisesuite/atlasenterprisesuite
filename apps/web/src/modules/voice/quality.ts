export type MeasuredAudioStats = {
  peak: number;
  rms: number;
  silenceRatio: number;
  noiseFloor: number;
  volumeStdDev: number;
};

export type VoiceQualityReason =
  | 'clipping'
  | 'low_volume'
  | 'excessive_silence'
  | 'background_noise'
  | 'unstable_volume';

export type VoiceQualityAssessment = {
  status: 'accepted' | 'needs_retry';
  reasons: VoiceQualityReason[];
};

export const QUALITY_THRESHOLDS = {
  clippingPeak: 0.98,
  minimumRms: 0.04,
  maximumSilenceRatio: 0.45,
  maximumNoiseFloor: 0.08,
  maximumVolumeStdDev: 0.18,
} as const;

function finiteUnit(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a finite value between 0 and 1.`);
  }
  return value;
}

export function assessVoiceQuality(stats: MeasuredAudioStats): VoiceQualityAssessment {
  const peak = finiteUnit(stats.peak, 'Peak');
  const rms = finiteUnit(stats.rms, 'RMS');
  const silenceRatio = finiteUnit(stats.silenceRatio, 'Silence ratio');
  const noiseFloor = finiteUnit(stats.noiseFloor, 'Noise floor');
  const volumeStdDev = finiteUnit(stats.volumeStdDev, 'Volume standard deviation');
  const reasons: VoiceQualityReason[] = [];

  if (peak >= QUALITY_THRESHOLDS.clippingPeak) reasons.push('clipping');
  if (rms < QUALITY_THRESHOLDS.minimumRms) reasons.push('low_volume');
  if (silenceRatio > QUALITY_THRESHOLDS.maximumSilenceRatio) reasons.push('excessive_silence');
  if (noiseFloor > QUALITY_THRESHOLDS.maximumNoiseFloor) reasons.push('background_noise');
  if (volumeStdDev > QUALITY_THRESHOLDS.maximumVolumeStdDev) reasons.push('unstable_volume');

  return reasons.length === 0
    ? { status: 'accepted', reasons: [] }
    : { status: 'needs_retry', reasons };
}
