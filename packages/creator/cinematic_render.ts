import { cueAtTime, validateTimedCaptions, type CaptionCue } from './captions';

/**
 * Local browser compositor for user-supplied footage. No server, model or provider
 * calls. Browser MediaRecorder capability and user consent are mandatory.
 */
export type CinematicPreset = 'original' | 'crimson' | 'noir' | 'gold';
export const CINEMATIC_PRESETS: Record<CinematicPreset, { label: string; filter: string }> = {
  original: { label: 'Original', filter: 'none' },
  crimson: { label: 'Crimson · cinematic red', filter: 'contrast(1.18) saturate(1.45) sepia(.45) hue-rotate(313deg)' },
  noir: { label: 'Noir · monochrome', filter: 'grayscale(1) contrast(1.26)' },
  gold: { label: 'Golden hour', filter: 'sepia(.35) saturate(1.25) contrast(1.1)' }
};

export type LocalRenderInput = {
  sourceUrl: string;
  cues: readonly CaptionCue[];
  title: string;
  preset: CinematicPreset;
  signal?: AbortSignal;
  onProgress?: (percent: number) => void;
};

export function supportedVideoRecordingType(): string | null {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') return null;
  return [
    'video/mp4;codecs=h264,aac',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ].find(type => MediaRecorder.isTypeSupported(type)) || null;
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, width: number): string[] {
  const lines: string[] = [];
  for (const rawLine of text.split('\n')) {
    let line = '';
    for (const word of rawLine.split(/\s+/).filter(Boolean)) {
      const candidate = line ? line + ' ' + word : word;
      if (line && ctx.measureText(candidate).width > width) {
        lines.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function paintFrame(
  ctx: CanvasRenderingContext2D, media: HTMLVideoElement,
  cues: readonly CaptionCue[], title: string, preset: CinematicPreset
): void {
  const width = ctx.canvas.width, height = ctx.canvas.height;
  ctx.fillStyle = '#000'; ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.filter = CINEMATIC_PRESETS[preset].filter;
  ctx.drawImage(media, 0, 0, width, height);
  ctx.restore();

  const shade = ctx.createLinearGradient(0, height * .57, 0, height);
  shade.addColorStop(0, 'rgba(0,0,0,0)');
  shade.addColorStop(1, 'rgba(0,0,0,.68)');
  ctx.fillStyle = shade; ctx.fillRect(0, height * .57, width, height * .43);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.88)';
  ctx.shadowBlur = Math.max(5, width / 85);

  if (title.trim()) {
    ctx.font = '700 ' + Math.max(16, Math.round(width * .035)) + 'px sans-serif';
    ctx.fillStyle = '#fff';
    const lines = wrapText(ctx, title.trim(), width * .84).slice(0, 3);
    lines.forEach((line, index) => ctx.fillText(line, width / 2, height * .09 + index * width * .044, width * .84));
  }

  const cue = cueAtTime(cues, media.currentTime);
  if (!cue) return;
  const fontSize = Math.max(18, Math.round(width * .047));
  ctx.font = '600 ' + fontSize + 'px Georgia, serif';
  ctx.fillStyle = '#fff';
  const lines = wrapText(ctx, cue.text, width * .86);
  const lineHeight = fontSize * 1.28;
  const baseY = height * .88 - (lines.length - 1) * lineHeight / 2;
  lines.forEach((line, index) => ctx.fillText(line, width / 2, baseY + index * lineHeight, width * .86));
}

/**
 * Real-time local render with original audio routed into the recording, not
 * played from a hidden second video. Unsupported browsers fail closed.
 * Recommended only for short clips; maximum 10 minutes in this MVP.
 */
export async function renderLocalCaptionedVideo(input: LocalRenderInput): Promise<{ blob: Blob; extension: 'mp4' | 'webm' }> {
  const mimeType = supportedVideoRecordingType();
  if (!mimeType || !globalThis.HTMLCanvasElement?.prototype.captureStream ||
      typeof AudioContext === 'undefined' || typeof requestAnimationFrame !== 'function') {
    throw new Error('local_video_recorder_unavailable');
  }
  if (!input.sourceUrl.startsWith('blob:') || !CINEMATIC_PRESETS[input.preset]) {
    throw new Error('local_source_or_style_invalid');
  }
  if (input.signal?.aborted) throw new Error('local_render_cancelled');
  const issues = validateTimedCaptions(input.cues);
  if (!input.cues.length || issues.length) throw new Error(issues.join(', ') || 'caption_no_timed_cues');
  if (input.cues.some(cue => cue.text.length > 180 || cue.text.split('\n').length > 5)) {
    throw new Error('local_render_caption_too_long');
  }

  const video = document.createElement('video');
  video.src = input.sourceUrl;
  video.preload = 'auto';
  video.playsInline = true;
  let audioContext: AudioContext | null = null;
  let output: MediaStream | null = null;
  let recorder: MediaRecorder | null = null;
  let raf = 0;
  let watchdog: ReturnType<typeof setTimeout> | null = null;
  let removeAbort = () => {};

  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('local_video_load_timeout')), 20_000);
      video.onloadedmetadata = () => { clearTimeout(timer); resolve(); };
      video.onerror = () => { clearTimeout(timer); reject(new Error('local_video_decode_failed')); };
      video.load();
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0 || video.duration > 600 ||
        video.videoWidth < 1 || video.videoHeight < 1) throw new Error('local_video_duration_or_dimensions_invalid');
    const timingIssues = validateTimedCaptions(input.cues, video.duration);
    if (timingIssues.length) throw new Error(timingIssues.join(', '));
    if (input.signal?.aborted) throw new Error('local_render_cancelled');

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('local_canvas_unavailable');

    audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();
    const source = audioContext.createMediaElementSource(video);
    source.connect(destination);
    await audioContext.resume();
    if (audioContext.state !== 'running') throw new Error('local_audio_context_not_running');

    const videoTracks = canvas.captureStream(24).getVideoTracks();
    if (!videoTracks.length) throw new Error('local_canvas_capture_unavailable');
    output = new MediaStream([...videoTracks, ...destination.stream.getAudioTracks()]);
    recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 3_500_000 });

    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const chunks: Blob[] = [];
    const recorded = new Promise<Blob>((resolve, reject) => {
      if (!recorder) return reject(new Error('local_recorder_unavailable'));
      recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onerror = () => reject(new Error('local_render_recording_error'));
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: mimeType });
        if (blob.size === 0) reject(new Error('local_render_empty_output'));
        else resolve(blob);
      };
    });
    let stopped = false;
    const stop = () => {
      if (stopped) return;
      stopped = true;
      if (recorder?.state === 'recording') recorder.stop();
    };
    const draw = () => {
      if (stopped) return;
      if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
        paintFrame(ctx, video, input.cues, input.title, input.preset);
      }
      input.onProgress?.(Math.min(99, Math.round(video.currentTime / video.duration * 100)));
      raf = requestAnimationFrame(draw);
    };
    video.addEventListener('ended', stop, { once: true });
    const aborted = new Promise<never>((_, reject) => {
      const cancel = () => { stop(); reject(new Error('local_render_cancelled')); };
      input.signal?.addEventListener('abort', cancel, { once: true });
      removeAbort = () => input.signal?.removeEventListener('abort', cancel);
    });
    const timeout = new Promise<never>((_, reject) => {
      watchdog = setTimeout(() => { stop(); reject(new Error('local_render_timeout')); }, video.duration * 1000 + 30_000);
    });
    recorder.start(500);
    raf = requestAnimationFrame(draw);
    try {
      await video.play();
    } catch {
      stop();
      throw new Error('local_render_playback_blocked');
    }
    const blob = await Promise.race([recorded, aborted, timeout]);
    input.onProgress?.(100);
    return { blob, extension: mimeType.startsWith('video/mp4') ? 'mp4' : 'webm' };
  } finally {
    if (watchdog) clearTimeout(watchdog);
    removeAbort();
    if (raf) cancelAnimationFrame(raf);
    if (recorder?.state === 'recording') recorder.stop();
    video.pause();
    video.removeAttribute('src');
    video.load();
    output?.getTracks().forEach(track => track.stop());
    if (audioContext && audioContext.state !== 'closed') {
      try { await audioContext.close(); } catch { /* browser already closed */ }
    }
  }
}
