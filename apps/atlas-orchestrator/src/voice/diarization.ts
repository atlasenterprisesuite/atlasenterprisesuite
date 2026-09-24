import { execFile } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const renderRoot = resolve('.atlas-render');
const whisperRuntimeDir = join(renderRoot, 'whisper-b5130');
const whisperModelPath = join(renderRoot, 'models', 'ggml-tiny.bin');
const SESSION_TTL_MS = 30 * 60 * 1000;
const MAX_SESSIONS = 512;
const SECOND_SPEAKER_DISTANCE = 0.34;

type SpeakerLabel = 'speaker-a' | 'speaker-b';

type SpeakerProfile = {
  centroid: number[];
  samples: number;
};

type SpeakerSession = {
  updatedAt: number;
  a?: SpeakerProfile;
  b?: SpeakerProfile;
};

export type AtlasDiarizationSegment = {
  speaker_id: SpeakerLabel;
  text: string;
  confidence: number;
  start_ms: number;
  end_ms: number;
};

export type AtlasDiarizationResult = {
  provider: 'atlas-render-diarization';
  model: 'whisper-tiny+atlas-acoustic-v1';
  segments: AtlasDiarizationSegment[];
};

type ParsedWav = {
  sampleRate: number;
  samples: Float32Array;
  durationMs: number;
};

type VoiceAnalysis = {
  silent: boolean;
  rms: number;
  feature: number[];
};

const sessions = new Map<string, SpeakerSession>();

function findFile(dir: string, basename: string): string | null {
  if (!existsSync(dir)) return null;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isFile() && entry.name === basename) return target;
    if (entry.isDirectory()) {
      const nested = findFile(target, basename);
      if (nested) return nested;
    }
  }
  return null;
}

function findLibraryDirs(dir: string, out = new Set<string>()): Set<string> {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const target = join(dir, entry.name);
    if (entry.isDirectory()) {
      findLibraryDirs(target, out);
      continue;
    }
    if (/^lib(?:whisper|ggml).*\.so(?:\.|$)/.test(entry.name)) out.add(dirname(target));
  }
  return out;
}

export function atlasDiarizationRuntimeState() {
  const cli = findFile(whisperRuntimeDir, 'whisper-cli');
  const ready = Boolean(cli && existsSync(whisperModelPath));
  return {
    ready,
    cli,
    modelPath: whisperModelPath,
    provider: 'atlas-render-diarization' as const,
    model: 'whisper-tiny+atlas-acoustic-v1' as const,
    mode: 'turn-level-acoustic-clustering' as const,
    biometricIdentity: false,
    error: ready ? null : 'diarization_runtime_missing',
  };
}

export function parsePcm16Wav(buffer: Buffer): ParsedWav {
  if (buffer.length < 44 || buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('diarization_audio_invalid_wav');
  }

  let offset = 12;
  let audioFormat = 0;
  let channels = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let dataOffset = -1;
  let dataLength = 0;

  while (offset + 8 <= buffer.length) {
    const id = buffer.toString('ascii', offset, offset + 4);
    const size = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    const end = Math.min(buffer.length, start + size);

    if (id === 'fmt ' && size >= 16 && end <= buffer.length) {
      audioFormat = buffer.readUInt16LE(start);
      channels = buffer.readUInt16LE(start + 2);
      sampleRate = buffer.readUInt32LE(start + 4);
      bitsPerSample = buffer.readUInt16LE(start + 14);
    } else if (id === 'data') {
      dataOffset = start;
      dataLength = Math.max(0, end - start);
      break;
    }

    offset = start + size + (size % 2);
  }

  if (
    audioFormat !== 1
    || channels < 1
    || channels > 2
    || bitsPerSample !== 16
    || sampleRate < 8_000
    || sampleRate > 48_000
    || dataOffset < 0
    || dataLength < 2 * channels
  ) {
    throw new Error('diarization_audio_unsupported');
  }

  const frameCount = Math.floor(dataLength / (2 * channels));
  const samples = new Float32Array(frameCount);
  let cursor = dataOffset;

  for (let frame = 0; frame < frameCount; frame += 1) {
    let sum = 0;
    for (let channel = 0; channel < channels; channel += 1) {
      sum += buffer.readInt16LE(cursor) / 32768;
      cursor += 2;
    }
    samples[frame] = sum / channels;
  }

  return {
    sampleRate,
    samples,
    durationMs: Math.round((samples.length / sampleRate) * 1000),
  };
}

