
import { useMemo, useState } from 'react';
import {
  TAX_PROFESSIONAL_SYSTEM_AREAS,
  filingReadiness,
  stepStates,
  stepsForReturn,
  type TaxReturnCase,
  type TaxReturnKind
} from '../../../../../packages/tax-forms/src';

const returnLabels: Record<TaxReturnKind, string> = {
  '1040': 'Individual · Form 1040',
  '1065': 'Partnership · Form 1065',
  '1120-S': 'S Corporation · Form 1120-S',
  '1120': 'C Corporation · Form 1120',
  '1041': 'Estate / Trust · Form 1041'
};

function initialCase(returnKind: TaxReturnKind): TaxReturnCase {
  return {
    returnId: 'draft-return',
    taxYear: 2026,
    returnKind,
    clientDisplayName: 'New client',
    preparerDisplayName: 'Assigned preparer',
    status: 'in_progress',
    currentStepId: 'engagement',
    completedStepIds: [],
    reviewStepIds: [],
    blockedStepIds: [],
    activatedForms: [returnKind === '1040' ? 'Form 1040' : 'Form ' + returnKind],
    missingItems: [],
    diagnostics: []
  };
}

function stateLabel(state: string) {
  if (state === 'complete') return 'Complete';
  if (state === 'review') return 'Review';
  if (state === 'blocked') return 'Blocked';
  if (state === 'current') return 'Current';
  if (state === 'available') return 'Open';
  return 'Later';
}

export function ProfessionalReturnWorkspace() {
  const [returnCase, setReturnCase] = useState<TaxReturnCase>(() => initialCase('1040'));
  const steps = useMemo(() => stepsForReturn(returnCase.returnKind), [returnCase.returnKind]);
  const states = useMemo(() => stepStates(returnCase), [returnCase]);
  const current = steps.find((step) => step.id === returnCase.currentStepId) ?? steps[0];
  const currentIndex = Math.max(0, steps.findIndex((step) => step.id === current.id));
  const readiness = useMemo(() => filingReadiness(returnCase), [returnCase]);

  const moveTo = (stepId: string) => setReturnCase((currentCase) => ({ ...currentCase, currentStepId: stepId }));

  const markComplete = () => {
    setReturnCase((currentCase) => {
      const completed = Array.from(new Set([...currentCase.completedStepIds, current.id]));
      const next = steps[currentIndex + 1];
      return {
        ...currentCase,
        completedStepIds: completed,
        reviewStepIds: currentCase.reviewStepIds.filter((id) => id !== current.id),
        blockedStepIds: currentCase.blockedStepIds.filter((id) => id !== current.id),
        currentStepId: next?.id ?? current.id,
        status: next ? 'in_progress' : 'review'
      };
    });
  };

  const markReview = () => {
    setReturnCase((currentCase) => ({
      ...currentCase,
      reviewStepIds: Array.from(new Set([...currentCase.reviewStepIds, current.id])),
      completedStepIds: currentCase.completedStepIds.filter((id) => id !== current.id)
    }));
  };

  const markBlocked = () => {
    setReturnCase((currentCase) => ({
      ...currentCase,
      blockedStepIds: Array.from(new Set([...currentCase.blockedStepIds, current.id])),
      completedStepIds: currentCase.completedStepIds.filter((id) => id !== current.id)
    }));
  };

  const changeReturnKind = (kind: TaxReturnKind) => setReturnCase(initialCase(kind));

  return (
    <div className="tax-pro-workspace">
      <section className="tax-pro-toolbar">
        <div>
          <p className="eyebrow">ATLAS Tax Professional</p>
          <h2>Prepare return</h2>
          <p>One guided workspace from client intake through review, signature, e-file gate and closeout.</p>
        </div>
        <div className="tax-pro-controls">
          <label className="field">
            <span>Return type</span>
            <select value={returnCase.returnKind} onChange={(event) => changeReturnKind(event.target.value as TaxReturnKind)}>
              {Object.entries(returnLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label className="field">
            <span>Tax year</span>
            <select value={returnCase.taxYear} onChange={(event) => setReturnCase((currentCase) => ({ ...currentCase, taxYear: Number(event.target.value) }))}>
              <option value={2025}>2025</option>
              <option value={2026}>2026</option>
            </select>
          </label>
        </div>
      </section>

      <section className="tax-pro-summary">
        <div><small>Client</small><strong>{returnCase.clientDisplayName}</strong></div>
        <div><small>Preparer</small><strong>{returnCase.preparerDisplayName}</strong></div>
        <div><small>Return</small><strong>{returnLabels[returnCase.returnKind]}</strong></div>
        <div><small>Filing gate</small><strong>{readiness.ready ? 'Ready' : 'Not ready'}</strong></div>
      </section>

      <div className="tax-pro-grid">
        <aside className="tax-stepper" aria-label="Return preparation steps">
          {states.map(({ step, state }, index) => (
            <button
              type="button"
              key={step.id}
              className={'tax-step tax-step-' + state}
              onClick={() => moveTo(step.id)}
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
                <strong>Professional work surface</strong>
                <p>This panel is where the step-specific interview, document fields, worksheets and form-line mappings attach. Existing W-2, 1099 and K-1 intake pages feed this return graph rather than living as isolated screens.</p>
              </div>
              <div className="tax-pro-actions">
                <button type="button" onClick={markBlocked}>Block</button>
                <button type="button" onClick={markReview}>Needs review</button>
                <button type="button" className="primary-action" onClick={markComplete}>Complete & continue</button>
              </div>
            </div>

            <div className="tax-pro-nav-actions">
              <button type="button" disabled={currentIndex === 0} onClick={() => moveTo(steps[Math.max(0, currentIndex - 1)].id)}>Previous</button>
              <button type="button" disabled={currentIndex >= steps.length - 1} onClick={() => moveTo(steps[Math.min(steps.length - 1, currentIndex + 1)].id)}>Next</button>
            </div>
          </section>

          <section className="tax-panel">
            <div className="tax-panel-heading">
              <div><p className="eyebrow">Return graph</p><h2>Forms, diagnostics & evidence</h2></div>
              <span className={readiness.blocking ? 'tax-status review' : 'tax-status ok'}>{readiness.blocking ? 'Open issues' : 'No blocking issues'}</span>
            </div>
            <div className="tax-pro-diagnostics">
              <article><small>Activated forms</small><strong>{returnCase.activatedForms.length}</strong><p>{returnCase.activatedForms.join(', ') || 'None yet'}</p></article>
              <article><small>Incomplete steps</small><strong>{readiness.incompleteStepIds.length}</strong><p>{readiness.incompleteStepIds.slice(0, 5).join(', ') || 'None'}</p></article>
              <article><small>Review items</small><strong>{returnCase.reviewStepIds.length}</strong><p>{returnCase.reviewStepIds.join(', ') || 'None'}</p></article>
              <article><small>Blocked</small><strong>{returnCase.blockedStepIds.length}</strong><p>{returnCase.blockedStepIds.join(', ') || 'None'}</p></article>
            </div>
            {!readiness.professionalReviewComplete || !readiness.signatureComplete ? (
              <div className="notice">
                Filing remains disabled until professional review, client authorization/signature, diagnostics and provider authorization are complete.
              </div>
            ) : null}
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
