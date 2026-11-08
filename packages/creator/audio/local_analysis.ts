/**
 * ATLAS Audio DNA Local v1 — signal estimates, not a professional key/BPM oracle.
 * Pure deterministic DSP; no network, analytics, copyrighted reference library or storage.
 */
export type LocalAudioDNA = {
  method: 'local-signal-estimate-v1';
  durationAnalyzedSeconds: number;
  energyPercent: number;
  peakDbfs: number | null;
  rmsDbfs: number | null;
  bpm: number | null;
  bpmConfidence: number | null;
  camelot: string | null;
  keyConfidence: number | null;
  onsetCount: number;
  /** Sixty-four relative RMS envelope bars from analyzed PCM (not a full-track waveform). */
  waveform: number[];
};

const TARGET_RATE = 11025;
const MAX_SECONDS = 90;
const KEY_MAJOR = ['8B','3B','10B','5B','12B','7B','2B','9B','4B','11B','6B','1B'] as const;
const KEY_MINOR = ['5A','12A','7A','2A','9A','4A','11A','6A','1A','8A','3A','10A'] as const;
const MAJOR_PROFILE = [6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
const MINOR_PROFILE = [6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];

function clamp(value: number, low: number, high: number) {
  return Math.min(high, Math.max(low, value));
}

export function selectLocalAnalysisSamples(buffer: AudioBuffer): { samples: Float32Array; sampleRate: number } {
  if (!Number.isFinite(buffer.sampleRate) || buffer.sampleRate < 8000 || !buffer.length || !buffer.numberOfChannels) {
    throw new Error('audio_dna_invalid_buffer');
  }
  const stride = Math.max(1, Math.floor(buffer.sampleRate / TARGET_RATE));
  const limit = Math.min(buffer.length, Math.floor(buffer.sampleRate * MAX_SECONDS));
  const samples = new Float32Array(Math.ceil(limit / stride));
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index));
  for (let i = 0, start = 0; start < limit; i += 1, start += stride) {
    let total = 0, count = 0;
    for (let offset = start; offset < Math.min(limit, start + stride); offset += 1) {
      for (const channel of channels) {
        total += channel[offset];
        count += 1;
      }
    }
    samples[i] = total / count;
  }
  return { samples, sampleRate: buffer.sampleRate / stride };
}

/**
 * Compute a bounded, truthful relative amplitude overview of the analyzed window.
 * A zero-amplitude input yields only zeros, never decorative bars.
 */
export function buildLocalWaveform(samples: Float32Array, bars = 64): number[] {
  if (!(samples instanceof Float32Array) || !samples.length || !Number.isInteger(bars) || bars < 8 || bars > 128) {
    throw new Error('audio_dna_invalid_waveform');
  }
  const values = new Array<number>(bars).fill(0);
  for (let i = 0; i < samples.length; i += 1) {
    const sample = samples[i];
    if (!Number.isFinite(sample)) throw new Error('audio_dna_non_finite_sample');
    const index = Math.min(bars - 1, Math.floor(i * bars / samples.length));
    values[index] += sample * sample;
  }
  let maximum = 0;
  for (let i = 0; i < bars; i += 1) {
    const begin = Math.ceil(i * samples.length / bars);
    const end = Math.ceil((i + 1) * samples.length / bars);
    // Each bin contains a bounded window; never divide by zero for short PCM.
    const samplesInBin = Math.max(1, end - begin);
    values[i] = Math.sqrt(values[i] / samplesInBin);
    maximum = Math.max(maximum, values[i]);
  }
  return maximum > 0 ? values.map(value => Math.round(value / maximum * 100) / 100) : values;
}

