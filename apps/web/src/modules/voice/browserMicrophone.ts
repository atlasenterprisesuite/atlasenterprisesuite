import type { MeasuredAudioStats } from './quality';

export type MicrophonePermission = 'granted' | 'denied' | 'unavailable';

export interface MicrophoneAdapter {
  requestPermission(): Promise<MicrophonePermission>;
  start(): Promise<void>;
  stop(): Promise<{ blob: Blob; stats: MeasuredAudioStats }>;
}

export class BrowserMicrophoneAdapter implements MicrophoneAdapter {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private audioContext: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private chunks: Blob[] = [];
  private frameRms: number[] = [];
  private peak = 0;

  async requestPermission(): Promise<MicrophonePermission> {
    if (!navigator.mediaDevices?.getUserMedia) return 'unavailable';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      return 'granted';
    } catch (error) {
      if (error instanceof DOMException && (error.name === 'NotAllowedError' || error.name === 'SecurityError')) {
        return 'denied';
      }
      return 'unavailable';
    }
  }

  async start() {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined' || typeof AudioContext === 'undefined') {
      throw new Error('microphone_unavailable');
    }
    if (this.stream) throw new Error('recording_already_started');

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    this.chunks = [];
    this.frameRms = [];
    this.peak = 0;

    this.audioContext = new AudioContext();
    const source = this.audioContext.createMediaStreamSource(this.stream);
    this.analyser = this.audioContext.createAnalyser();
    this.analyser.fftSize = 2048;
    source.connect(this.analyser);

    const data = new Float32Array(this.analyser.fftSize);
    this.timer = setInterval(() => {
      if (!this.analyser) return;
      this.analyser.getFloatTimeDomainData(data);
      let sumSq = 0;
      let framePeak = 0;
      for (const sample of data) {
        const abs = Math.abs(sample);
        if (abs > framePeak) framePeak = abs;
        sumSq += sample * sample;
      }
      const rms = Math.sqrt(sumSq / data.length);
      this.frameRms.push(rms);
      if (framePeak > this.peak) this.peak = framePeak;
    }, 100);

    this.recorder = new MediaRecorder(this.stream);
    this.recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) this.chunks.push(event.data);
    });
    this.recorder.start();
  }

  async stop(): Promise<{ blob: Blob; stats: MeasuredAudioStats }> {
    if (!this.stream || !this.recorder) throw new Error('recording_not_started');

    const recorder = this.recorder;
    if (recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        recorder.addEventListener('stop', () => resolve(), { once: true });
        recorder.stop();
      });
    }

    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.stream.getTracks().forEach((track) => track.stop());
    await this.audioContext?.close();

    const values = this.frameRms.length > 0 ? this.frameRms : [0];
    const rms = values.reduce((sum, value) => sum + value, 0) / values.length;
    const silenceRatio = values.filter((value) => value < 0.02).length / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const noiseFloor = sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.1))] ?? 0;
    const variance = values.reduce((sum, value) => sum + ((value - rms) ** 2), 0) / values.length;

    const blob = new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' });
    const stats: MeasuredAudioStats = {
      peak: this.peak,
      rms,
      silenceRatio,
      noiseFloor,
      volumeStdDev: Math.sqrt(variance)
    };

    this.stream = null;
    this.recorder = null;
    this.audioContext = null;
    this.analyser = null;
    this.chunks = [];
    this.frameRms = [];
    this.peak = 0;

    return { blob, stats };
  }
}