function estimatePitch(samples: Float32Array, sampleRate: number): { hz: number; quality: number } {
  if (samples.length < sampleRate / 8) return { hz: 0, quality: 0 };

  const maxSamples = Math.min(samples.length, sampleRate * 2);
  const start = Math.max(0, Math.floor((samples.length - maxSamples) / 2));
  const end = start + maxSamples;

  let mean = 0;
  for (let i = start; i < end; i += 1) mean += samples[i];
  mean /= Math.max(1, end - start);

  const minLag = Math.max(1, Math.floor(sampleRate / 400));
  const maxLag = Math.min(Math.floor(sampleRate / 75), Math.floor((end - start) / 2));
  let bestLag = 0;
  let bestCorrelation = 0;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let cross = 0;
    let leftEnergy = 0;
    let rightEnergy = 0;
    for (let i = start; i + lag < end; i += 2) {
      const left = samples[i] - mean;
      const right = samples[i + lag] - mean;
      cross += left * right;
      leftEnergy += left * left;
      rightEnergy += right * right;
    }
    const denom = Math.sqrt(leftEnergy * rightEnergy) || 1;
    const correlation = cross / denom;
    if (correlation > bestCorrelation) {
      bestCorrelation = correlation;
      bestLag = lag;
    }
  }

  if (!bestLag || bestCorrelation < 0.18) return { hz: 0, quality: bestCorrelation };
  return { hz: sampleRate / bestLag, quality: bestCorrelation };
}

export function analyzeVoice(samples: Float32Array, sampleRate: number): VoiceAnalysis {
  if (!samples.length) return { silent: true, rms: 0, feature: [0, 0, 0, 0, 0] };

  let sum = 0;
  let energy = 0;
  for (const sample of samples) {
    sum += sample;
    energy += sample * sample;
  }
  const mean = sum / samples.length;
  const rms = Math.sqrt(energy / samples.length);

  let zeroCrossings = 0;
  let diffEnergy = 0;
  let previous = samples[0] - mean;
  for (let index = 1; index < samples.length; index += 1) {
    const current = samples[index] - mean;
    if ((previous < 0 && current >= 0) || (previous >= 0 && current < 0)) zeroCrossings += 1;
    const diff = current - previous;
    diffEnergy += diff * diff;
    previous = current;
  }

  const zcr = zeroCrossings / Math.max(1, samples.length - 1);
  const diffRatio = Math.sqrt(diffEnergy / Math.max(energy, 1e-8));
  const pitch = estimatePitch(samples, sampleRate);
  const pitchFeature = pitch.hz > 0 ? Math.log2(pitch.hz / 180) : 0;

  return {
    silent: rms < 0.0045,
    rms,
    feature: [
      Math.max(-2, Math.min(2, pitchFeature)),
      Math.max(0, Math.min(2, zcr * 10)),
      Math.max(0, Math.min(2, diffRatio * 1.8)),
      Math.max(0, Math.min(2, rms * 6)),
      Math.max(0, Math.min(1, pitch.quality)),
    ],
  };
}

function featureDistance(a: number[], b: number[]): number {
  const weights = [1.8, 0.7, 0.8, 0.15, 0.35];
  let sum = 0;
  let total = 0;
  for (let index = 0; index < Math.min(a.length, b.length, weights.length); index += 1) {
    const delta = a[index] - b[index];
    sum += weights[index] * delta * delta;
    total += weights[index];
  }
  return Math.sqrt(sum / Math.max(total, 1e-8));
}

function updateProfile(profile: SpeakerProfile, feature: number[]): void {
  const nextCount = profile.samples + 1;
  const alpha = Math.max(0.08, Math.min(0.28, 1 / nextCount));
  profile.centroid = profile.centroid.map((value, index) =>
    value * (1 - alpha) + (feature[index] ?? value) * alpha
  );
  profile.samples = nextCount;
}

function cleanSessions(now = Date.now()): void {
  for (const [id, session] of sessions) {
    if (now - session.updatedAt > SESSION_TTL_MS) sessions.delete(id);
  }
  while (sessions.size > MAX_SESSIONS) {
    const oldest = [...sessions.entries()].sort((left, right) => left[1].updatedAt - right[1].updatedAt)[0];
    if (!oldest) break;
    sessions.delete(oldest[0]);
  }
}