function estimatedTempo(samples: Float32Array, rate: number): { bpm: number | null; confidence: number | null; onsets: number } {
  const hop = Math.max(1, Math.round(rate * 0.023));
  const count = Math.floor(samples.length / hop);
  if (count < 160) return { bpm: null, confidence: null, onsets: 0 };
  const loudness = new Float64Array(count);
  for (let frame = 0; frame < count; frame += 1) {
    let squared = 0;
    const offset = frame * hop;
    for (let i = offset; i < offset + hop; i += 1) squared += samples[i] * samples[i];
    loudness[frame] = Math.sqrt(squared / hop);
  }
  const change = new Float64Array(count);
  let total = 0;
  for (let i = 1; i < count; i += 1) {
    change[i] = Math.max(0, loudness[i] - loudness[i - 1]);
    total += change[i];
  }
  const mean = total / count;
  let variance = 0, max = 0;
  for (const value of change) {
    variance += (value - mean) ** 2;
    max = Math.max(max, value);
  }
  const deviation = Math.sqrt(variance / count);
  const threshold = Math.max(mean + deviation * 1.3, max * 0.09);
  const novelty = new Float64Array(count);
  let onsetCount = 0, lastPeak = -Infinity;
  const minSpacing = Math.round(rate / hop * 0.11);
  for (let i = 2; i < count - 1; i += 1) {
    if (change[i] > threshold && change[i] >= change[i - 1] && change[i] > change[i + 1] && i - lastPeak >= minSpacing) {
      novelty[i] = change[i];
      lastPeak = i;
      onsetCount += 1;
    }
  }
  if (onsetCount < 6) return { bpm: null, confidence: null, onsets: onsetCount };
  let denominator = 0;
  for (const n of novelty) denominator += n * n;
  if (denominator <= 1e-12) return { bpm: null, confidence: null, onsets: onsetCount };

  function correlation(lag: number): number {
    const floor = Math.floor(lag), portion = lag - floor;
    let result = 0;
    for (let i = floor + 1; i < count; i += 1) {
      const past = novelty[i - floor] * (1 - portion) + novelty[i - floor - 1] * portion;
      result += novelty[i] * past;
    }
    return result / denominator;
  }
  let winner = 0, strength = 0;
  for (let bpm = 75; bpm <= 175; bpm += 1) {
    const lag = (60 * rate) / (hop * bpm);
    const score = correlation(lag) + correlation(lag * 2) * 0.25;
    if (score > strength) {
      strength = score;
      winner = bpm;
    }
  }
  const confidence = Math.round(clamp(strength / 1.25 * 100, 0, 100));
  return strength >= 0.19
    ? { bpm: winner, confidence, onsets: onsetCount }
    : { bpm: null, confidence: null, onsets: onsetCount };
}

/** In-place radix-2 FFT for short, non-streaming PCM windows. */
function fft(re: Float64Array, im: Float64Array) {
  const size = re.length;
  for (let i = 1, j = 0; i < size; i += 1) {
    let bit = size >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= size; len *= 2) {
    const angle = -2 * Math.PI / len;
    const wr = Math.cos(angle), wi = Math.sin(angle);
    for (let start = 0; start < size; start += len) {
      let xr = 1, xi = 0;
      for (let k = 0; k < len / 2; k += 1) {
        const i = start + k, j = i + len / 2;
        const tr = re[j] * xr - im[j] * xi;
        const ti = re[j] * xi + im[j] * xr;
        re[j] = re[i] - tr;
        im[j] = im[i] - ti;
        re[i] += tr;
        im[i] += ti;
        [xr, xi] = [xr * wr - xi * wi, xr * wi + xi * wr];
      }
    }
  }
}

function pearson(values: readonly number[], profile: readonly number[], root: number): number {
  const leftMean = values.reduce((sum, value) => sum + value, 0) / 12;
  const rightMean = profile.reduce((sum, value) => sum + value, 0) / 12;
  let dot = 0, xx = 0, yy = 0;
  for (let i = 0; i < 12; i += 1) {
    const x = values[i] - leftMean, y = profile[(i - root + 12) % 12] - rightMean;
    dot += x * y;
    xx += x * x;
    yy += y * y;
  }
  return xx > 0 && yy > 0 ? dot / Math.sqrt(xx * yy) : 0;
}

/** Input represents aggregate chroma energies; returns no label when evidence is weak. */
export function estimateCamelotFromChroma(chroma: readonly number[]): { camelot: string | null; confidence: number | null } {
  if (chroma.length !== 12 || chroma.some(value => !Number.isFinite(value) || value < 0)) {
    return { camelot: null, confidence: null };
  }
  const total = chroma.reduce((sum, n) => sum + n, 0);
  if (total <= 0) return { camelot: null, confidence: null };
  const scores: { key: string; score: number }[] = [];
  for (let tonic = 0; tonic < 12; tonic += 1) {
    scores.push({ key: KEY_MAJOR[tonic], score: pearson(chroma, MAJOR_PROFILE, tonic) });
    scores.push({ key: KEY_MINOR[tonic], score: pearson(chroma, MINOR_PROFILE, tonic) });
  }
  scores.sort((a, b) => b.score - a.score);
  const best = scores[0], second = scores[1];
  const spread = best.score - second.score;
  const active = chroma.filter(value => value / total > 0.055).length;
  if (active < 3 || best.score < 0.66 || spread < 0.055) return { camelot: null, confidence: null };
  return { camelot: best.key, confidence: Math.round(clamp((best.score * 0.6 + spread * 1.5) * 100, 0, 100)) };
}

