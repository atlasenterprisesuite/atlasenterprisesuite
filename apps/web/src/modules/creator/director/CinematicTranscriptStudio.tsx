import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import {
  cueAtTime, parseTimedCaptions, searchCaptions, serializeTimedCaptions,
  validateTimedCaptions, type CaptionCue, type CaptionFormat
} from '../../../../../../packages/creator/captions';
import {
  CINEMATIC_PRESETS, renderLocalCaptionedVideo, supportedVideoRecordingType,
  type CinematicPreset
} from '../../../../../../packages/creator/cinematic_render';
import './cinematic-transcript.css';

const VIDEO_LIMIT = 500 * 1024 * 1024;
const SUBTITLE_LIMIT = 2 * 1024 * 1024;

function displayTime(seconds: number): string {
  if (!Number.isFinite(seconds)) return '00:00.000';
  const mins = Math.floor(seconds / 60);
  const secs = (seconds - mins * 60).toFixed(3).padStart(6, '0');
  return String(mins).padStart(2, '0') + ':' + secs;
}

function downloadCaptions(data: string, format: CaptionFormat): void {
  const blob = new Blob([data], { type: format === 'vtt' ? 'text/vtt;charset=utf-8' : 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'atlas-captions.' + format;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Author-supplied file stays in this browser. This editor neither uploads files
 * nor pretends that a transcription provider has produced inferred timestamps.
 */
export function CinematicTranscriptStudio() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const cueCounter = useRef(0);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoName, setVideoName] = useState('');
  const [duration, setDuration] = useState<number | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [cues, setCues] = useState<CaptionCue[]>([]);
  const [timedSource, setTimedSource] = useState('');
  const [search, setSearch] = useState('');
  const [title, setTitle] = useState('');
  const [preset, setPreset] = useState<CinematicPreset>('crimson');
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [notice, setNotice] = useState('No files are uploaded. Automatic speech-to-text is not connected.');
  const [rendering, setRendering] = useState(false);
  const [progress, setProgress] = useState(0);
  const [rendered, setRendered] = useState<{ url: string; extension: 'mp4' | 'webm' } | null>(null);

  const issues = useMemo(() => validateTimedCaptions(cues, duration), [cues, duration]);
  const matches = useMemo(() => searchCaptions(cues, search), [cues, search]);
  const active = useMemo(() => cueAtTime(cues, currentTime), [cues, currentTime]);
  const mimeType = supportedVideoRecordingType();
  const canCapture = Boolean(mimeType && typeof AudioContext !== 'undefined' &&
    typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.captureStream);
  const canRender = Boolean(videoUrl && duration && cues.length && !issues.length &&
    rightsConfirmed && canCapture && !rendering);

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl); }, [videoUrl]);
  useEffect(() => () => { if (rendered) URL.revokeObjectURL(rendered.url); }, [rendered]);
  useEffect(() => () => { abortRef.current?.abort(); }, []);
  useEffect(() => { setRendered(null); }, [videoUrl, cues, title, preset]);

  function loadVideo(event: ChangeEvent<HTMLInputElement>): void {
    const file = event.target.files?.[0];
    if (!file || rendering) return;
    if (!file.size || file.size > VIDEO_LIMIT || !(file.type.startsWith('video/') ||
      (!file.type && /\.(mp4|m4v|mov|webm)$/i.test(file.name)))) {
      setNotice('Choose a local video (MP4, MOV, WebM), up to 500 MB.'); return;
    }
    const url = URL.createObjectURL(file);
    if (videoUrl) setCues([]);
    setVideoUrl(url);
    setVideoName(file.name);
    setCurrentTime(0);
    setDuration(null);
    setRendered(null);
    setRightsConfirmed(false);
    setNotice('Video loaded locally. Import timed captions or add your own at the playhead.');
  }

  function applyCaptions(source: string): void {
    try {
      const parsed = parseTimedCaptions(source);
      setCues(parsed);
      cueCounter.current = parsed.length;
      setSearch('');
      setNotice('Imported ' + parsed.length + ' timed subtitle segments locally.');
    } catch (error) {
      setNotice('Import rejected: ' + (error instanceof Error ? error.message : 'invalid_subtitles'));
    }
  }

  async function loadSubtitleFile(event: ChangeEvent<HTMLInputElement>): Promise<void> {
    const file = event.target.files?.[0];
    if (!file || rendering) return;
    if (!file.size || file.size > SUBTITLE_LIMIT || !/\.(srt|vtt)$/i.test(file.name)) {
      setNotice('Choose a UTF-8 .srt or .vtt subtitle file up to 2 MB.'); return;
    }
    try {
      const text = await file.text();
      setTimedSource(text);
      applyCaptions(text);
    } catch {
      setNotice('Subtitle file could not be read.');
    }
  }

  function addCue(): void {
    if (duration === null || !videoUrl || rendering) return;
    const start = Math.round(currentTime * 1000) / 1000;
    const end = Math.min(duration, start + 3);
    if (end <= start || cues.some(cue => start < cue.end && cue.start < end)) {
      setNotice('Move the playhead to a free interval of up to three seconds, then add a subtitle.');
      return;
    }
    cueCounter.current += 1;
    const next = [...cues, { id: 'local-' + cueCounter.current, start, end, text: 'New subtitle' }]
      .sort((a, b) => a.start - b.start);
    setCues(next);
    setNotice('New timed cue added. Edit its text and timing before exporting.');
  }

  function editCue(id: string, patch: Partial<CaptionCue>): void {
    setCues(existing => existing.map(cue => cue.id === id ? { ...cue, ...patch } : cue));
  }

  function seekTo(seconds: number): void {
    const video = videoRef.current;
    if (!video || duration === null) return;
    video.currentTime = Math.max(0, Math.min(seconds, duration));
    setCurrentTime(video.currentTime);
  }

  function exportSubtitles(format: CaptionFormat): void {
    try {
      if (issues.length) throw new Error(issues.join(', '));
      downloadCaptions(serializeTimedCaptions(cues, format), format);
      setNotice(format.toUpperCase() + ' export prepared for local download.');
    } catch (error) {
      setNotice('Export blocked: ' + (error instanceof Error ? error.message : 'invalid_subtitles'));
    }
  }

  async function exportVideo(): Promise<void> {
    if (!canRender || !videoUrl) return;
    const controller = new AbortController();
    abortRef.current = controller;
    setRendered(null);
    setRendering(true);
    setProgress(0);
    setNotice('Rendering this local video in real time. Keep the tab visible and the device awake.');
    try {
      const result = await renderLocalCaptionedVideo({
        sourceUrl: videoUrl, cues, title, preset, signal: controller.signal,
        onProgress: percent => setProgress(percent)
      });
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      setRendered({ url, extension: result.extension });
      setNotice('Local render produced a video file. Verify captions and sound before publishing.');
    } catch (error) {
      setNotice('Render blocked: ' + (error instanceof Error ? error.message : 'local_render_failed'));
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setRendering(false);
    }
  }

  return <section className="cinema-studio" aria-label="Cinematic Transcript Studio">
    <div className="cinema-heading">
      <div><p className="eyebrow">ATLAS Studio · Local media</p><h2>Cinematic Captions & Interactive Transcript</h2></div>
      <span className="cinema-local-flag">Local-first · no upload</span>
    </div>
    <p className="cinema-hint">Add your own video and timestamped subtitles, or create cues while previewing. Search the transcript and select any phrase to seek to its exact start. Automatic speech-to-text is not connected; no audio-derived timestamps are invented.</p>

    <div className="cinema-grid">
      <div className="cinema-preview-column">
        <label className="cinema-field">Local video
          <input aria-label="Local video" type="file" accept="video/*,.mov,.m4v" disabled={rendering} onChange={loadVideo} />
        </label>
        <div className="cinema-screen">
          {videoUrl ? <>
            <video aria-label="Local video preview" ref={videoRef} src={videoUrl} controls playsInline
              style={{ filter: CINEMATIC_PRESETS[preset].filter }}
              onLoadedMetadata={event => {
                const value = event.currentTarget.duration;
                if (Number.isFinite(value) && value > 0) setDuration(value);
                else setNotice('This video has no usable finite duration.');
              }}
              onTimeUpdate={event => setCurrentTime(event.currentTarget.currentTime)}
              onSeeked={event => setCurrentTime(event.currentTarget.currentTime)}
              onError={() => setNotice('The browser cannot decode this video format.')}
            />
            {title.trim() && <div className="cinema-preview-title">{title}</div>}
            {active && <div className="cinema-overlay-caption" aria-live="off">{active.text}</div>}
          </> : <div className="cinema-screen-empty">Select an authorized video to preview the cinematic style and timed subtitles.</div>}
        </div>
        <p className="cinema-media-caption">{videoName || 'No video selected'} · {displayTime(currentTime)} / {duration === null ? 'Unknown duration' : displayTime(duration)}</p>
      </div>

      <div className="cinema-controls-column">
        <label className="cinema-field">Cinematic preset
          <select aria-label="Cinematic preset" value={preset} disabled={rendering} onChange={event => setPreset(event.target.value as CinematicPreset)}>
            {Object.entries(CINEMATIC_PRESETS).map(([id, option]) => <option key={id} value={id}>{option.label}</option>)}
          </select>
        </label>
        <label className="cinema-field">Opening title (optional)
          <input aria-label="Opening title" type="text" maxLength={120} disabled={rendering} value={title} onChange={event => setTitle(event.target.value)} placeholder="ATLAS Original" />
        </label>
        <label className="cinema-field">Import timestamped subtitles
          <input aria-label="Import timestamped subtitles" type="file" accept=".srt,.vtt,text/vtt" disabled={rendering} onChange={event => { void loadSubtitleFile(event); }} />
        </label>
        <label className="cinema-field">Or paste SRT / WebVTT
          <textarea aria-label="Paste timestamped subtitles" rows={5} maxLength={2_000_000} disabled={rendering} value={timedSource} onChange={event => setTimedSource(event.target.value)}
            placeholder={'WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nA line of your own words'} />
        </label>
        <div className="cinema-actions">
          <button type="button" onClick={() => applyCaptions(timedSource)} disabled={rendering || !timedSource.trim()}>Import pasted timings</button>
          <button type="button" onClick={addCue} disabled={rendering || duration === null}>Add cue at playhead</button>
        </div>
      </div>
    </div>

    <div className="cinema-transcript-heading">
      <h3>Interactive transcript</h3>
      <span>{matches.length} of {cues.length} cues</span>
    </div>
    <label className="cinema-field">Search transcript
      <input aria-label="Search transcript" type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search a word or phrase" />
    </label>
    {issues.length > 0 && <p role="alert" className="cinema-warning">Export blocked until these subtitle issues are fixed: {issues.join(', ')}</p>}
    {cues.length === 0 ? <p className="cinema-hint">No timed cues yet. Import SRT/VTT or add captions while your video is paused.</p>
      : matches.length === 0 ? <p className="cinema-hint">No matching phrases.</p>
        : <ol className="cinema-cue-list" aria-label="Transcript cues">{matches.map((cue, index) => <li key={cue.id} className={active?.id === cue.id ? 'active' : ''}>
          <button type="button" className="cinema-seek" aria-label={'Seek to ' + displayTime(cue.start)}
            aria-current={active?.id === cue.id ? 'true' : undefined} disabled={duration === null}
            onClick={() => seekTo(cue.start)}>{displayTime(cue.start)} <span aria-hidden="true">▶</span></button>
          <div className="cinema-cue-editor">
            <label>Start (seconds)<input aria-label={'Start cue ' + (index + 1)} type="number" min="0" step="0.001" disabled={rendering} value={cue.start} onChange={event => editCue(cue.id, { start: Number(event.target.value) })} /></label>
            <label>End (seconds)<input aria-label={'End cue ' + (index + 1)} type="number" min="0" step="0.001" disabled={rendering} value={cue.end} onChange={event => editCue(cue.id, { end: Number(event.target.value) })} /></label>
            <label className="cinema-cue-text">Subtitle<textarea aria-label={'Subtitle cue ' + (index + 1)} rows={2} maxLength={4000} disabled={rendering} value={cue.text} onChange={event => editCue(cue.id, { text: event.target.value })} /></label>
          </div>
          <button type="button" className="cinema-delete" disabled={rendering} aria-label={'Delete cue ' + (index + 1)}
            onClick={() => setCues(existing => existing.filter(item => item.id !== cue.id))}>Remove</button>
        </li>)}</ol>}

    <div className="cinema-export">
      <div className="cinema-actions">
        <button type="button" disabled={!cues.length || issues.length > 0 || rendering} onClick={() => exportSubtitles('srt')}>Export SRT</button>
        <button type="button" disabled={!cues.length || issues.length > 0 || rendering} onClick={() => exportSubtitles('vtt')}>Export WebVTT</button>
      </div>
      <label className="cinema-rights"><input type="checkbox" checked={rightsConfirmed} disabled={rendering} onChange={event => setRightsConfirmed(event.target.checked)} /> I own or have permission to edit and export this footage and audio.</label>
      <div className="cinema-actions">
        <button type="button" onClick={() => { void exportVideo(); }} disabled={!canRender}>Render captioned video locally</button>
        {rendering && <button type="button" onClick={() => abortRef.current?.abort()}>Cancel render</button>}
        {rendered && <a className="cinema-download" href={rendered.url} download={'atlas-cinematic-video.' + rendered.extension}>Download rendered {rendered.extension.toUpperCase()}</a>}
      </div>
      {rendering && <progress aria-label="Local rendering progress" max={100} value={progress}>{progress}%</progress>}
      {!canCapture && <p className="cinema-hint">This browser does not expose the required local video/audio recording APIs. Preview and subtitle exports remain available; video rendering is disabled.</p>}
      <p className="cinema-hint">Video export is limited to clips of 10 minutes, uses original local audio and may produce MP4 or WebM depending on browser capabilities. It does not synthesize footage or generate subtitles automatically. Long or complex cues may block export instead of being silently truncated.</p>
      <p role="status" className="cinema-notice">{notice}</p>
    </div>
  </section>;
}
