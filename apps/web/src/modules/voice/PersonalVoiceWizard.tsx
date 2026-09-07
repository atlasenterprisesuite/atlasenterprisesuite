import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { hasPermission, type AtlasPermission } from '../../../../../packages/core/src';
import { canGenerateVoice } from '../../../../../packages/voice/src';
import { BrowserMicrophoneAdapter, type MicrophoneAdapter, type MicrophonePermission } from './browserMicrophone';
import { assessVoiceQuality, type MeasuredAudioStats, type VoiceQualityAssessment } from './quality';
import { LocalVoiceSessionStore, type StorageLike, type StoredVoiceSession } from './storage';
import { UnconfiguredAtlasVoiceProvider, type VoiceProviderAdapter, type VoiceProviderAvailability } from './providers';
import './voice.css';

type WizardStep = StoredVoiceSession['step'];
type SampleState = {
  status: 'accepted' | 'needs_retry' | 'rejected' | 'missing';
  blob?: Blob;
  stats?: MeasuredAudioStats;
  assessment?: VoiceQualityAssessment;
};

const phrases = [
  { id: 'challenge', text: 'I am creating this Personal Voice for myself, with my permission.' },
  { id: 'phrase-1', text: 'Every clear sentence helps ATLAS learn the natural rhythm of my voice.' },
  { id: 'phrase-2', text: 'I will speak at a comfortable pace in a quiet room.' },
  { id: 'phrase-3', text: 'My voice remains under my control and requires permission to be used.' }
] as const;

const defaultPermissions: AtlasPermission[] = [
  'voice.personal.read',
  'voice.personal.create',
  'voice.personal.record',
  'voice.personal.generate',
  'voice.personal.use',
  'voice.personal.delete'
];

export type PersonalVoiceWizardProps = {
  initialStep: WizardStep;
  microphone?: MicrophoneAdapter;
  provider?: VoiceProviderAdapter;
  permissions?: readonly AtlasPermission[];
  storage?: StorageLike;
};

function routeForStep(step: WizardStep) {
  return `/voice/personal-voice/${step}`;
}

function statusLabel(status: SampleState['status']) {
  if (status === 'needs_retry') return 'Needs retry';
  return status.charAt(0).toUpperCase() + status.slice(1);
}

function initialSamples(): Record<string, SampleState> {
  return Object.fromEntries(
    phrases.map((phrase) => [phrase.id, { status: 'missing' } satisfies SampleState])
  );
}

