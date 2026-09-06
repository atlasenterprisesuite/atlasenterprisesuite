import type { MeasuredAudioStats } from './quality';

export type MicrophonePermissionState = 'granted' | 'denied' | 'unavailable';

export type CapturedVoiceSample = {
  blob: Blob;
  stats: MeasuredAudioStats;
  mimeType: string;
  durationMs: number;
};

export interface MicrophoneAdapter {
  requestPermission(): Promise<MicrophonePermissionState>;
  start(): Promise<void>;
  stop(): Promise<CapturedVoiceSample>;
  cancel(): void;
}

type SampleFrame = {
  peak: number;
  rms: number;
};

type AudioContextWindow = Window & {
  webkitAudioContext?: typeof AudioContext;
};

function mean(values: readonly number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stdDev(values: readonly number[], average: number): number {
  if (values.length === 0) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
  return Math.sqrt(variance);
}

function summarizeFrames(frames: readonly SampleFrame[]): MeasuredAudioStats {
  if (frames.length === 0) {
    return { peak: 0, rms: 0, silenceRatio: 1, noiseFloor: 0, volumeStdDev: 0 };
  }

  const rmsValues = frames.map((frame) => frame.rms);
  const averageRms = mean(rmsValues);
  const sortedRms = [...rmsValues].sort((a, b) => a - b);
  const quietCount = Math.max(1, Math.ceil(sortedRms.length * 0.1));
  const noiseFloor = mean(sortedRms.slice(0, quietCount));
  const silenceThreshold = Math.max(0.015, noiseFloor * 1.8);

  return {
    peak: Math.max(...frames.map((frame) => frame.peak)),
    rms: averageRms,
    silenceRatio: frames.filter((frame) => frame.rms < silenceThreshold).length / frames.length,
    noiseFloor,
    volumeStdDev: stdDev(rmsValues, averageRms),
  };
}

function resolveAudioContextConstructor(): typeof AudioContext | null {
  const webkitWindow = window as AudioContextWindow;
  return window.AudioContext ?? webkitWindow.webkitAudioContext ?? null;
}

export class BrowserMicrophoneAdapter implements MicrophoneAdapter {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private sampleTimer: number | null = null;
  private chunks: BlobPart[] = [];
  private frames: SampleFrame[] = [];
  private startedAt = 0;

  async requestPermission(): Promise<MicrophonePermissionState> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      return 'unavailable';
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch (error) {
      if (error instanceof DOMException && ['NotAllowedError', 'SecurityError'].includes(error.name)) {
        return 'denied';
      }
      return 'unavailable';
    }
  }

  async start(): Promise<void> {
    if (this.recorder && this.recorder.state !== 'inactive') {
      throw new Error('Voice recording is already active.');
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new Error('Browser microphone recording is unavailable.');
    }

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const AudioContextConstructor = resolveAudioContextConstructor();
    if (!AudioContextConstructor) {
      stream.getTracks().forEach((track) => track.stop());
      throw new Error('Browser audio analysis is unavailable.');
    }

    const audioContext = new AudioContextConstructor();
    if (audioContext.state === 'suspended') await audioContext.resume();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 2048;
    audioContext.createMediaStreamSource(stream).connect(analyser);

    const recorder = new MediaRecorder(stream);
    this.stream = stream;
    this.recorder = recorder;
    this.audioContext = audioContext;
    this.analyser = analyser;
    this.chunks = [];
    this.frames = [];
    this.startedAt = performance.now();

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });

    recorder.start(250);
    this.sampleTimer = window.setInterval(() => this.captureFrame(), 100);
  }

  async stop(): Promise<CapturedVoiceSample> {
    const recorder = this.recorder;
    if (!recorder || recorder.state === 'inactive') {
      throw new Error('No active voice recording exists.');
    }

    return new Promise<CapturedVoiceSample>((resolve, reject) => {
      const finalize = async () => {
        try {
          const durationMs = Math.max(0, performance.now() - this.startedAt);
          const mimeType = recorder.mimeType || 'audio/webm';
          const blob = new Blob(this.chunks, { type: mimeType });
          const stats = summarizeFrames(this.frames);
          await this.cleanup();
          resolve({ blob, stats, mimeType, durationMs });
        } catch (error) {
          await this.cleanup();
          reject(error);
        }
      };

      recorder.addEventListener('stop', () => { void finalize(); }, { once: true });
      recorder.addEventListener('error', () => {
        void this.cleanup().finally(() => reject(new Error('Browser voice recording failed.')));
      }, { once: true });
      recorder.stop();
    });
  }

  cancel(): void {
    const recorder = this.recorder;
    if (recorder && recorder.state !== 'inactive') recorder.stop();
    void this.cleanup();
  }

  private captureFrame(): void {
    if (!this.analyser) return;
    const data = new Float32Array(this.analyser.fftSize);
    this.analyser.getFloatTimeDomainData(data);

    let peak = 0;
    let squared = 0;
    for (const sample of data) {
      const absolute = Math.abs(sample);
      if (absolute > peak) peak = absolute;
      squared += sample * sample;
    }

    this.frames.push({ peak, rms: Math.sqrt(squared / data.length) });
  }

  private async cleanup(): Promise<void> {
    if (this.sampleTimer !== null) {
      window.clearInterval(this.sampleTimer);
      this.sampleTimer = null;
    }
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = null;
    this.recorder = null;
    this.analyser = null;
    if (this.audioContext && this.audioContext.state !== 'closed') {
      await this.audioContext.close();
    }
    this.audioContext = null;
  }
}
