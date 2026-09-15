import { useEffect, useMemo, useReducer, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createEmptyProductionSpec } from '../../../../../../packages/creator/defaults';
import { evaluateNativeRenderGate } from '../../../../../../packages/creator/native_policy';
import type { CreatorReadinessResponse, ProviderReadiness, ValidationIssue } from '../../../../../../packages/creator/types';
import { validateProductionSpec } from '../../../../../../packages/creator/validator';
import {
  getCreatorReadiness,
  getNativeCreatorReadiness,
  listCreatorProviders,
  saveCreatorProduction,
  submitCreatorProduction,
  submitNativeCreatorProduction
} from '../../../lib/creatorApi';
import { createDirectorState, directorReducer } from './directorState';
import { CreativeBriefEditor, EnvironmentEditor, SubjectEditor } from './BriefSubjectEnvironment';
import { SceneShotEditor } from './SceneShotEditor';
import { AudioEditor, CameraMotionEditor, ContinuityEditor, VisualStyleEditor } from './ContinuityStyleAudio';
import { ProviderGate } from './ProviderGate';
import { ReviewPanel } from './ReviewPanel';
import './director.css';

type AtlasContentHandoff = {
  title?: string;
  brief?: string;
  narration?: string;
};

type AtlasDirectorLocationState = {
  atlasContentHandoff?: AtlasContentHandoff;
};

function createInitialDirectorSpec(handoff?: AtlasContentHandoff) {
  const spec = createEmptyProductionSpec();
  if (!handoff) return spec;

  if (handoff.title?.trim()) spec.title = handoff.title.trim();
  if (handoff.brief?.trim()) spec.brief = handoff.brief.trim();
  if (handoff.narration?.trim()) {
    spec.audioPlan = { ...spec.audioPlan, dialogue: [handoff.narration] };
  }
  return spec;
}

export const DIRECTOR_STEPS = [
  'Creative Brief', 'Subject / Entity', 'Environment', 'Stages & Shots',
  'Continuity', 'Visual Style', 'Camera & Motion', 'Audio',
  'Provider & Cost', 'Review & Generate'
] as const;

const ISSUE_STEP: Record<ValidationIssue['section'], number> = {
  brief: 0, subjects: 1, environment: 2, shots: 3, continuity: 4,
  style: 5, camera: 6, audio: 7, provider: 8, review: 9
};

const STEP_HELP: Record<(typeof DIRECTOR_STEPS)[number], string> = {
  'Creative Brief': 'Define the production objective and timing without inventing creative details.',
  'Subject / Entity': 'Lock subject identity, materials and allowed transformations.',
  Environment: 'Define location, atmosphere and background constraints.',
  'Stages & Shots': 'Break the production into timed scenes and ordered shots.',
  Continuity: 'Protect identity, orientation, materials, motion and object continuity.',
  'Visual Style': 'Describe the governed cinematic and surface treatment.',
  'Camera & Motion': 'Set camera, lens, movement and physicality constraints.',
  Audio: 'Plan music, ambience, effects, dialogue and synchronization.',
  'Provider & Cost': 'Evaluate server-verified external capabilities while keeping ATLAS Native as the zero-cost internal path.',
  'Review & Generate': 'Validate the full production before any internal render or external generation.'
};

