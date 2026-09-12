import { useEffect, useMemo, useReducer, useState } from 'react';
import { Link } from 'react-router-dom';
import { createEmptyProductionSpec } from '../../../../../../packages/creator/defaults';
import type { CreatorReadinessResponse, ProviderReadiness, ValidationIssue } from '../../../../../../packages/creator/types';
import { validateProductionSpec } from '../../../../../../packages/creator/validator';
import { getCreatorReadiness, listCreatorProviders, saveCreatorProduction, submitCreatorProduction } from '../../../lib/creatorApi';
import { createDirectorState, directorReducer } from './directorState';
import { CreativeBriefEditor, EnvironmentEditor, SubjectEditor } from './BriefSubjectEnvironment';
import { SceneShotEditor } from './SceneShotEditor';
import { AudioEditor, CameraMotionEditor, ContinuityEditor, VisualStyleEditor } from './ContinuityStyleAudio';
import { ProviderGate } from './ProviderGate';
import { ReviewPanel } from './ReviewPanel';
import './director.css';

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
  'Provider & Cost': 'Evaluate only server-verified provider capabilities and cost evidence.',
  'Review & Generate': 'Validate the full production before any provider submission.'
};

export function DirectorWorkspace() {
  const [state, dispatch] = useReducer(directorReducer, createDirectorState(createEmptyProductionSpec()));
  const [activeStep, setActiveStep] = useState(0);
  const [readiness, setReadiness] = useState<CreatorReadinessResponse | null>(null);
  const [readinessState, setReadinessState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
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
    return <ReviewPanel spec={state.spec} providers={providers} permissions={permissions} validation={validation} submitting={submitting} onSubmit={submitProduction} />;
  }


  async function submitProduction() {
    if (!state.spec.providerPreference || submitting) return;
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
      <div><p className="eyebrow">Video Lab</p><h1>ATLAS Director</h1><p>Convert a creative brief into a governed, continuity-safe production specification before any external generation is allowed.</p></div>
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
        <div className="director-context-card"><span>Provider</span><strong>{state.spec.providerPreference || 'Not selected'}</strong></div>
        <section className={`director-validation ${validation.status}`} aria-label="Production validation">
          <div className="director-card-heading"><strong>Validation: {validation.status}</strong><span>{validation.issues.length} issue{validation.issues.length === 1 ? '' : 's'}</span></div>
          {validation.issues.slice(0, 8).map(issue => <div className={`director-issue ${issue.severity}`} key={`${issue.code}-${issue.targetId || 'root'}`}><div><strong>{issue.code}</strong><span>{issue.message}</span></div><button type="button" className="director-text-action" onClick={() => setActiveStep(ISSUE_STEP[issue.section])}>Go to section</button></div>)}
        </section>
        <p className="director-context-note">Generation stays disabled until validation, permission and server-verified provider gates pass.</p>
        {notice && <p className="director-notice" role="status">{notice}</p>}
      </aside>
    </div>
  </section>;
}