export function PersonalVoiceWizard({
  initialStep,
  microphone,
  provider,
  permissions = defaultPermissions,
  storage
}: PersonalVoiceWizardProps) {
  const navigate = useNavigate();
  const mic = useMemo(() => microphone ?? new BrowserMicrophoneAdapter(), [microphone]);
  const voiceProvider = useMemo(() => provider ?? new UnconfiguredAtlasVoiceProvider(), [provider]);
  const sessionStore = useMemo(() => {
    const selectedStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : undefined);
    return selectedStorage ? new LocalVoiceSessionStore(selectedStorage) : null;
  }, [storage]);

  const resumed = sessionStore?.load();
  const [consentAccepted, setConsentAccepted] = useState(resumed?.consentAccepted ?? false);
  const [microphonePermission, setMicrophonePermission] = useState<MicrophonePermission | 'unchecked'>('unchecked');
  const [microphoneError, setMicrophoneError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [currentPhraseIndex, setCurrentPhraseIndex] = useState(0);
  const [samples, setSamples] = useState<Record<string, SampleState>>(initialSamples);
  const [challengeVerified, setChallengeVerified] = useState(false);
  const [lastStats, setLastStats] = useState<MeasuredAudioStats | null>(null);
  const [providerAvailability, setProviderAvailability] = useState<VoiceProviderAvailability | 'checking'>('checking');
  const [generationStatus, setGenerationStatus] = useState<string | null>(null);

  const acceptedCount = phrases.filter((phrase) => samples[phrase.id]?.status === 'accepted').length;
  const reviewComplete = acceptedCount === phrases.length;
  const profileId = resumed?.profileId ?? 'personal-voice-draft';

  function persist(step: WizardStep, consent = consentAccepted) {
    sessionStore?.save({ profileId, step, consentAccepted: consent });
  }

  function go(step: WizardStep) {
    persist(step);
    navigate(routeForStep(step));
  }

  async function checkMicrophone() {
    setMicrophoneError(null);
    const result = await mic.requestPermission();
    setMicrophonePermission(result);
    if (result === 'denied') setMicrophoneError('Microphone access is required to create a Personal Voice.');
  }

  async function startRecording() {
    setMicrophoneError(null);
    try {
      await mic.start();
      setRecording(true);
    } catch {
      setMicrophoneError('The microphone is unavailable in this browser or device context.');
    }
  }

  async function stopRecording() {
    try {
      const result = await mic.stop();
      const assessment = assessVoiceQuality(result.stats);
      const phrase = phrases[currentPhraseIndex];
      setSamples((current) => ({
        ...current,
        [phrase.id]: {
          status: assessment.status,
          blob: result.blob,
          stats: result.stats,
          assessment
        }
      }));
      setLastStats(result.stats);
      if (phrase.id === 'challenge' && assessment.status === 'accepted') setChallengeVerified(true);
    } catch {
      setMicrophoneError('ATLAS could not finish this recording. Retry the sample.');
    } finally {
      setRecording(false);
    }
  }

  function replayCurrent() {
    const phrase = phrases[currentPhraseIndex];
    const blob = samples[phrase.id]?.blob;
    if (!blob || typeof Audio === 'undefined') return;
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true });
    void audio.play().catch(() => URL.revokeObjectURL(url));
  }

  function retryPhrase(index = currentPhraseIndex) {
    const phrase = phrases[index];
    if (phrase.id === 'challenge') setChallengeVerified(false);
    setSamples((current) => ({ ...current, [phrase.id]: { status: 'missing' } }));
    setCurrentPhraseIndex(index);
    go('record');
  }

  function acceptAndAdvance() {
    if (samples[phrases[currentPhraseIndex].id]?.status !== 'accepted') return;
    if (currentPhraseIndex < phrases.length - 1) {
      setCurrentPhraseIndex((index) => index + 1);
      return;
    }
    go('review');
  }

  async function evaluateProvider(): Promise<VoiceProviderAvailability> {
    const availability = await voiceProvider.availability();
    setProviderAvailability(availability);
    return availability;
  }

  async function requestGeneration() {
    const availability = await evaluateProvider();
    const eligible = canGenerateVoice({ consentAccepted, challengeVerified, sampleReviewComplete: reviewComplete });
    if (!eligible
      || !hasPermission(permissions, 'voice.personal.generate')
      || availability !== 'available'
      || !voiceProvider.capabilities.serverSynthesis) return;
    try {
      const result = await voiceProvider.createVoice({ profileId, sampleIds: phrases.map((phrase) => phrase.id) });
      setGenerationStatus(`Generation job queued: ${result.jobId}`);
    } catch {
      setGenerationStatus('Voice generation failed.');
    }
  }

  if (initialStep === 'setup') {
    return (
      <section className="voice-wizard" aria-labelledby="voice-setup-heading">
        <WizardHeader step="1 of 5" title="Create your Personal Voice" id="voice-setup-heading" />
        <p>ATLAS requires your explicit consent and a live challenge recording. Do not create a voice for another person without their authorization.</p>
        <label className="voice-consent">
          <input
            type="checkbox"
            checked={consentAccepted}
            onChange={(event) => {
              const accepted = event.target.checked;
              setConsentAccepted(accepted);
              persist('setup', accepted);
            }}
          />
          <span>I own or am authorized to create and use this voice.</span>
        </label>
        <div className="voice-actions">
          <Link className="text-link" to="/voice/personal-voice">Cancel</Link>
          <button type="button" className="primary-action" disabled={!consentAccepted} onClick={() => go('sound-check')}>Continue</button>
        </div>
      </section>
    );
  }

  if (initialStep === 'sound-check') {
    return (
      <section className="voice-wizard" aria-labelledby="voice-sound-heading">
        <WizardHeader step="2 of 5" title="Sound Check" id="voice-sound-heading" />
        <p>Use a quiet space and speak naturally. ATLAS reports only measurements that are actually available.</p>
        {microphoneError ? <div className="voice-alert" role="alert">{microphoneError}</div> : null}
        <div className="voice-check-list">
          <CheckRow label="Microphone input" value={microphonePermission === 'granted' ? 'Pass' : microphonePermission === 'unchecked' ? 'Not checked' : 'Unavailable'} />
          <CheckRow label="Clipping" value={lastStats ? (lastStats.peak < 0.98 ? 'Pass' : 'Needs attention') : 'Unavailable until recording'} />
          <CheckRow label="Background noise" value={lastStats ? (lastStats.noiseFloor <= 0.08 ? 'Pass' : 'Needs attention') : 'Unavailable until recording'} />
          <CheckRow label="Volume" value={lastStats ? (lastStats.rms >= 0.04 ? 'Pass' : 'Needs attention') : 'Unavailable until recording'} />
          <CheckRow label="Consistency" value={lastStats ? (lastStats.volumeStdDev <= 0.18 ? 'Pass' : 'Needs attention') : 'Unavailable until recording'} />
        </div>
        <button type="button" className="secondary-action" onClick={() => void checkMicrophone()}>Check microphone</button>
        <div className="voice-actions">
          <button type="button" className="secondary-action" onClick={() => go('setup')}>Back</button>
          <button type="button" className="primary-action" disabled={microphonePermission !== 'granted'} onClick={() => go('record')}>Continue</button>
        </div>
      </section>
    );
  }

  if (initialStep === 'record') {
    const phrase = phrases[currentPhraseIndex];
    const sample = samples[phrase.id];
    return (
      <section className="voice-wizard" aria-labelledby="voice-record-heading">
        <WizardHeader step="3 of 5" title="Guided Recording" id="voice-record-heading" />
        <progress aria-label="Recording progress" max={phrases.length} value={acceptedCount} />
        <p className="voice-progress-copy">{acceptedCount} / {phrases.length} accepted</p>
        <div className="voice-phrase-card">
          <span>{phrase.id === 'challenge' ? 'Ownership challenge' : `Phrase ${currentPhraseIndex + 1}`}</span>
          <blockquote>{phrase.text}</blockquote>
          <strong role="status">{statusLabel(sample.status)}</strong>
          {sample.assessment?.reasons.length ? <small>{sample.assessment.reasons.join(' · ')}</small> : null}
        </div>
        {microphoneError ? <div className="voice-alert" role="alert">{microphoneError}</div> : null}
        <div className="voice-record-controls">
          <button type="button" className="record-action" disabled={recording} onClick={() => void startRecording()}>Record</button>
          <button type="button" className="secondary-action" disabled={!recording} onClick={() => void stopRecording()}>Stop</button>
          <button type="button" className="secondary-action" disabled={!sample.blob || recording} onClick={replayCurrent}>Replay</button>
          <button type="button" className="secondary-action" disabled={sample.status === 'missing' || recording} onClick={() => retryPhrase()}>Retry</button>
          <button type="button" className="primary-action" disabled={sample.status !== 'accepted' || recording} onClick={acceptAndAdvance}>{currentPhraseIndex === phrases.length - 1 ? 'Review samples' : 'Accept'}</button>
        </div>
      </section>
    );
  }

  if (initialStep === 'review') {
    return (
      <section className="voice-wizard" aria-labelledby="voice-review-heading">
        <WizardHeader step="4 of 5" title="Quality Review" id="voice-review-heading" />
        <div className="voice-review-list">
          {phrases.map((phrase, index) => (
            <div key={phrase.id}>
              <span>{phrase.id === 'challenge' ? 'Ownership challenge' : `Phrase ${index + 1}`}</span>
              <strong>{statusLabel(samples[phrase.id].status)}</strong>
              {samples[phrase.id].status !== 'accepted' ? <button type="button" className="text-button" onClick={() => retryPhrase(index)}>Retry</button> : null}
            </div>
          ))}
        </div>
        {!challengeVerified ? <div className="voice-alert" role="alert">The ownership challenge must be recorded and accepted before generation.</div> : null}
        <div className="voice-actions">
          <button type="button" className="secondary-action" onClick={() => go('record')}>Back to recording</button>
          <button type="button" className="primary-action" disabled={!reviewComplete || !challengeVerified} onClick={() => { persist('generate'); void evaluateProvider(); navigate(routeForStep('generate')); }}>Continue</button>
        </div>
      </section>
    );
  }

  const generationPolicyReady = canGenerateVoice({ consentAccepted, challengeVerified, sampleReviewComplete: reviewComplete });
  const generationPermission = hasPermission(permissions, 'voice.personal.generate');
  const generationEnabled = generationPolicyReady
    && generationPermission
    && providerAvailability === 'available'
    && voiceProvider.capabilities.serverSynthesis;

  return (
    <section className="voice-wizard" aria-labelledby="voice-generate-heading">
      <WizardHeader step="5 of 5" title="Generate Voice" id="voice-generate-heading" />
      <div className="voice-provider-state" role="status">
        <strong>{providerAvailability === 'checking' ? 'Checking provider…' : providerAvailability === 'unavailable' ? 'Voice generation provider not configured' : providerAvailability === 'authorization_required' ? 'Provider authorization required' : 'Provider available'}</strong>
        <p>ATLAS will never mark this voice ready until a configured provider returns a verified generation result.</p>
      </div>
      {!generationPermission ? <div className="voice-alert" role="alert">Your ATLAS role does not include voice generation permission.</div> : null}
      <div className="voice-actions">
        <button type="button" className="secondary-action" onClick={() => go('review')}>Back</button>
        <button type="button" className="secondary-action" onClick={() => void evaluateProvider()}>Refresh provider</button>
        <button type="button" className="primary-action" disabled={!generationEnabled} onClick={() => void requestGeneration()}>Generate Voice</button>
      </div>
      {generationStatus ? <div role="status" className="voice-status">{generationStatus}</div> : null}
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

function CheckRow({ label, value }: { label: string; value: string }) {
  return <div><span>{label}</span><strong>{value}</strong></div>;
}
