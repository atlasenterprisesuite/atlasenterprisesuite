import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  AtlasVoiceApi,
  atlasVoiceApi,
  type VoiceProfileRow,
  type VoiceSessionRow,
  type VoiceProviderStatus
} from './voiceApi';
import { BrowserMicrophoneAdapter, type MicrophoneAdapter, type MicrophonePermission } from './browserMicrophone';
import { assessVoiceQuality, type MeasuredAudioStats, type VoiceQualityAssessment } from './quality';
import './voice.css';

export type PersonalVoicePersistence =
  Pick<
    AtlasVoiceApi,
    | 'listProfiles'
    | 'createProfile'
    | 'createSession'
    | 'listSessions'
    | 'updateSession'
    | 'saveConsent'
    | 'saveAcceptedSample'
    | 'appendAuditEvent'
  >
  & Partial<
    Pick<
      AtlasVoiceApi,
      | 'listSamples'
      | 'listConsents'
      | 'providerStatus'
      | 'providerConsentPhrases'
      | 'createProviderConsent'
      | 'createProviderVoice'
    >
  >;

export type PersonalVoiceWizardStep = 'setup' | 'sound-check' | 'record' | 'review' | 'generate';

type SampleState = {
  id?: string;
  status: 'accepted' | 'needs_retry' | 'rejected' | 'missing';
  persisted?: boolean;
  blob?: Blob;
  stats?: MeasuredAudioStats;
  assessment?: VoiceQualityAssessment;
};

export type PersonalVoiceWizardProps = {
  initialStep: PersonalVoiceWizardStep;
  api?: PersonalVoicePersistence;
  microphone?: MicrophoneAdapter;
  initialProfileId?: string;
  initialSessionId?: string;
  initialConsentAccepted?: boolean;
};

const phrases = [
  { id: 'challenge', text: 'Estoy creando esta voz personal para mí, con mi permiso.' },
  { id: 'phrase-1', text: 'Hablaré con naturalidad, a un ritmo cómodo y constante.' },
  { id: 'phrase-2', text: 'Mi voz permanece bajo mi control y requiere mi autorización para utilizarse.' },
  { id: 'phrase-3', text: 'Cada frase clara ayuda a registrar el ritmo natural de mi manera de hablar.' },
  { id: 'phrase-4', text: 'La flor de cempasúchil se cultiva en catorce estados de la república.' },
  { id: 'phrase-5', text: 'Cuando el cielo cambia de color, la ciudad parece completamente diferente.' },
  { id: 'phrase-6', text: 'Puedo hablar con calma, hacer una pausa breve y continuar sin apresurarme.' },
  { id: 'phrase-7', text: 'La tecnología debe respetar la privacidad, el consentimiento y la identidad de cada persona.' },
  { id: 'phrase-8', text: 'Hoy revisaré los detalles importantes antes de tomar la siguiente decisión.' },
  { id: 'phrase-9', text: 'Esta grabación pertenece únicamente a mi perfil personal de ATLAS Voice.' }
] as const;

const providerReferenceText =
  'Esta es una muestra de referencia de mi voz natural. Hablo con un ritmo cómodo, una entonación estable y el volumen que uso normalmente. Autorizo esta muestra únicamente para crear mi Personal Voice mediante el proveedor que he aprobado en ATLAS.';

function routeForStep(step: PersonalVoiceWizardStep) {
  return `/voice/personal-voice/${step}`;
}

function emptySamples(): Record<string, SampleState> {
  return Object.fromEntries(phrases.map((phrase) => [phrase.id, { status: 'missing' } satisfies SampleState]));
}

function statusLabel(status: SampleState['status']) {
  if (status === 'accepted') return 'Aprobada';
  if (status === 'needs_retry') return 'Repetir';
  if (status === 'rejected') return 'Rechazada';
  return 'Pendiente';
}

function qualityReason(reason: string) {
  const labels: Record<string, string> = {
    clipping: 'saturación',
    volume_too_low: 'volumen bajo',
    too_much_silence: 'demasiado silencio',
    background_noise: 'ruido de fondo',
    unstable_volume: 'volumen inestable'
  };
  return labels[reason] || reason;
}

