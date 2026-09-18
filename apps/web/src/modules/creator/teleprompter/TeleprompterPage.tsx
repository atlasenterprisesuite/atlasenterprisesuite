import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getCreatorRecordingDownload,
  getCreatorRecordingReadiness,
  uploadCreatorRecording
} from '../../../lib/creatorApi';
import { TELEPROMPTER_SCRIPTS, type TeleprompterLanguage } from './teleprompterScripts';
import './teleprompter.css';

type SyncMode = 'voice' | 'timed';
type RecorderState = 'idle' | 'countdown' | 'recording' | 'stopped' | 'error';
type CloudState = 'checking' | 'connected' | 'unavailable' | 'saving' | 'saved' | 'error';

type RecognitionResultLike = { 0: { transcript: string } };
type RecognitionEventLike = { results: ArrayLike<RecognitionResultLike> };
type RecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: RecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};
type RecognitionConstructor = new () => RecognitionLike;

function speechRecognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === 'undefined') return null;
  const scope = window as typeof window & {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return scope.SpeechRecognition || scope.webkitSpeechRecognition || null;
}

function normalizeWord(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9ñ]+/gi, '');
}

function normalizedWords(value: string) {
  return value.split(/\s+/).map(normalizeWord).filter(Boolean);
}

export function matchVoiceCursor(scriptWords: string[], spokenText: string, currentIndex: number) {
  const spoken = normalizedWords(spokenText);
  if (!spoken.length || !scriptWords.length) return currentIndex;
  const tail = spoken.slice(-Math.min(8, spoken.length));
  const start = Math.max(0, currentIndex - 12);
  const end = Math.min(scriptWords.length - 1, currentIndex + 140);
  let bestIndex = currentIndex;
  let bestScore = -1;

  for (let candidate = start; candidate <= end; candidate += 1) {
    let score = 0;
    for (let offset = 0; offset < tail.length; offset += 1) {
      const scriptIndex = candidate - (tail.length - 1 - offset);
      if (scriptIndex >= 0 && scriptWords[scriptIndex] === tail[offset]) {
        score += offset >= tail.length - 3 ? 2 : 1;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestIndex = candidate;
    }
  }

  const threshold = tail.length <= 2 ? 2 : Math.max(3, Math.ceil(tail.length * 0.7));
  return bestScore >= threshold ? bestIndex : currentIndex;
}

function preferredMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  return [
    'video/mp4;codecs=h264,aac',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
  ].find(value => MediaRecorder.isTypeSupported(value)) || '';
}

function clock(seconds: number) {
  return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
}

const copy = {
  es: {
    title: 'ATLAS Teleprompter Inteligente',
    subtitle: 'La cámara, tu voz y el guion trabajan al mismo ritmo.',
    script: 'Guion',
    spanish: 'Español',
    english: 'Inglés',
    voice: 'Seguir mi voz',
    timed: 'Velocidad fija',
    start: 'Comenzar grabación',
    stop: 'Detener y guardar',
    camera: 'Activar cámara',
    cameraOff: 'Apagar cámara',
    rewind: 'Retroceder',
    reset: 'Volver al inicio',
    fullscreen: 'Pantalla completa',
    edit: 'Editar guion',
    saveEdit: 'Guardar guion',
    download: 'Descargar video',
    saveCloud: 'Guardar en ATLAS',
    cloudDownload: 'Abrir copia de ATLAS',
    font: 'Tamaño',
    speed: 'Velocidad',
    mirror: 'Espejo',
    autoCloud: 'Guardar automáticamente en ATLAS',
    autoLocal: 'Descargar automáticamente en este dispositivo',
    cloudConnected: 'Almacenamiento privado conectado',
    cloudUnavailable: 'Almacenamiento privado no disponible',
    cloudSaving: 'Guardando de forma privada en ATLAS',
    cloudSaved: 'Grabación guardada en ATLAS',
    voiceUnavailable: 'El reconocimiento de voz no está disponible en este navegador. Se activó la velocidad fija.',
    permissionError: 'No se pudo acceder a la cámara o al micrófono. Revisa los permisos del navegador.',
    unsupported: 'Este navegador no permite grabar video con MediaRecorder.',
    localNotice: 'La descarga local permanece en tu dispositivo. La copia de ATLAS solo se crea mediante una sesión y organización autorizadas.',
    editor: 'Guion actual'
  },
  en: {
    title: 'ATLAS Smart Teleprompter',
    subtitle: 'Your camera, voice, and script move at the same pace.',
    script: 'Script',
    spanish: 'Spanish',
    english: 'English',
    voice: 'Follow my voice',
    timed: 'Fixed speed',
    start: 'Start recording',
    stop: 'Stop and save',
    camera: 'Enable camera',
    cameraOff: 'Turn camera off',
    rewind: 'Rewind',
    reset: 'Back to start',
    fullscreen: 'Full screen',
    edit: 'Edit script',
    saveEdit: 'Save script',
    download: 'Download video',
    saveCloud: 'Save to ATLAS',
    cloudDownload: 'Open ATLAS copy',
    font: 'Font size',
    speed: 'Speed',
    mirror: 'Mirror',
    autoCloud: 'Automatically save to ATLAS',
    autoLocal: 'Automatically download to this device',
    cloudConnected: 'Private storage connected',
    cloudUnavailable: 'Private storage unavailable',
    cloudSaving: 'Saving privately to ATLAS',
    cloudSaved: 'Recording saved to ATLAS',
    voiceUnavailable: 'Voice recognition is unavailable in this browser. Fixed speed was enabled.',
    permissionError: 'Camera or microphone access failed. Review browser permissions.',
    unsupported: 'This browser does not support MediaRecorder video recording.',
    localNotice: 'The local download stays on your device. An ATLAS copy is created only through an authorized session and organization.',
    editor: 'Current script'
  }
} as const;

