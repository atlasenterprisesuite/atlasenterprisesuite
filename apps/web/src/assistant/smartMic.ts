/** Local microphone amplification with explicit opt-in and fail-closed cleanup.
 * Playback through speakers may cause feedback: headphones are recommended.
 * This module does not record or transmit microphone audio.
 */
export type SmartMicState = 'idle' | 'starting' | 'active' | 'stopped' | 'unavailable';
export type SmartMicSession = {
  readonly state: SmartMicState;
  setGain(value: number): void;
  stop(): Promise<void>;
};
export async function startSmartMic(options: {
  gain?: number;
  onState?: (state: SmartMicState) => void;
  mediaDevices?: Pick<MediaDevices, 'getUserMedia'>;
  createContext?: () => AudioContext;
} = {}): Promise<SmartMicSession> {
  const media = options.mediaDevices ?? (typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined);
  if (!media?.getUserMedia) {
    options.onState?.('unavailable');
    throw new Error('microphone_unsupported');
  }
  options.onState?.('starting');
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;
  let source: MediaStreamAudioSourceNode | undefined;
  let gain: GainNode | undefined;
  let stopped = false;
  const stop = async () => {
    if (stopped) return;
    stopped = true;
    try { source?.disconnect(); } catch { /* already disconnected */ }
    try { gain?.disconnect(); } catch { /* already disconnected */ }
    stream?.getTracks().forEach(track => track.stop());
    if (context && context.state !== 'closed') await context.close();
    options.onState?.('stopped');
  };
  try {
    stream = await media.getUserMedia({audio: {echoCancellation: true, noiseSuppression: true}, video: false});
    if (typeof window === 'undefined' && !options.createContext) throw new Error('audio_context_unavailable');
    context = options.createContext ? options.createContext() : new AudioContext();
    source = context.createMediaStreamSource(stream);
    gain = context.createGain();
    const setGain = (value: number) => {
      if (!Number.isFinite(value)) throw new Error('invalid_microphone_gain');
      if (gain) gain.gain.value = Math.max(0, Math.min(2, value));
    };
    setGain(options.gain ?? 1);
    source.connect(gain);
    gain.connect(context.destination);
    await context.resume();
    stream.getTracks().forEach(track => track.addEventListener('ended', () => { void stop(); }, {once: true}));
    options.onState?.('active');
    return {state: 'active', setGain, stop};
  } catch (error) {
    await stop();
    throw error;
  }
}