export function DirectorWorkspace() {
  const location = useLocation();
  const handoff = (location.state as AtlasDirectorLocationState | null)?.atlasContentHandoff;
  const [state, dispatch] = useReducer(
    directorReducer,
    handoff,
    initialHandoff => createDirectorState(createInitialDirectorSpec(initialHandoff))
  );
  const [activeStep, setActiveStep] = useState(0);
  const [readiness, setReadiness] = useState<CreatorReadinessResponse | null>(null);
  const [readinessState, setReadinessState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nativeReadinessState, setNativeReadinessState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [nativeReadinessError, setNativeReadinessError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [nativeSubmitting, setNativeSubmitting] = useState(false);
  const [providers, setProviders] = useState<ProviderReadiness[]>([]);
  const [providerState, setProviderState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [providerError, setProviderError] = useState('');

  useEffect(() => {
    let active = true;
    getCreatorReadiness()
      .then(value => {
        if (!active) return;
        setReadiness(value);
        setReadinessState('ready');
      })
      .catch(error => {
        if (!active) return;
        setReadiness(null);
        setReadinessState('error');
        setNotice(error instanceof Error ? error.message : 'readiness_failed');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    getNativeCreatorReadiness()
      .then(value => {
        if (!active) return;
        setNativeReadinessState(value.native?.state === 'ready' ? 'ready' : 'error');
        setNativeReadinessError(value.native?.state === 'ready' ? '' : String(value.native?.state || 'native_composer_unavailable'));
      })
      .catch(error => {
        if (!active) return;
        setNativeReadinessState('error');
        setNativeReadinessError(error instanceof Error ? error.message : 'native_composer_unavailable');
      });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    listCreatorProviders()
      .then(value => {
        if (!active) return;
        setProviders(value);
        setProviderState('ready');
        setProviderError('');
      })
      .catch(error => {
        if (!active) return;
        setProviders([]);
        setProviderState('error');
        setProviderError(error instanceof Error ? error.message : 'providers_failed');
      });
    return () => { active = false; };
  }, []);

  const permissions = readiness?.permissions || [];
  const canWrite = permissions.includes('creator.admin') || permissions.includes('creator.write');
  const selectedStep = DIRECTOR_STEPS[activeStep];
  const selectedProvider = useMemo(
    () => state.spec.providerPreference ? providers.find(provider => provider.providerId === state.spec.providerPreference) || null : null,
    [providers, state.spec.providerPreference]
  );
  const validation = useMemo(
    () => validateProductionSpec(state.spec, selectedProvider?.capability || undefined),
    [state.spec, selectedProvider]
  );
  const nativeGate = useMemo(() => evaluateNativeRenderGate({
    permissions,
    dirty: state.dirty,
    validationStatus: validation.status,
    aspectRatio: state.spec.aspectRatio === 'adaptive' ? '9:16' : state.spec.aspectRatio,
    audioEnabled: state.spec.audioEnabled
  }), [permissions, state.dirty, state.spec.aspectRatio, state.spec.audioEnabled, validation.status]);
  const providerSummary = useMemo(() => {
    if (readinessState === 'loading') return 'Checking server readiness…';
    if (readinessState === 'error') return 'Provider readiness unavailable.';
    const ready = readiness?.providers.filter(provider => provider.connectionState === 'ready').length || 0;
    return `${ready} verified provider${ready === 1 ? '' : 's'} ready.`;
  }, [readiness, readinessState]);

  function renderEditor() {
    const props = { spec: state.spec, dispatch };
    if (activeStep === 0) return <CreativeBriefEditor {...props} />;
    if (activeStep === 1) return <SubjectEditor {...props} />;
    if (activeStep === 2) return <EnvironmentEditor {...props} />;
    if (activeStep === 3) return <SceneShotEditor {...props} />;
    if (activeStep === 4) return <ContinuityEditor {...props} />;
    if (activeStep === 5) return <VisualStyleEditor {...props} />;
    if (activeStep === 6) return <CameraMotionEditor {...props} />;
    if (activeStep === 7) return <AudioEditor {...props} />;
    if (activeStep === 8) return <ProviderGate providers={providers} spec={state.spec} dispatch={dispatch} loading={providerState === 'loading'} error={providerError} />;
    return <ReviewPanel
      spec={state.spec}
      providers={providers}
      permissions={permissions}
      validation={validation}
      dirty={state.dirty}
      submitting={submitting}
      nativeSubmitting={nativeSubmitting}
      nativeReadinessState={nativeReadinessState}
      nativeReadinessError={nativeReadinessError}
      onSubmit={submitProduction}
      onNativeSubmit={submitNativeProduction}
    />;
  }

  async function submitProduction() {
    if (!state.spec.providerPreference || submitting || state.dirty) return;
    setSubmitting(true);
    setNotice('Submitting production…');
    try {
      await submitCreatorProduction(state.spec.id, state.spec.providerPreference);
      setNotice('Provider accepted the production request.');
    } catch (error) {
      const value = error as Error;
      setNotice(value.message === 'provider_adapter_not_configured' ? 'provider_adapter_not_configured' : value.message || 'submit_failed');
    } finally {
      setSubmitting(false);
    }
  }

  async function submitNativeProduction() {
    if (nativeSubmitting || nativeReadinessState !== 'ready' || !nativeGate.allowed) return;
    setNativeSubmitting(true);
    setNotice('Rendering with ATLAS Native Composer…');
    try {
      await submitNativeCreatorProduction(state.spec.id, state.spec.version);
      setNotice('ATLAS Native render completed and was stored in Creator Library.');
    } catch (error) {
      const value = error as Error & { status?: number };
      setNotice(value.status === 409 ? 'version_conflict' : value.message || 'native_render_failed');
    } finally {
      setNativeSubmitting(false);
    }
  }

  async function saveDraft() {
    if (!canWrite || saving) return;
    setSaving(true);
    setNotice('Saving draft…');
    try {
      const saved = await saveCreatorProduction(state.spec, state.spec.version);
      dispatch({ type: 'save.succeeded', spec: saved });
      setNotice('Draft saved.');
    } catch (error) {
      const value = error as Error & { status?: number };
      setNotice(value.status === 409 ? 'version_conflict' : value.message || 'save_failed');
    } finally {
      setSaving(false);
    }
  }

  return <section className="creator-page director-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb">
      <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Video Lab</span><span>/</span><span>Director</span>
    </nav>
    <header className="director-header">
      <div><p className="eyebrow">Video Lab</p><h1>ATLAS Director</h1><p>Convert a creative brief into a governed production specification, then render internally at zero cost when ATLAS Native is verified ready.</p></div>
      <div className="director-header-actions">
        <span className={`director-readiness ${readinessState}`} role="status">{providerSummary}</span>
        <button className="director-action" type="button" onClick={saveDraft} disabled={!canWrite || saving}>Save draft</button>
      </div>
    </header>

    <div className="director-shell">
      <nav className="director-step-rail" aria-label="Production steps">
        <div className="director-steps">
          {DIRECTOR_STEPS.map((step, index) => <button
            key={step}
            type="button"
            className={`director-step-button ${index === activeStep ? 'active' : ''}`}
            aria-current={index === activeStep ? 'step' : undefined}
            onClick={() => setActiveStep(index)}
          ><span>{String(index + 1).padStart(2, '0')}</span>{step}</button>)}
        </div>
      </nav>

      <main className="director-main">
        <section className="director-panel" aria-labelledby="director-step-title">
          <p className="eyebrow">Step {activeStep + 1} of {DIRECTOR_STEPS.length}</p>
          <h2 id="director-step-title">{selectedStep}</h2>
          <p>{STEP_HELP[selectedStep]}</p>
          <div className="director-step-content">{renderEditor()}</div>
        </section>
        <div className="director-navigation">
          <button className="director-action secondary" type="button" disabled={activeStep === 0} onClick={() => setActiveStep(index => Math.max(0, index - 1))}>Back</button>
          <button className="director-action" type="button" disabled={activeStep === DIRECTOR_STEPS.length - 1} onClick={() => setActiveStep(index => Math.min(DIRECTOR_STEPS.length - 1, index + 1))}>Next</button>
        </div>
      </main>

      <aside className="director-context" aria-label="Director context">
        <div className="director-context-card"><span>Draft state</span><strong>{state.dirty ? 'Unsaved changes' : 'Saved / unchanged'}</strong></div>
        <div className="director-context-card"><span>Version</span><strong>{state.spec.version}</strong></div>
        <div className="director-context-card"><span>ATLAS Native</span><strong>{nativeReadinessState}</strong></div>
        <div className="director-context-card"><span>External provider</span><strong>{state.spec.providerPreference || 'Not selected'}</strong></div>
        <section className={`director-validation ${validation.status}`} aria-label="Production validation">
          <div className="director-card-heading"><strong>Validation: {validation.status}</strong><span>{validation.issues.length} issue{validation.issues.length === 1 ? '' : 's'}</span></div>
          {validation.issues.slice(0, 8).map(issue => <div className={`director-issue ${issue.severity}`} key={`${issue.code}-${issue.targetId || 'root'}`}><div><strong>{issue.code}</strong><span>{issue.message}</span></div><button type="button" className="director-text-action" onClick={() => setActiveStep(ISSUE_STEP[issue.section])}>Go to section</button></div>)}
        </section>
        <p className="director-context-note">Native render stays disabled until the current saved version, permission, validation and runtime readiness gates pass.</p>
        {notice && <p className="director-notice" role="status">{notice}</p>}
      </aside>
    </div>
  </section>;
}