export function assignSpeakerForSession(
  sessionId: string,
  feature: number[],
  now = Date.now(),
): { speaker: SpeakerLabel; confidence: number } {
  if (!/^[A-Za-z0-9._:-]{8,128}$/.test(sessionId)) throw new Error('diarization_session_invalid');
  cleanSessions(now);

  const session = sessions.get(sessionId) || { updatedAt: now };
  session.updatedAt = now;

  if (!session.a) {
    session.a = { centroid: [...feature], samples: 1 };
    sessions.set(sessionId, session);
    return { speaker: 'speaker-a', confidence: 0.68 };
  }

  const distanceA = featureDistance(feature, session.a.centroid);

  if (!session.b) {
    if (distanceA > SECOND_SPEAKER_DISTANCE) {
      session.b = { centroid: [...feature], samples: 1 };
      sessions.set(sessionId, session);
      return {
        speaker: 'speaker-b',
        confidence: Math.max(0.7, Math.min(0.93, 0.65 + distanceA * 0.35)),
      };
    }
    updateProfile(session.a, feature);
    sessions.set(sessionId, session);
    return {
      speaker: 'speaker-a',
      confidence: Math.max(0.58, Math.min(0.88, 0.84 - distanceA * 0.45)),
    };
  }

  const distanceB = featureDistance(feature, session.b.centroid);
  const speaker: SpeakerLabel = distanceA <= distanceB ? 'speaker-a' : 'speaker-b';
  const nearest = Math.min(distanceA, distanceB);
  const farther = Math.max(distanceA, distanceB);
  const separation = Math.max(0, farther - nearest);
  const confidence = Math.max(0.52, Math.min(0.96, 0.56 + separation * 0.8));

  if (speaker === 'speaker-a') updateProfile(session.a, feature);
  else updateProfile(session.b, feature);
  sessions.set(sessionId, session);
  return { speaker, confidence };
}

function languageForWhisper(languageHints: string[]): string {
  const languages = [...new Set(
    languageHints
      .map((value) => String(value || '').trim().toLowerCase().split(/[-_]/)[0])
      .filter((value) => /^[a-z]{2}$/.test(value))
  )];
  return languages.length === 1 ? languages[0] : 'auto';
}

async function transcribeWav(buffer: Buffer, languageHints: string[]): Promise<string> {
  const runtime = atlasDiarizationRuntimeState();
  if (!runtime.ready || !runtime.cli) throw new Error('diarization_runtime_missing');

  const working = mkdtempSync(join(tmpdir(), 'atlas-diarization-'));
  const input = join(working, 'turn.wav');
  const outputPrefix = join(working, 'transcript');
  writeFileSync(input, buffer);

  const libraryDirs = [...findLibraryDirs(whisperRuntimeDir)];
  const env = {
    ...process.env,
    LD_LIBRARY_PATH: [...libraryDirs, process.env.LD_LIBRARY_PATH || ''].filter(Boolean).join(':'),
  };

  try {
    await execFileAsync(runtime.cli, [
      '-m', whisperModelPath,
      '-f', input,
      '-l', languageForWhisper(languageHints),
      '-t', '1',
      '-nt',
      '-otxt',
      '-of', outputPrefix,
    ], {
      env,
      timeout: 75_000,
      maxBuffer: 2_000_000,
    });

    const transcriptPath = outputPrefix + '.txt';
    if (!existsSync(transcriptPath)) return '';
    return readFileSync(transcriptPath, 'utf8')
      .replace(/\[BLANK_AUDIO\]/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
  } finally {
    rmSync(working, { recursive: true, force: true });
  }
}

export async function diarizeWavTurn(input: {
  audio: Buffer;
  sessionId: string;
  languageHints?: string[];
}): Promise<AtlasDiarizationResult> {
  const parsed = parsePcm16Wav(input.audio);
  const analysis = analyzeVoice(parsed.samples, parsed.sampleRate);
  if (analysis.silent) {
    return {
      provider: 'atlas-render-diarization',
      model: 'whisper-tiny+atlas-acoustic-v1',
      segments: [],
    };
  }

  const text = await transcribeWav(input.audio, input.languageHints || []);
  if (!text) {
    return {
      provider: 'atlas-render-diarization',
      model: 'whisper-tiny+atlas-acoustic-v1',
      segments: [],
    };
  }

  const assigned = assignSpeakerForSession(input.sessionId, analysis.feature);
  return {
    provider: 'atlas-render-diarization',
    model: 'whisper-tiny+atlas-acoustic-v1',
    segments: [{
      speaker_id: assigned.speaker,
      text,
      confidence: assigned.confidence,
      start_ms: 0,
      end_ms: parsed.durationMs,
    }],
  };
}