export function TeleprompterPage() {
  const [language, setLanguage] = useState<TeleprompterLanguage>('es');
  const [scripts, setScripts] = useState({ ...TELEPROMPTER_SCRIPTS });
  const [draft, setDraft] = useState(TELEPROMPTER_SCRIPTS.es);
  const [mode, setMode] = useState<SyncMode>('voice');
  const [cursor, setCursor] = useState(0);
  const [fontSize, setFontSize] = useState(44);
  const [wordsPerMinute, setWordsPerMinute] = useState(125);
  const [mirror, setMirror] = useState(true);
  const [autoCloud, setAutoCloud] = useState(true);
  const [autoLocal, setAutoLocal] = useState(true);
  const [editing, setEditing] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [state, setState] = useState<RecorderState>('idle');
  const [countdown, setCountdown] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [notice, setNotice] = useState('');
  const [recordedUrl, setRecordedUrl] = useState('');
  const [recordedBlob, setRecordedBlob] = useState<Blob | null>(null);
  const [cloudState, setCloudState] = useState<CloudState>('checking');
  const [cloudAllowed, setCloudAllowed] = useState(false);
  const [recordingId, setRecordingId] = useState('');
  const [cloudUrl, setCloudUrl] = useState('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const runningRef = useRef(false);
  const wordRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const studioRef = useRef<HTMLElement | null>(null);
  const autoCloudRef = useRef(autoCloud);
  const autoLocalRef = useRef(autoLocal);

  const ui = copy[language];
  const script = scripts[language];
  const words = useMemo(() => script.split(/\s+/).filter(Boolean), [script]);
  const normalized = useMemo(() => normalizedWords(script), [script]);
  const voiceAvailable = Boolean(speechRecognitionConstructor());

  useEffect(() => { autoCloudRef.current = autoCloud; }, [autoCloud]);
  useEffect(() => { autoLocalRef.current = autoLocal; }, [autoLocal]);

  useEffect(() => {
    let active = true;
    setCloudState('checking');
    getCreatorRecordingReadiness()
      .then(result => {
        if (!active) return;
        setCloudAllowed(Boolean(result.connected && result.upload_allowed));
        setCloudState(result.connected ? 'connected' : 'unavailable');
      })
      .catch(() => {
        if (!active) return;
        setCloudAllowed(false);
        setCloudState('unavailable');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setDraft(scripts[language]);
    setCursor(0);
    setCloudUrl('');
    wordRefs.current = [];
  }, [language]);

  useEffect(() => {
    wordRefs.current[cursor]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [cursor]);

  useEffect(() => {
    if (!runningRef.current || mode !== 'timed') return;
    const timer = window.setInterval(() => {
      setCursor(value => Math.min(words.length - 1, value + 1));
    }, Math.max(180, Math.round(60000 / wordsPerMinute)));
    return () => window.clearInterval(timer);
  }, [mode, wordsPerMinute, words.length, state]);

  useEffect(() => {
    if (state !== 'recording') return;
    const timer = window.setInterval(() => setElapsed(value => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [state]);

  useEffect(() => () => {
    runningRef.current = false;
    recognitionRef.current?.stop();
    streamRef.current?.getTracks().forEach(track => track.stop());
  }, []);

  async function ensureCamera() {
    if (streamRef.current) return streamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      setCameraReady(true);
      setNotice('');
      return stream;
    } catch {
      setState('error');
      setNotice(ui.permissionError);
      return null;
    }
  }

  function stopCamera() {
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraReady(false);
  }

  function beginVoiceTracking() {
    if (mode !== 'voice') return;
    const Recognition = speechRecognitionConstructor();
    if (!Recognition) {
      setMode('timed');
      setNotice(ui.voiceUnavailable);
      return;
    }
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = language === 'es' ? 'es-US' : 'en-US';
    recognition.onresult = event => {
      let spoken = '';
      for (let i = 0; i < event.results.length; i += 1) spoken += ' ' + (event.results[i][0]?.transcript || '');
      setCursor(current => matchVoiceCursor(normalized, spoken, current));
    };
    recognition.onerror = event => {
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') setNotice(ui.voiceUnavailable);
    };
    recognition.onend = () => {
      if (runningRef.current && mode === 'voice') {
        try { recognition.start(); } catch { /* browser restart race */ }
      }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch { setNotice(ui.voiceUnavailable); }
  }

  function triggerDownload(url: string, mimeType: string) {
    const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('quicktime') ? 'mov' : 'webm';
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `atlas-teleprompter-${language}-${new Date().toISOString().replace(/[:.]/g, '-') }.${extension}`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  async function saveBlobToAtlas(blob: Blob, duration: number) {
    if (!cloudAllowed) return;
    setCloudState('saving');
    try {
      const saved = await uploadCreatorRecording(blob, language, duration);
      setRecordingId(saved.id);
      setCloudState('saved');
    } catch (error) {
      setCloudState('error');
      setNotice(error instanceof Error ? error.message : 'recording_upload_failed');
    }
  }

  async function startRecording() {
    if (typeof MediaRecorder === 'undefined') {
      setNotice(ui.unsupported);
      setState('error');
      return;
    }
    const stream = await ensureCamera();
    if (!stream) return;
    setRecordedBlob(null);
    setRecordingId('');
    setCloudUrl('');
    setElapsed(0);
    setState('countdown');

    for (let value = 3; value >= 1; value -= 1) {
      setCountdown(value);
      await new Promise(resolve => window.setTimeout(resolve, 700));
    }
    setCountdown(0);

    const mimeType = preferredMimeType();
    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    chunksRef.current = [];
    recorder.ondataavailable = event => { if (event.data.size) chunksRef.current.push(event.data); };
    recorder.onstop = () => {
      const finalType = String(recorder.mimeType || mimeType || 'video/webm').split(';')[0];
      const blob = new Blob(chunksRef.current, { type: finalType });
      const url = URL.createObjectURL(blob);
      setRecordedBlob(blob);
      setRecordedUrl(previous => {
        if (previous) URL.revokeObjectURL(previous);
        return url;
      });
      setState('stopped');
      if (autoLocalRef.current) triggerDownload(url, finalType);
      if (autoCloudRef.current && cloudAllowed) void saveBlobToAtlas(blob, elapsed);
    };

    recorderRef.current = recorder;
    recorder.start(1000);
    runningRef.current = true;
    setState('recording');
    beginVoiceTracking();
  }

  function stopRecording() {
    runningRef.current = false;
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  }

  async function openCloudCopy() {
    if (!recordingId) return;
    try {
      const result = await getCreatorRecordingDownload(recordingId);
      setCloudUrl(result.signed_url);
      window.open(result.signed_url, '_blank', 'noopener,noreferrer');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'recording_download_unavailable');
    }
  }

  async function enterFullscreen() {
    if (!document.fullscreenElement) await studioRef.current?.requestFullscreen?.();
    else await document.exitFullscreen?.();
  }

  function saveScript() {
    setScripts(current => ({ ...current, [language]: draft.trim() || TELEPROMPTER_SCRIPTS[language] }));
    setCursor(0);
    setEditing(false);
  }

  return <section className="creator-page teleprompter-page" ref={studioRef}>
    <nav className="creator-breadcrumb" aria-label="Breadcrumb"><Link to="/studio">ATLAS Studio</Link><span>/</span><span>Teleprompter</span></nav>

    <header className="teleprompter-header">
      <div><p className="eyebrow">ATLAS Studio · Creator</p><h1>{ui.title}</h1><p>{ui.subtitle}</p></div>
      <div className="teleprompter-status"><span className={state === 'recording' ? 'recording-dot active' : 'recording-dot'} /><strong>{state === 'recording' ? clock(elapsed) : state}</strong></div>
    </header>

    <div className="teleprompter-toolbar">
      <label><span>{ui.script}</span><select aria-label={ui.script} value={language} onChange={event => setLanguage(event.target.value as TeleprompterLanguage)}><option value="es">{ui.spanish}</option><option value="en">{ui.english}</option></select></label>
      <div className="teleprompter-segmented" role="group" aria-label="Synchronization mode">
        <button type="button" className={mode === 'voice' ? 'active' : ''} disabled={!voiceAvailable || state === 'recording'} onClick={() => setMode('voice')}>{ui.voice}</button>
        <button type="button" className={mode === 'timed' ? 'active' : ''} disabled={state === 'recording'} onClick={() => setMode('timed')}>{ui.timed}</button>
      </div>
      <label><span>{ui.font} · {fontSize}px</span><input aria-label={ui.font} type="range" min="28" max="72" value={fontSize} onChange={event => setFontSize(Number(event.target.value))} /></label>
      <label><span>{ui.speed} · {wordsPerMinute}</span><input aria-label={ui.speed} type="range" min="70" max="220" step="5" value={wordsPerMinute} disabled={mode === 'voice'} onChange={event => setWordsPerMinute(Number(event.target.value))} /></label>
    </div>

    <div className="teleprompter-cloud" data-state={cloudState}>
      <strong>{cloudState === 'connected' || cloudState === 'saved' ? ui.cloudConnected : cloudState === 'saving' ? ui.cloudSaving : ui.cloudUnavailable}</strong>
      <span>{cloudState === 'saved' ? ui.cloudSaved : cloudAllowed ? 'ATLAS Identity · organization scope · creator.write · private bucket' : 'Local recording remains available.'}</span>
    </div>

    <div className="teleprompter-stage">
      <div className="teleprompter-camera">
        <video ref={videoRef} className={mirror ? 'mirrored' : ''} muted playsInline aria-label="Camera preview" />
        {!cameraReady && <div className="camera-empty"><strong>ATLAS</strong><span>{ui.camera}</span></div>}
        {state === 'countdown' && <div className="countdown"><span>ATLAS</span><strong>{countdown}</strong></div>}
      </div>
      <div className="teleprompter-reader" style={{ fontSize }} aria-label="Teleprompter script">
        <div className="reading-guide" />
        <p>{words.map((word, index) => <span key={index} ref={node => { wordRefs.current[index] = node; }} className={index < cursor ? 'word spoken' : index === cursor ? 'word current' : 'word'}>{word} </span>)}</p>
      </div>
    </div>

    <div className="teleprompter-actions">
      {state === 'recording' || state === 'countdown'
        ? <button type="button" className="stop" onClick={stopRecording}>{ui.stop}</button>
        : <button type="button" className="creator-primary" onClick={startRecording}>{ui.start}</button>}
      <button type="button" onClick={cameraReady ? stopCamera : ensureCamera}>{cameraReady ? ui.cameraOff : ui.camera}</button>
      <button type="button" onClick={() => setCursor(value => Math.max(0, value - 30))}>{ui.rewind}</button>
      <button type="button" onClick={() => setCursor(0)}>{ui.reset}</button>
      <button type="button" onClick={enterFullscreen}>{ui.fullscreen}</button>
      <button type="button" onClick={() => setEditing(value => !value)}>{ui.edit}</button>
      {recordedUrl && <button type="button" onClick={() => triggerDownload(recordedUrl, recordedBlob?.type || 'video/webm')}>{ui.download}</button>}
      {recordedBlob && cloudAllowed && cloudState !== 'saving' && cloudState !== 'saved' && <button type="button" onClick={() => saveBlobToAtlas(recordedBlob, elapsed)}>{ui.saveCloud}</button>}
      {recordingId && <button type="button" onClick={openCloudCopy}>{ui.cloudDownload}</button>}
    </div>

    <div className="teleprompter-options">
      <label><input type="checkbox" checked={mirror} onChange={event => setMirror(event.target.checked)} /> {ui.mirror}</label>
      <label><input type="checkbox" checked={autoLocal} onChange={event => setAutoLocal(event.target.checked)} /> {ui.autoLocal}</label>
      <label><input type="checkbox" checked={autoCloud} disabled={!cloudAllowed} onChange={event => setAutoCloud(event.target.checked)} /> {ui.autoCloud}</label>
    </div>

    {editing && <div className="teleprompter-editor"><label><span>{ui.editor}</span><textarea rows={18} value={draft} onChange={event => setDraft(event.target.value)} /></label><button type="button" className="creator-primary" onClick={saveScript}>{ui.saveEdit}</button></div>}
    {notice && <div className="creator-notice" role="status">{notice}</div>}
    {cloudUrl && <div className="teleprompter-safety">ATLAS signed copy ready. The access link expires automatically.</div>}
    <div className="teleprompter-safety">{ui.localNotice}</div>
  </section>;
}
