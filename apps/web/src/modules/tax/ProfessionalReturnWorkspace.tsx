
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  TAX_PROFESSIONAL_SYSTEM_AREAS,
  filingReadiness,
  stepStates,
  stepsForReturn,
  type TaxReturnCase,
  type TaxReturnKind
} from '../../../../../packages/tax-forms/src';
import {
  getTaxReturnWorkspace,
  setTaxReturnStepState,
  type TaxReturnWorkspaceData
} from '../../lib/taxApi';

const returnLabels: Record<TaxReturnKind, string> = {
  '1040': 'Individual · Form 1040',
  '1065': 'Partnership · Form 1065',
  '1120-S': 'S Corporation · Form 1120-S',
  '1120': 'C Corporation · Form 1120',
  '1041': 'Estate / Trust · Form 1041'
};

function stateLabel(state: string) {
  if (state === 'complete') return 'Complete';
  if (state === 'review') return 'Review';
  if (state === 'blocked') return 'Blocked';
  if (state === 'current') return 'Current';
  if (state === 'available') return 'Open';
  return 'Later';
}

function toCase(data: TaxReturnWorkspaceData): TaxReturnCase {
  const completedStepIds = data.steps.filter((item) => item.state === 'complete').map((item) => item.step_id);
  const reviewStepIds = data.steps.filter((item) => item.state === 'review').map((item) => item.step_id);
  const blockedStepIds = data.steps.filter((item) => item.state === 'blocked').map((item) => item.step_id);
  const activatedForms = Array.from(new Set([
    data.returnRow.return_kind === '1040' ? 'Form 1040' : 'Form ' + data.returnRow.return_kind,
    ...data.mappings.map((item) => item.form_id)
  ]));
  const openBlocking = data.diagnostics.filter((item) => item.status === 'open' && item.blocking);

  return {
    returnId: data.returnRow.id,
    taxYear: data.returnRow.tax_year,
    returnKind: data.returnRow.return_kind,
    clientDisplayName: data.client?.display_name || 'Client',
    preparerDisplayName: data.returnRow.preparer_user_id ? 'Assigned preparer' : 'Unassigned',
    status: data.returnRow.status === 'review' ? 'review' : data.returnRow.locked_at ? 'complete' : 'in_progress',
    currentStepId: data.returnRow.current_step_id,
    completedStepIds,
    reviewStepIds,
    blockedStepIds,
    activatedForms,
    missingItems: openBlocking.filter((item) => item.diagnostic_code.startsWith('MISSING_')).map((item) => item.message),
    diagnostics: openBlocking.map((item) => item.message)
  };
}