function validProfile(profile: VoiceProfileRow) {
  return profile.provider_kind === 'atlas' && profile.status !== 'deleted' && profile.status !== 'ready';
}

function validSession(session: VoiceSessionRow) {
  return session.status !== 'cancelled';
}

export function PersonalVoiceWizard({
  initialStep,
  api = atlasVoiceApi,
  microphone,
  initialProfileId,
  initialSessionId,
  initialConsentAccepted = false
}: PersonalVoiceWizardProps) {
  const navigate = useNavigate();
  const mic = useMemo(() => microphone ?? new BrowserMicrophoneAdapter(), [microphone]);

  const [profileId, setProfileId] = useState(initialProfileId || '');
  const [sessionId, setSessionId] = useState(initialSessionId || '');
  const [consentAccepted, setConsentAccepted] = useState(initialConsentAccepted);
  const [hydrating, setHydrating] = useState(
    initialStep !== 'setup' && (!initialProfileId || !initialSessionId)
  );
  const [busy, setBusy] = useState(false);
  const [persistenceError, setPersistenceError] = useState<string | null>(null);

  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermission | 'unchecked'>('unchecked');
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [soundCheckAssessment, setSoundCheckAssessment] = useState<VoiceQualityAssessment | null>(null);
  const [lastStats, setLastStats] = useState<MeasuredAudioStats | null>(null);

  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [samples, setSamples] = useState<Record<string, SampleState>>(emptySamples);
  const [challengeVerified, setChallengeVerified] = useState(false);
  const [providerStatus, setProviderStatus] = useState<VoiceProviderStatus | null>(null);
  const [providerConsentPhrase, setProviderConsentPhrase] = useState('');
  const [providerConsentSampleId, setProviderConsentSampleId] = useState('');
  const [providerReferenceSampleId, setProviderReferenceSampleId] = useState('');
  const [providerAuthorized, setProviderAuthorized] = useState(false);
  const [providerRecording, setProviderRecording] = useState<'consent' | 'reference' | null>(null);
  const [providerRecordingStartedAt, setProviderRecordingStartedAt] = useState(0);
  const [providerMessage, setProviderMessage] = useState<string | null>(null);
  const [voiceCreated, setVoiceCreated] = useState(false);

  const acceptedCount = phrases.filter((phrase) => samples[phrase.id]?.status === 'accepted').length;
  const reviewComplete = acceptedCount === phrases.length;

  useEffect(() => {
    if (initialStep === 'setup' || (initialProfileId && initialSessionId)) return;

    let active = true;
    setHydrating(true);
    setPersistenceError(null);

    void (async () => {
      try {
        const profiles = await api.listProfiles();
        const profile = profiles.find(validProfile);
        if (!profile) throw new Error('voice_profile_missing');

        const sessions = await api.listSessions(profile.id);
        const session = sessions.find(validSession);
        if (!session) throw new Error('voice_session_missing');

        if (!active) return;
        setProfileId(profile.id);
        setSessionId(session.id);
        setChallengeVerified(Boolean(session.challenge_verified));

        if (api.listConsents) {
          const consents = await api.listConsents(profile.id);
          if (!active) return;
          setConsentAccepted(consents.some((consent) => !consent.revoked_at));
        }

        if (api.listSamples) {
          const persisted = await api.listSamples(session.id);
          if (!active) return;
          const restored = emptySamples();
          for (const sample of persisted) {
            if (restored[sample.phrase_id] && sample.status === 'accepted') {
              restored[sample.phrase_id] = { id: sample.id, status: 'accepted', persisted: true };
            }
          }
          setSamples(restored);
          const firstMissing = phrases.findIndex((phrase) => restored[phrase.id].status !== 'accepted');
          setCurrentPhraseIndex(firstMissing >= 0 ? firstMissing : phrases.length - 1);
        }
      } catch {
        if (active) setPersistenceError('No se encontró una sesión de Personal Voice que pueda continuar.');
      } finally {
        if (active) setHydrating(false);
      }
    })();

    return () => { active = false; };
  }, [api, initialProfileId, initialSessionId, initialStep]);


  useEffect(() => {
    if (initialStep !== 'generate' || !profileId || !sessionId || !api.providerStatus) return;

    let active = true;
    setProviderMessage(null);

    void (async () => {
      try {
        const [status, providerPhrases, persisted] = await Promise.all([
          api.providerStatus!(),
          api.providerConsentPhrases ? api.providerConsentPhrases() : Promise.resolve([]),
          api.listSamples ? api.listSamples(sessionId) : Promise.resolve([])
        ]);
        if (!active) return;
        setProviderStatus(status);
        const spanish = providerPhrases.find((phrase) => phrase.language.toLowerCase().startsWith('es'));
        setProviderConsentPhrase((spanish || providerPhrases[0])?.text || '');

        const providerConsent = persisted.find((sample) => sample.phrase_id === 'provider-consent' && sample.status === 'accepted');
        const providerReference = persisted.find((sample) => sample.phrase_id === 'provider-reference' && sample.status === 'accepted');
        setProviderConsentSampleId(providerConsent?.id || '');
        setProviderReferenceSampleId(providerReference?.id || '');

        if (status.state !== 'ready') {
          setProviderMessage('OpenAI Custom Voice todavía no está habilitado para este proyecto de API.');
        } else if (!((spanish || providerPhrases[0])?.text)) {
          setProviderMessage('El proveedor está disponible, pero no devolvió una frase de consentimiento utilizable.');
        }
      } catch {
        if (active) {
          setProviderStatus({
            ok: false,
            provider: 'openai_custom_voice',
            state: 'provider_unavailable'
          });
          setProviderMessage('ATLAS no pudo verificar el proveedor de voz.');
        }
      }
    })();

    return () => { active = false; };
  }, [api, initialStep, profileId, sessionId]);

  async function beginSetup() {
    if (!consentAccepted || busy) return;
    setBusy(true);
    setPersistenceError(null);
    try {
      const profile = await api.createProfile({ name: 'Mi voz ATLAS', language: 'es-US' });
      const session = await api.createSession(profile.id);
      await api.saveConsent({
        profileId: profile.id,
        consentVersion: 'personal-voice-v1',
        scope: {
          purpose: 'personal_voice_creation',
          owner_attestation: true,
          provider_generation_authorized: false
        }
      });
      await api.appendAuditEvent(profile.id, 'voice.consent.accepted', {
        consent_version: 'personal-voice-v1'
      });
      await api.updateSession(session.id, {
        status: 'sound_check',
        current_step: 'sound_check'
      });
      setProfileId(profile.id);
      setSessionId(session.id);
      navigate(routeForStep('sound-check'));
    } catch {
      setPersistenceError('ATLAS no pudo iniciar la sesión de voz. No se guardó ningún audio.');
    } finally {
      setBusy(false);
    }
  }

  async function checkMicrophone(): Promise<MicrophonePermission> {
    setMicrophoneError(null);
    const permission = await mic.requestPermission();
    setMicrophonePermission(permission);
    if (permission === 'denied') setMicrophoneError('El acceso al micrófono es necesario para crear una voz personal.');
    if (permission === 'unavailable') setMicrophoneError('El micrófono no está disponible en este navegador o dispositivo.');
    return permission;
  }

  async function startSoundCheck() {
    setMicrophoneError(null);
    setSoundCheckAssessment(null);
    const permission = microphonePermission === 'unchecked' ? await checkMicrophone() : microphonePermission;
    if (permission !== 'granted') return;
    try {
      await mic.start();
      setRecording(true);
    } catch {
      setMicrophoneError('ATLAS no pudo iniciar la prueba de sonido.');
    }
  }

  async function stopSoundCheck() {
    try {
      const result = await mic.stop();
      const assessment = assessVoiceQuality(result.stats);
      setLastStats(result.stats);
      setSoundCheckAssessment(assessment);
      if (assessment.status !== 'accepted') {
        setMicrophoneError('La calidad necesita ajustes. Reduce el ruido o corrige el volumen y vuelve a intentarlo.');
      } else {
        setMicrophoneError(null);
      }
    } catch {
      setMicrophoneError('ATLAS no pudo finalizar la prueba de sonido.');
    } finally {
      setRecording(false);
    }
  }

  async function continueFromSoundCheck() {
    if (soundCheckAssessment?.status !== 'accepted' || !sessionId) return;
    setBusy(true);
    try {
      await api.updateSession(sessionId, { status: 'recording', current_step: 'record' });
      navigate(routeForStep('record'));
    } catch {
      setPersistenceError('ATLAS no pudo guardar el avance de la sesión.');
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setMicrophoneError(null);
    try {
      await mic.start();
      setRecording(true);
    } catch {
      setMicrophoneError('El micrófono no está disponible para esta grabación.');
    }
  }

  async function stopRecording() {
    const phrase = phrases[currentPhraseIndex];
    try {
      const result = await mic.stop();
      const assessment = assessVoiceQuality(result.stats);
      setLastStats(result.stats);

      if (assessment.status !== 'accepted') {
        setSamples((current) => ({
          ...current,
          [phrase.id]: { status: 'needs_retry', blob: result.blob, stats: result.stats, assessment }
        }));
        return;
      }

      if (!profileId || !sessionId) throw new Error('voice_session_missing');

      const nextAcceptedCount = samples[phrase.id]?.status === 'accepted' ? acceptedCount : acceptedCount + 1;
      const nextChallengeVerified = challengeVerified || phrase.id === 'challenge';

      const persistedSample = await api.saveAcceptedSample({
        profileId,
        sessionId,
        phraseId: phrase.id,
        attempt: 1,
        blob: result.blob,
        stats: result.stats,
        assessment
      });

      await api.updateSession(sessionId, {
        status: 'recording',
        current_step: 'record',
        accepted_sample_count: nextAcceptedCount,
        challenge_verified: nextChallengeVerified
      });

      await api.appendAuditEvent(profileId, 'voice.sample.accepted', {
        phrase_id: phrase.id,
        accepted_sample_count: nextAcceptedCount
      });

      setSamples((current) => ({
        ...current,
        [phrase.id]: {
          id: String((persistedSample as { id?: string }).id || ''),
          status: 'accepted',
          persisted: true,
          blob: result.blob,
          stats: result.stats,
          assessment
        }
      }));
      if (phrase.id === 'challenge') setChallengeVerified(true);
    } catch {
      setPersistenceError('La muestra no pudo guardarse de forma segura. Vuelve a grabarla.');
      setSamples((current) => ({
        ...current,
        [phrase.id]: { status: 'needs_retry' }
      }));
    } finally {
      setRecording(false);
    }
  }

  function replayCurrent() {
    const blob = samples[phrases[currentPhraseIndex].id]?.blob;
    if (!blob || typeof Audio === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    void audio.play().catch(() => URL.revokeObjectURL(url));
  }

  function retryCurrent() {
    const phrase = phrases[currentPhraseIndex];
    if (samples[phrase.id]?.persisted) return;
    setSamples((current) => ({ ...current, [phrase.id]: { status: 'missing' } }));
  }

  async function acceptAndAdvance() {
    if (samples[phrases[currentPhraseIndex].id]?.status !== 'accepted') return;
    if (currentPhraseIndex < phrases.length - 1) {
      setCurrentPhraseIndex((index) => index + 1);
      return;
    }
    if (!sessionId) return;
    setBusy(true);
    try {
      await api.updateSession(sessionId, {
        status: 'reviewing',
        current_step: 'review',
        accepted_sample_count: phrases.length,
        challenge_verified: challengeVerified
      });
      navigate(routeForStep('review'));
    } catch {
      setPersistenceError('ATLAS no pudo abrir la revisión porque el progreso no se guardó.');
    } finally {
      setBusy(false);
    }
  }

  async function finishReview() {
    if (!sessionId || !reviewComplete || !challengeVerified) return;
    setBusy(true);
    try {
      await api.updateSession(sessionId, {
        status: 'complete',
        current_step: 'generate',
        accepted_sample_count: phrases.length,
        challenge_verified: true
      });
      if (profileId) {
        await api.appendAuditEvent(profileId, 'voice.recording.complete', {
          accepted_sample_count: phrases.length,
          generation_provider: 'not_configured'
        });
      }
      navigate(routeForStep('generate'));
    } catch {
      setPersistenceError('ATLAS no pudo cerrar la revisión.');
    } finally {
      setBusy(false);
    }
  }


  async function startProviderRecording(kind: 'consent' | 'reference') {
    setProviderMessage(null);
    const permission = microphonePermission === 'granted'
      ? 'granted'
      : await checkMicrophone();
    if (permission !== 'granted') return;

    try {
      await mic.start();
      setProviderRecordingStartedAt(Date.now());
      setProviderRecording(kind);
    } catch {
      setProviderMessage('ATLAS no pudo iniciar la grabación del proveedor.');
    }
  }

  async function stopProviderRecording() {
    if (!providerRecording || !profileId || !sessionId) return;
    const kind = providerRecording;
    try {
      const result = await mic.stop();
      const durationMs = Math.max(0, Date.now() - providerRecordingStartedAt);
      const assessment = assessVoiceQuality(result.stats);
      if (assessment.status !== 'accepted') {
        setProviderMessage('La grabación no pasó el control acústico. Repite la muestra.');
        return;
      }
      if (kind === 'reference' && (durationMs < 5000 || durationMs > 30000)) {
        setProviderMessage('La muestra de referencia debe durar entre 5 y 30 segundos.');
        return;
      }

      const saved = await api.saveAcceptedSample({
        profileId,
        sessionId,
        phraseId: kind === 'consent' ? 'provider-consent' : 'provider-reference',
        attempt: 1,
        blob: result.blob,
        durationMs,
        stats: result.stats,
        assessment
      });
      const id = String((saved as { id?: string }).id || '');
      if (!id) throw new Error('voice_sample_id_missing');
      if (kind === 'consent') setProviderConsentSampleId(id);
      else setProviderReferenceSampleId(id);
      setProviderMessage(kind === 'consent'
        ? 'Consentimiento de voz guardado de forma privada.'
        : 'Muestra de referencia guardada de forma privada.');
    } catch {
      setProviderMessage('ATLAS no pudo guardar la grabación del proveedor.');
    } finally {
      setProviderRecording(null);
      setProviderRecordingStartedAt(0);
    }
  }

  async function generateProviderVoice() {
    if (
      !profileId
      || !providerAuthorized
      || providerStatus?.state !== 'ready'
      || !providerConsentSampleId
      || !providerReferenceSampleId
      || !api.createProviderConsent
      || !api.createProviderVoice
    ) return;

    setBusy(true);
    setProviderMessage('Creando consentimiento verificable con el proveedor…');
    try {
      await api.saveConsent({
        profileId,
        consentVersion: 'openai-custom-voice-v1',
        scope: {
          purpose: 'personal_voice_generation',
          owner_attestation: true,
          provider: 'openai_custom_voice',
          provider_generation_authorized: true
        }
      });
      await api.createProviderConsent(profileId, providerConsentSampleId);
      setProviderMessage('Consentimiento verificado. Creando la voz…');
      await api.createProviderVoice(profileId, providerReferenceSampleId);
      await api.appendAuditEvent(profileId, 'voice.provider.generation.completed', {
        provider: 'openai_custom_voice'
      });
      setVoiceCreated(true);
      setProviderMessage('Voz creada. ATLAS ya puede utilizarla en los destinos autorizados.');
    } catch {
      setProviderMessage('La generación no pudo completarse. ATLAS mantuvo el perfil fail-closed.');
    } finally {
      setBusy(false);
    }
  }

  if (hydrating) {
    return (
      <section className="voice-wizard" aria-live="polite">
        <p className="eyebrow">ATLAS Personal Voice</p>
        <h1>Recuperando sesión segura…</h1>
      </section>
    );
  }

  if (persistenceError && initialStep !== 'setup' && !profileId) {
    return (
      <section className="voice-wizard">
        <p className="eyebrow">ATLAS Personal Voice</p>
        <h1>No hay una sesión activa</h1>
        <div className="voice-alert" role="alert">{persistenceError}</div>
        <Link className="primary-action voice-inline-action" to="/voice/personal-voice/setup">Crear una nueva voz</Link>
      </section>
    );
  }

  if (initialStep === 'setup') {
    return (
      <section className="voice-wizard" aria-labelledby="voice-setup-heading">
        <WizardHeader step="1 de 5" title="Prepárate para grabar" id="voice-setup-heading" />
        <div className="voice-prep-grid">
          <PrepTip title="Busca un lugar tranquilo">Reduce conversaciones, ventiladores y ruido constante antes de empezar.</PrepTip>
          <PrepTip title="Habla con naturalidad">Usa tu volumen y ritmo normales; no intentes imitar otra voz.</PrepTip>
          <PrepTip title="Concéntrate en la frase">Lee cada oración completa y repítela si ATLAS detecta problemas de calidad.</PrepTip>
        </div>
        <label className="voice-consent">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => setConsentAccepted(event.target.checked)}
          />
          <span>Soy propietario de esta voz y autorizo a ATLAS a guardar estas muestras para crear mi Personal Voice.</span>
        </label>
        {persistenceError ? <div className="voice-alert" role="alert">{persistenceError}</div> : null}
        <div className="voice-actions">
          <Link className="text-link" to="/voice/personal-voice">Cancelar</Link>
          <button type="button" className="primary-action" disabled={!consentAccepted || busy} onClick={() => void beginSetup()}>
            {busy ? 'Guardando…' : 'Continuar'}
          </button>
        </div>
      </section>
    );
  }

  if (initialStep === 'sound-check') {
    const ready = microphonePermission === 'granted' && soundCheckAssessment?.status === 'accepted';
    return (
      <section className="voice-wizard" aria-labelledby="voice-sound-heading">
        <WizardHeader step="2 de 5" title="Comprueba la calidad del sonido" id="voice-sound-heading" />
        <p>Graba la frase. ATLAS analizará nivel, saturación, silencio, ruido de fondo y estabilidad.</p>
        <div className="voice-device-pill">Micrófono del dispositivo</div>
        <div className="voice-phrase-card">
          <span>Frase de prueba</span>
          <blockquote>Estoy creando una voz personal con ATLAS.</blockquote>
        </div>
        <Waveform active={recording} />
        {microphoneError ? <div className="voice-alert" role="alert">{microphoneError}</div> : null}
        {persistenceError ? <div className="voice-alert" role="alert">{persistenceError}</div> : null}
        <div className="voice-check-list">
          <CheckRow label="Micrófono" value={microphonePermission === 'granted' ? 'Aprobado' : microphonePermission === 'unchecked' ? 'Sin comprobar' : 'No disponible'} />
          <CheckRow label="Saturación" value={lastStats ? (lastStats.peak < 0.98 ? 'Aprobada' : 'Ajustar') : 'Pendiente'} />
          <CheckRow label="Ruido de fondo" value={lastStats ? (lastStats.noiseFloor <= 0.08 ? 'Aprobado' : 'Ajustar') : 'Pendiente'} />
          <CheckRow label="Volumen" value={lastStats ? (lastStats.rms >= 0.04 ? 'Aprobado' : 'Ajustar') : 'Pendiente'} />
          <CheckRow label="Calidad general" value={soundCheckAssessment ? (soundCheckAssessment.status === 'accepted' ? 'Aprobada' : 'Repetir') : 'Pendiente'} />
        </div>
        <div className="voice-record-controls">
          <button type="button" className="record-action" disabled={recording} onClick={() => void startSoundCheck()}>Iniciar</button>
          <button type="button" className="secondary-action" disabled={!recording} onClick={() => void stopSoundCheck()}>Finalizar</button>
        </div>
        <div className="voice-actions">
          <button type="button" className="secondary-action" onClick={() => navigate(routeForStep('setup'))}>Atrás</button>
          <button type="button" className="primary-action" disabled={!ready || busy} onClick={() => void continueFromSoundCheck()}>Continuar</button>
        </div>
      </section>
    );
  }

  if (initialStep === 'record') {
    const phrase = phrases[currentPhraseIndex];
    const sample = samples[phrase.id];
    return (
      <section className="voice-wizard" aria-labelledby="voice-record-heading">
        <WizardHeader step="3 de 5" title="Lee la frase" id="voice-record-heading" />
        <div className="voice-record-meta">
          <strong>{currentPhraseIndex + 1} de {phrases.length}</strong>
          <span>Grabación guiada</span>
        </div>
        <progress aria-label="Progreso de grabación" max={phrases.length} value={acceptedCount} />
        <div className="voice-phrase-card">
          <span>{phrase.id === 'challenge' ? 'Verificación de propiedad' : `Frase ${currentPhraseIndex + 1}`}</span>
          <blockquote>{phrase.text}</blockquote>
          <strong role="status">{statusLabel(sample.status)}</strong>
          {sample.assessment?.reasons.length ? (
            <small>{sample.assessment.reasons.map(qualityReason).join(' · ')}</small>
          ) : null}
        </div>
        <Waveform active={recording} />
        {microphoneError ? <div className="voice-alert" role="alert">{microphoneError}</div> : null}
        {persistenceError ? <div className="voice-alert" role="alert">{persistenceError}</div> : null}
        <div className="voice-record-controls">
          <button type="button" className="record-action" disabled={recording || sample.persisted} onClick={() => void startRecording()}>Grabar</button>
          <button type="button" className="secondary-action" disabled={!recording} onClick={() => void stopRecording()}>Detener</button>
          <button type="button" className="secondary-action" disabled={!sample.blob || recording} onClick={replayCurrent}>Reproducir</button>
          <button type="button" className="secondary-action" disabled={sample.status === 'missing' || sample.persisted || recording} onClick={retryCurrent}>Repetir</button>
          <button type="button" className="primary-action" disabled={sample.status !== 'accepted' || recording || busy} onClick={() => void acceptAndAdvance()}>
            {currentPhraseIndex === phrases.length - 1 ? 'Revisar muestras' : 'Aceptar y continuar'}
          </button>
        </div>
      </section>
    );
  }

  if (initialStep === 'review') {
    return (
      <section className="voice-wizard" aria-labelledby="voice-review-heading">
        <WizardHeader step="4 de 5" title="Revisa tus grabaciones" id="voice-review-heading" />
        <p>ATLAS solo considera completas las muestras que pasaron calidad y quedaron persistidas en el bucket privado.</p>
        <div className="voice-review-list">
          {phrases.map((phrase, index) => (
            <div key={phrase.id}>
              <span>{phrase.id === 'challenge' ? 'Propiedad' : `Frase ${index + 1}`}</span>
              <strong>{statusLabel(samples[phrase.id].status)}</strong>
            </div>
          ))}
        </div>
        {!challengeVerified ? <div className="voice-alert" role="alert">Falta una verificación válida de propiedad.</div> : null}
        {persistenceError ? <div className="voice-alert" role="alert">{persistenceError}</div> : null}
        <div className="voice-actions">
          <button type="button" className="secondary-action" onClick={() => navigate(routeForStep('record'))}>Volver a grabar</button>
          <button type="button" className="primary-action" disabled={!reviewComplete || !challengeVerified || busy} onClick={() => void finishReview()}>
            Finalizar grabación
          </button>
        </div>
      </section>
    );
  }

  const providerReady = providerStatus?.state === 'ready';
  const providerSamplesReady = Boolean(providerConsentSampleId && providerReferenceSampleId);
  const generationReady = providerReady
    && providerSamplesReady
    && providerAuthorized
    && Boolean(providerConsentPhrase)
    && Boolean(api.createProviderConsent)
    && Boolean(api.createProviderVoice);

  return (
    <section className="voice-wizard" aria-labelledby="voice-generate-heading">
      <WizardHeader step="5 de 5" title="Genera tu Personal Voice" id="voice-generate-heading" />
      <div className="voice-provider-state" role="status">
        <strong>{providerReady ? 'OpenAI Custom Voice listo' : 'OpenAI Custom Voice no disponible'}</strong>
        <p>
          {providerReady
            ? 'ATLAS verificó acceso al proveedor. El consentimiento y la muestra se enviarán únicamente cuando autorices esta generación.'
            : 'ATLAS conserva tus grabaciones privadas, pero no generará una voz hasta que el proyecto tenga acceso real al proveedor.'}
        </p>
      </div>

      {providerReady ? (
        <>
          <div className="voice-phrase-card">
            <span>Consentimiento del proveedor</span>
            <blockquote>{providerConsentPhrase || 'Frase de consentimiento no disponible.'}</blockquote>
            <strong>{providerConsentSampleId ? 'Grabación guardada' : 'Pendiente de grabar'}</strong>
          </div>
          <div className="voice-record-controls">
            <button
              type="button"
              className="record-action"
              disabled={Boolean(providerRecording) || Boolean(providerConsentSampleId) || !providerConsentPhrase}
              onClick={() => void startProviderRecording('consent')}
            >
              Consentir
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={providerRecording !== 'consent'}
              onClick={() => void stopProviderRecording()}
            >
              Finalizar consentimiento
            </button>
          </div>

          <div className="voice-phrase-card">
            <span>Muestra de referencia · 5–30 segundos</span>
            <blockquote>{providerReferenceText}</blockquote>
            <strong>{providerReferenceSampleId ? 'Muestra guardada' : 'Pendiente de grabar'}</strong>
          </div>
          <div className="voice-record-controls">
            <button
              type="button"
              className="record-action"
              disabled={Boolean(providerRecording) || Boolean(providerReferenceSampleId)}
              onClick={() => void startProviderRecording('reference')}
            >
              Muestra
            </button>
            <button
              type="button"
              className="secondary-action"
              disabled={providerRecording !== 'reference'}
              onClick={() => void stopProviderRecording()}
            >
              Finalizar muestra
            </button>
          </div>

          <label className="voice-consent">
            <input
              type="checkbox"
              checked={providerAuthorized}
              onChange={(event) => setProviderAuthorized(event.target.checked)}
            />
            <span>
              Autorizo a ATLAS a enviar estas dos grabaciones a OpenAI para crear una voz sintética personal
              bajo mi control y según los permisos que yo otorgue.
            </span>
          </label>
        </>
      ) : null}

      {providerMessage ? (
        <div className={voiceCreated ? 'voice-status' : 'voice-alert'} role="status">{providerMessage}</div>
      ) : null}

      <div className="voice-generation-summary">
        <span>Muestras ATLAS <strong>{phrases.length}</strong></span>
        <span>Consentimiento provider <strong>{providerConsentSampleId ? 'Listo' : 'Pendiente'}</strong></span>
        <span>Referencia provider <strong>{providerReferenceSampleId ? 'Lista' : 'Pendiente'}</strong></span>
        <span>Apple bridge <strong>Verificación nativa separada</strong></span>
      </div>
      <div className="voice-actions">
        <Link className="secondary-action" to="/voice/personal-voice">Volver a Mis voces</Link>
        <button
          type="button"
          className="primary-action"
          disabled={!generationReady || busy || voiceCreated}
          onClick={() => void generateProviderVoice()}
        >
          {busy ? 'Generando…' : voiceCreated ? 'Voz creada' : 'Generar voz'}
        </button>
      </div>
    </section>
  );
}

function WizardHeader({ step, title, id }: { step: string; title: string; id: string }) {
  return (
    <header className="voice-wizard-header">
      <p className="eyebrow">Personal Voice · {step}</p>
      <h1 id={id}>{title}</h1>
    </header>
  );
}

function PrepTip({ title, children }: { title: string; children: string }) {
  return (
    <article className="voice-prep-tip">
      <span aria-hidden="true">✓</span>
      <div><strong>{title}</strong><p>{children}</p></div>
    </article>
  );
}

function CheckRow({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}

function Waveform({ active }: { active: boolean }) {
  return (
    <div className={`voice-capture-waveform ${active ? 'active' : ''}`} aria-label={active ? 'Grabando' : 'En espera'}>
      {Array.from({ length: 24 }, (_, index) => <span key={index} />)}
    </div>
  );
}