function estimatedKey(samples: Float32Array, rate: number) {
  const size = 4096, hop = 8192;
  const chroma = new Array<number>(12).fill(0);
  const end = Math.min(samples.length - size, Math.floor(rate * MAX_SECONDS));
  let eligible = 0;
  for (let start = 0; start <= end; start += hop) {
    let power = 0;
    for (let i = 0; i < size; i += 1) power += samples[start + i] ** 2;
    if (Math.sqrt(power / size) < 0.012) continue;
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i += 1) re[i] = samples[start + i] * (0.5 - 0.5 * Math.cos(2 * Math.PI * i / (size - 1)));
    fft(re, im);
    let frameWeight = 0;
    const frameChroma = new Array<number>(12).fill(0);
    for (let i = Math.max(1, Math.ceil(80 * size / rate)); i < Math.min(size / 2 - 1, Math.floor(1800 * size / rate)); i += 1) {
      const freq = i * rate / size;
      const semitone = 69 + 12 * Math.log2(freq / 440);
      if (Math.abs(semitone - Math.round(semitone)) > 0.25) continue;
      const powerAtBin = re[i] * re[i] + im[i] * im[i];
      const left = re[i - 1] ** 2 + im[i - 1] ** 2;
      const right = re[i + 1] ** 2 + im[i + 1] ** 2;
      if (powerAtBin <= left || powerAtBin <= right) continue;
      const amount = Math.sqrt(powerAtBin) / Math.sqrt(freq);
      frameChroma[((Math.round(semitone) % 12) + 12) % 12] += amount;
      frameWeight += amount;
    }
    if (frameWeight <= 0) continue;
    eligible += 1;
    for (let j = 0; j < 12; j += 1) chroma[j] += frameChroma[j] / frameWeight;
  }
  return eligible >= 6 ? estimateCamelotFromChroma(chroma) : { camelot: null, confidence: null };
}

export function analyzeLocalAudioPCM(samples: Float32Array, sampleRate: number): LocalAudioDNA {
  if (!(samples instanceof Float32Array) || !Number.isFinite(sampleRate) || sampleRate < 8000 || sampleRate > 192000 || samples.length === 0) {
    throw new Error('audio_dna_invalid_pcm');
  }
  const stride = Math.max(1, Math.floor(sampleRate / TARGET_RATE));
  const limit = Math.min(samples.length, Math.floor(sampleRate * MAX_SECONDS));
  const mono = stride === 1 ? samples.subarray(0, limit) : new Float32Array(Math.ceil(limit / stride));
  if (stride !== 1) {
    for (let i = 0, start = 0; start < limit; i += 1, start += stride) {
      let sum = 0;
      const end = Math.min(limit, start + stride);
      for (let j = start; j < end; j += 1) sum += samples[j];
      mono[i] = sum / (end - start);
    }
  }
  const rate = sampleRate / stride;
  let sum = 0, peak = 0;
  for (let i = 0; i < mono.length; i += 1) {
    if (!Number.isFinite(mono[i])) throw new Error('audio_dna_non_finite_sample');
    sum += mono[i] ** 2;
    peak = Math.max(peak, Math.abs(mono[i]));
  }
  const rms = Math.sqrt(sum / mono.length);
  const durationAnalyzedSeconds = Math.round(mono.length / rate * 10) / 10;
  const energyPercent = Math.round(clamp(rms / 0.35 * 100, 0, 100));
  const silent = rms < 0.004 || mono.length / rate < 4;
  const tempo = silent ? { bpm: null, confidence: null, onsets: 0 } : estimatedTempo(mono, rate);
  const key = silent ? { camelot: null, confidence: null } : estimatedKey(mono, rate);
  const waveform = buildLocalWaveform(mono);
  return {
    method: 'local-signal-estimate-v1',
    durationAnalyzedSeconds,
    energyPercent,
    peakDbfs: peak > 0 ? Math.round(20 * Math.log10(peak) * 10) / 10 : null,
    rmsDbfs: rms > 0 ? Math.round(20 * Math.log10(rms) * 10) / 10 : null,
    bpm: tempo.bpm,
    bpmConfidence: tempo.confidence,
    camelot: key.camelot,
    keyConfidence: key.confidence,
    onsetCount: tempo.onsets,
    waveform
  };
}

/** Browser decode is explicitly local. Size bound is to avoid unbounded mobile RAM usage. */
export async function analyzeLocalAudioFile(file: File): Promise<LocalAudioDNA> {
  if (!file.size || file.size > 30 * 1024 * 1024) throw new Error('audio_dna_file_size_limit_30mb');
  if (typeof AudioContext === 'undefined') throw new Error('audio_dna_browser_unsupported');
  const context = new AudioContext();
  try {
    const audio = await context.decodeAudioData(await file.arrayBuffer());
    const { samples, sampleRate } = selectLocalAnalysisSamples(audio);
    return analyzeLocalAudioPCM(samples, sampleRate);
  } finally {
    await context.close();
  }
}