export function ProfessionalReturnWorkspace() {
  const [params] = useSearchParams();
  const returnId = params.get('returnId') || '';
  const [data, setData] = useState<TaxReturnWorkspaceData | null>(null);
  const [loading, setLoading] = useState(Boolean(returnId));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    if (!returnId) return;
    setLoading(true);
    setError('');
    try {
      setData(await getTaxReturnWorkspace(returnId));
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'tax_return_workspace_unavailable');
    } finally {
      setLoading(false);
    }
  }, [returnId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const returnCase = useMemo(() => data ? toCase(data) : null, [data]);
  const steps = useMemo(() => returnCase ? stepsForReturn(returnCase.returnKind) : [], [returnCase]);
  const states = useMemo(() => returnCase ? stepStates(returnCase) : [], [returnCase]);
  const current = returnCase ? (steps.find((step) => step.id === returnCase.currentStepId) ?? steps[0]) : null;
  const currentIndex = current ? Math.max(0, steps.findIndex((step) => step.id === current.id)) : 0;
  const readiness = useMemo(() => returnCase ? filingReadiness(returnCase) : null, [returnCase]);
  const locked = Boolean(data?.returnRow.locked_at);

  const setStep = async (stepId: string, state: 'in_progress' | 'review' | 'blocked' | 'complete') => {
    if (!returnId || locked) return;
    setWorking(true);
    setError('');
    try {
      await setTaxReturnStepState({ returnId, stepId, state });
      await refresh();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'tax_step_update_failed');
    } finally {
      setWorking(false);
    }
  };

  if (!returnId) {
    return (
      <div className="page-stack">
        <section className="tax-panel">
          <p className="eyebrow">ATLAS Tax Professional</p>
          <h2>Select a persistent return</h2>
          <p>The professional workspace no longer creates a local/demo return. Start or open a real organization-scoped return from Tax Control Center.</p>
          <div><Link className="primary-action" to="/tax/control">Open Tax Control Center</Link></div>
        </section>
      </div>
    );
  }

  if (loading && !data) {
    return <div className="empty-state"><strong>Loading return</strong><span>Reading tax facts, workpapers, diagnostics and workflow state.</span></div>;
  }

  if (error && !data) {
    return (
      <section className="tax-panel">
        <div className="notice"><strong>Return unavailable.</strong> {error}</div>
        <Link to="/tax/control">Back to Tax Control Center</Link>
      </section>
    );
  }

  if (!data || !returnCase || !current || !readiness) return null;

  const factById = new Map(data.facts.map((fact) => [fact.id, fact]));
  const openDiagnostics = data.diagnostics.filter((item) => item.status === 'open');

  return (
    <div className="tax-pro-workspace">
      <section className="tax-pro-toolbar">
        <div>
          <p className="eyebrow">ATLAS Tax Professional · Persisted Return</p>
          <h2>{returnCase.clientDisplayName}</h2>
          <p>{returnLabels[returnCase.returnKind]} · {returnCase.taxYear} · {data.returnRow.jurisdiction} · revision {data.returnRow.revision}</p>
        </div>
        <div className="tax-pro-controls">
          <Link to="/tax/control">Control Center</Link>
          <button type="button" onClick={() => void refresh()} disabled={loading || working}>Refresh</button>
        </div>
      </section>

      {error ? <div className="notice"><strong>Last operation failed.</strong> {error}</div> : null}
      {locked ? <div className="notice"><strong>Return locked.</strong> This revision has an immutable submission snapshot. Create an amendment/new revision instead of changing its tax facts.</div> : null}

      <section className="tax-pro-summary">
        <div><small>Client</small><strong>{returnCase.clientDisplayName}</strong></div>
        <div><small>Preparer</small><strong>{returnCase.preparerDisplayName}</strong></div>
        <div><small>Status</small><strong>{data.returnRow.status.replaceAll('_',' ')}</strong></div>
        <div><small>Filing gate</small><strong>{readiness.ready && !locked ? 'Workflow ready' : locked ? 'Locked snapshot' : 'Not ready'}</strong></div>
      </section>

      <div className="tax-pro-grid">
        <aside className="tax-stepper" aria-label="Return preparation steps">
          {states.map(({ step, state }, index) => (
            <button
              type="button"
              key={step.id}
              className={'tax-step tax-step-' + state}
              onClick={() => void setStep(step.id, 'in_progress')}
              disabled={working || locked}
            >
              <span className="tax-step-number">{index + 1}</span>
              <span><strong>{step.shortTitle}</strong><small>{stateLabel(state)}</small></span>
            </button>
          ))}
        </aside>

        <main className="tax-pro-main">
          <section className="tax-panel tax-step-detail">
            <div className="tax-panel-heading">
              <div>
                <p className="eyebrow">Step {currentIndex + 1} of {steps.length}</p>
                <h2>{current.title}</h2>
                <p>{current.description}</p>
              </div>
              <span className="tax-status review">Gate · {current.gate}</span>
            </div>

            <div className="tax-pro-link-grid">
              <article>
                <small>Source data</small>
                <ul>{current.sourceLinks.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
              <article>
                <small>Linked Forms / Schedules</small>
                {current.formLinks.length ? <ul>{current.formLinks.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No form activated directly at this step.</p>}
              </article>
              <article>
                <small>Outputs</small>
                <ul>{current.outputs.map((item) => <li key={item}>{item}</li>)}</ul>
              </article>
            </div>

            <div className="tax-pro-entry-surface">
              <div>
                <strong>Persistent professional work surface</strong>
                <p>Documents, normalized tax facts, calculations, workpapers and form-line mappings for this return are persisted under the active organization and preserve provenance across revisions.</p>
              </div>
              <div className="tax-pro-actions">
                <button type="button" disabled={working || locked} onClick={() => void setStep(current.id, 'blocked')}>Block</button>
                <button type="button" disabled={working || locked} onClick={() => void setStep(current.id, 'review')}>Needs review</button>
                <button type="button" className="primary-action" disabled={working || locked} onClick={() => void setStep(current.id, 'complete')}>Complete step</button>
              </div>
            </div>

            <div className="tax-pro-nav-actions">
              <button type="button" disabled={working || locked || currentIndex === 0} onClick={() => void setStep(steps[Math.max(0, currentIndex - 1)].id, 'in_progress')}>Previous</button>
              <button type="button" disabled={working || locked || currentIndex >= steps.length - 1} onClick={() => void setStep(steps[Math.min(steps.length - 1, currentIndex + 1)].id, 'in_progress')}>Next</button>
            </div>
          </section>

          <section className="tax-panel">
            <div className="tax-panel-heading">
              <div><p className="eyebrow">Return ledger</p><h2>Facts, workpapers & diagnostics</h2></div>
              <span className={openDiagnostics.some((item) => item.blocking) ? 'tax-status review' : 'tax-status ok'}>
                {openDiagnostics.some((item) => item.blocking) ? 'Blocking diagnostics' : 'No blocking diagnostics'}
              </span>
            </div>
            <div className="tax-pro-diagnostics">
              <article><small>Tax facts</small><strong>{data.facts.filter((item) => item.is_current).length}</strong><p>Current normalized ledger facts.</p></article>
              <article><small>Mappings</small><strong>{data.mappings.length}</strong><p>Source/fact to Form/Schedule destinations.</p></article>
              <article><small>Workpapers</small><strong>{data.workpapers.length}</strong><p>Reconciliations, basis, depreciation and worksheets.</p></article>
              <article><small>Diagnostics</small><strong>{openDiagnostics.length}</strong><p>{openDiagnostics.filter((item) => item.blocking).length} blocking.</p></article>
              <article><small>Documents</small><strong>{data.documents.length}</strong><p>Source documents attached to this return.</p></article>
              <article><small>Carryforwards</small><strong>{data.carryforwards.filter((item) => item.status === 'available').length}</strong><p>Available multi-year tax attributes.</p></article>
              <article><small>Snapshots</small><strong>{data.snapshots.length}</strong><p>Immutable reviewed/signature/submission snapshots.</p></article>
              <article><small>Activated forms</small><strong>{returnCase.activatedForms.length}</strong><p>{returnCase.activatedForms.slice(0,3).join(', ')}</p></article>
            </div>
          </section>

          <section className="tax-panel">
            <div className="tax-panel-heading">
              <div><p className="eyebrow">Explain this number</p><h2>Source → fact → form line</h2></div>
              <span className="tax-status ok">Provenance graph</span>
            </div>
            {data.mappings.length === 0 ? (
              <div className="empty-state"><strong>No persisted line mappings yet</strong><span>W-2/1099/K-1 import adapters will write their normalized facts and mappings here.</span></div>
            ) : (
              <div className="tax-map-list">
                {data.mappings.slice(0,12).map((mapping) => {
                  const fact = factById.get(mapping.tax_fact_id);
                  return (
                    <article className="tax-map-row" key={mapping.id}>
                      <div><small>Tax fact</small><strong>{fact?.tax_fact_key || mapping.tax_fact_id}</strong></div>
                      <span aria-hidden="true">→</span>
                      <div>
                        <small>{mapping.contribution_role}{mapping.rule_pack_version ? ' · ' + mapping.rule_pack_version : ''}</small>
                        <strong>{mapping.form_id}{mapping.destination_line ? ' · line ' + mapping.destination_line : ''}</strong>
                        <p>{mapping.destination_field}{fact?.source_field ? ' · source ' + fact.source_field : ''}</p>
                      </div>
                      {mapping.review_required ? <span className="tax-review-chip">Review</span> : <span className="tax-ok-chip">Mapped</span>}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </main>

        <aside className="tax-pro-rail">
          <section className="tax-panel">
            <p className="eyebrow">Firm control</p>
            <h3>Professional systems</h3>
            <div className="tax-pro-system-list">
              {TAX_PROFESSIONAL_SYSTEM_AREAS.map((area) => <span key={area}>{area}</span>)}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
