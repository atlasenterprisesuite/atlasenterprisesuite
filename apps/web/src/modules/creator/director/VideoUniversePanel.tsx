import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  VIDEO_MODES,
  VIDEO_PROVIDERS,
  catalogVideoCandidates,
  compileVideoUniverseDraft,
  type VideoMode,
  type VideoProviderId,
  type VideoUniverseDraftInput
} from '../../../../../../packages/creator/video_universe';
import type { ProductionSpec, ProviderReadiness } from '../../../../../../packages/creator/types';
import './video-universe.css';

export type VideoUniversePanelProps = {
  spec: ProductionSpec;
  providers: ProviderReadiness[];
  nativeReadinessState: 'ready' | 'loading' | 'error';
};

export function VideoUniversePanel({ spec, providers, nativeReadinessState }: VideoUniversePanelProps) {
  const [mode, setMode] = useState<VideoMode>('timeline-edit');
  const [providerId, setProviderId] = useState<VideoProviderId>('atlas-native');
  const [title, setTitle] = useState(spec.title || 'ATLAS original production');
  const [brief, setBrief] = useState(spec.brief || '');
  const [sourceIds, setSourceIds] = useState('');
  const [language, setLanguage] = useState<'es' | 'en'>('es');
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9' | '1:1'>(
    spec.aspectRatio === '9:16' || spec.aspectRatio === '16:9' || spec.aspectRatio === '1:1'
      ? spec.aspectRatio : '9:16'
  );
  const [subtitles, setSubtitles] = useState(true);
  const [transcript, setTranscript] = useState(true);
  const [rightsReviewed, setRightsReviewed] = useState(false);
  const [notice, setNotice] = useState('');

  const modeDefinition = VIDEO_MODES.find(item => item.id === mode)!;
  const runtimeSignals = providers.map(provider => ({
    providerId: provider.providerId,
    connectionState: provider.connectionState,
    lastVerifiedAt: provider.lastVerifiedAt
  }));
  const choices = catalogVideoCandidates(mode, runtimeSignals, nativeReadinessState === 'ready');
  const selected = choices.find(item => item.id === providerId) || choices[0];
  const manifest = useMemo(() => {
    const input: VideoUniverseDraftInput = {
      mode,
      providerId: selected.id,
      title,
      brief,
      language,
      aspectRatio,
      sourceAssetIds: sourceIds.split(/[\n,]/).map(value => value.trim()).filter(Boolean),
      subtitles,
      transcript,
      rightsVerified: rightsReviewed
    };
    try {
      return { value: compileVideoUniverseDraft(input), error: '' };
    } catch (error) {
      return { value: null, error: error instanceof Error ? error.message : 'video_draft_invalid' };
    }
  }, [mode, selected.id, title, brief, language, aspectRatio, sourceIds, subtitles, transcript, rightsReviewed]);

  function changeMode(next: VideoMode) {
    setMode(next);
    const nextProvider = VIDEO_PROVIDERS.find(item => item.modes.includes(next));
    if (nextProvider) setProviderId(nextProvider.id);
    setNotice('');
  }

  async function copyPlan() {
    if (!manifest.value) return;
    if (!navigator?.clipboard?.writeText) {
      setNotice('Clipboard unavailable. Use the read-only JSON field below.');
      return;
    }
    try {
      await navigator.clipboard.writeText(JSON.stringify(manifest.value, null, 2));
      setNotice('Local draft copied. No generation or provider request was submitted.');
    } catch {
      setNotice('Clipboard permission was denied. Use the read-only JSON field below.');
    }
  }

  function exportPlan() {
    if (!manifest.value) return;
    const blob = new Blob([JSON.stringify(manifest.value, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'atlas-video-universe-' + mode + '.json';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    setNotice('Local JSON draft exported; no media was rendered or uploaded.');
  }

  return <section className="video-universe" aria-labelledby="video-universe-heading">
    <header className="video-universe-heading">
      <div><p className="eyebrow">ATLAS Studio · First-party production control</p>
        <h3 id="video-universe-heading">ATLAS Video Universe</h3>
        <p>One original creative brief, many optional engines. Select workflows, compare disclosed capabilities and export a reusable production plan. No provider is connected merely because it appears here.</p>
      </div>
      <span className="video-universe-pill">Planning only · zero render charges</span>
    </header>

    <div className="video-universe-links" aria-label="Existing production workspaces">
      <Link to="/studio/library">Creator Library</Link>
      <Link to="/studio/voice">Voice Lab</Link>
      <Link to="/studio/teleprompter">Teleprompter</Link>
      <Link to="/studio/providers">Provider readiness</Link>
    </div>

    <div className="video-universe-grid">
      <div className="video-universe-main">
        <label htmlFor="atlas-video-mode">Production workflow</label>
        <select id="atlas-video-mode" value={mode} onChange={event => changeMode(event.target.value as VideoMode)}>
          {VIDEO_MODES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
        </select>
        <p className="video-universe-help">{modeDefinition.description}</p>

        <fieldset className="video-universe-providers">
          <legend>Compatible engines · catalog, not connection status</legend>
          {choices.map(choice => <label key={choice.id} className={'video-universe-provider ' + (selected.id === choice.id ? 'selected' : '')}>
            <input type="radio" name="atlas-video-provider" value={choice.id} checked={selected.id === choice.id}
              onChange={() => { setProviderId(choice.id); setNotice(''); }} />
            <span><strong>{choice.label}</strong><small>{choice.kind} · {choice.integration}</small>
              <small>{choice.runtimeObservation === 'native-runtime-reported-ready'
                ? 'Native runtime reported ready; Director render gates still apply'
                : choice.runtimeObservation === 'provider-readiness-reported'
                  ? 'Provider readiness reported; external adapter still unverified'
                  : 'Not connected to an executable ATLAS adapter'}</small></span>
          </label>)}
        </fieldset>
        <p className="video-universe-help">{selected.note}</p>
        <a href={selected.reference} target="_blank" rel="noopener noreferrer" className="video-universe-reference">
          {selected.id === 'atlas-native' ? 'Open ATLAS Native workflow' : 'Provider documentation'}
        </a>
      </div>

      <form className="video-universe-form" onSubmit={event => { event.preventDefault(); exportPlan(); }}>
        <h4>Original ATLAS production brief</h4>
        <label htmlFor="atlas-video-title">Production title</label>
        <input id="atlas-video-title" value={title} maxLength={140} onChange={event => setTitle(event.target.value)} />
        <label htmlFor="atlas-video-brief">Creative brief / exact narration</label>
        <textarea id="atlas-video-brief" value={brief} rows={5} onChange={event => setBrief(event.target.value)}
          placeholder="Describe what the video should communicate, without adding private credentials or personal data." />
        <label htmlFor="atlas-video-sources">Approved ATLAS asset IDs (optional until render)</label>
        <input id="atlas-video-sources" value={sourceIds} onChange={event => setSourceIds(event.target.value)}
          placeholder="Asset IDs separated by commas" />
        <p className="video-universe-help">IDs are references only. This panel does not read, upload or verify the assets.</p>
        <div className="video-universe-options">
          <label>Script language
            <select value={language} onChange={event => setLanguage(event.target.value as 'es' | 'en')}>
              <option value="es">Español</option><option value="en">English</option>
            </select>
          </label>
          <label>Output aspect ratio
            <select value={aspectRatio} onChange={event => setAspectRatio(event.target.value as '9:16' | '16:9' | '1:1')}>
              <option value="9:16">9:16 · Vertical</option><option value="16:9">16:9 · Horizontal</option>
              <option value="1:1">1:1 · Square</option>
            </select>
          </label>
        </div>
        <div className="video-universe-checks">
          <label><input type="checkbox" checked={subtitles} onChange={event => setSubtitles(event.target.checked)} /> Include caption deliverable</label>
          <label><input type="checkbox" checked={transcript} onChange={event => setTranscript(event.target.checked)} /> Include transcript deliverable</label>
          <label><input type="checkbox" checked={rightsReviewed} onChange={event => setRightsReviewed(event.target.checked)} /> I have reviewed source media rights (not verification)</label>
        </div>
        <p className="video-universe-guard" role="note">
          {modeDefinition.biometricConsent ? 'P0: subject/voice consent must be provider-verified before render. ' : ''}
          All providers require server-verified identity, tenant permissions, credits and idempotency before execution. AI-generated content must be disclosed.
        </p>
        {manifest.error ? <p role="alert" className="video-universe-error">{manifest.error}</p> : null}
        {manifest.value ? <>
          <label htmlFor="atlas-video-manifest">Inspectable production manifest</label>
          <textarea id="atlas-video-manifest" value={JSON.stringify(manifest.value, null, 2)} readOnly rows={7} />
          <div className="video-universe-actions">
            <button type="button" className="director-action secondary" onClick={copyPlan}>Copy draft</button>
            <button type="submit" className="director-action">Export JSON draft</button>
          </div>
        </> : null}
        {notice && <p role="status">{notice}</p>}
      </form>
    </div>
  </section>;
}
