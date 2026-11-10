import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getAcademyCase } from '../../../../../../packages/tax-academy/src';
import { completeAcademyAttempt, startAcademyAttempt, submitAcademyAnswer } from '../../../lib/taxAcademyApi';

const stages = [
  'Filing status decision',
  'Source documents',
  'Missing evidence',
  'Form activation',
  'Calculations / workpaper',
  'Diagnostics',
  'Due diligence',
  'Review / e-file readiness'
] as const;

export function PracticalReturnRunner() {
  const { caseId = '' } = useParams();
  const practical = useMemo(() => getAcademyCase(caseId), [caseId]);
  const [attemptId, setAttemptId] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState('Not started');

  if (!practical) return <div className="academy-page"><div className="academy-warning">Practical case not found.</div><Link to="/tax/academy/practice">Return to Practice Library</Link></div>;

  const start = async () => {
    setStatus('Starting…');
    try {
      const attempt = await startAcademyAttempt({ caseId: practical.id, caseVersion: practical.version, mode: 'practice' });
      setAttemptId(attempt.id);
      setStatus('In progress');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to start attempt');
    }
  };

  const save = async (key: string, value: string) => {
    setAnswers((current) => ({ ...current, [key]: value }));
    if (!attemptId) return;
    try {
      await submitAcademyAnswer({ attemptId, questionId: key, value });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to save checkpoint');
    }
  };

  const complete = async () => {
    if (!attemptId) return;
    setStatus('Submitting…');
    try {
      await completeAcademyAttempt(attemptId);
      setStatus('Submitted for governed evaluation');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Unable to submit attempt');
    }
  };

  return (
    <div className="academy-page">
      <section className="academy-section-head">
        <div><p className="eyebrow">{practical.id} · {practical.level}</p><h1>{practical.title}</h1><p>{practical.filingStatus.toUpperCase()} · tax year {practical.taxYear} · version {practical.version}</p></div>
        <div className="academy-run-state"><span>{status}</span>{!attemptId ? <button className="academy-primary" onClick={start}>Start practical</button> : <button className="academy-primary" onClick={complete}>Submit practical</button>}</div>
      </section>

      <div className="academy-warning"><strong>Evidence-first simulation</strong><span>Do not optimize toward a refund. Route facts, forms and evidence first; critical integrity failures override score.</span></div>

      <section className="academy-runner-grid">
        {stages.map((stage, index) => (
          <article className="academy-runner-stage" key={stage}>
            <header><span>{String(index + 1).padStart(2, '0')}</span><h2>{stage}</h2></header>
            {stage === 'Filing status decision' ? (
              <select value={answers.filing_status || ''} onChange={(event) => save('filing_status', event.target.value)}><option value="">Select status</option>{['single','mfj','mfs','hoh','qss'].map((value) => <option key={value} value={value}>{value.toUpperCase()}</option>)}</select>
            ) : null}
            {stage === 'Source documents' ? <ul>{practical.sourceDocuments.map((item) => <li key={item}>{item}</li>)}</ul> : null}
            {stage === 'Missing evidence' ? <ul>{practical.evidenceGates.map((item) => <li key={item}><label><input type="checkbox" /> {item}</label></li>)}</ul> : null}
            {stage === 'Form activation' ? <div className="academy-chip-row">{practical.requiredForms.map((form) => <span key={form.formId}>{form.formId}</span>)}{practical.conditionalForms.map((form) => <span key={form.formId}>Review: {form.formId}</span>)}</div> : null}
            {stage === 'Calculations / workpaper' ? <textarea value={answers.workpaper || ''} onChange={(event) => save('workpaper', event.target.value)} placeholder="Document calculations, dependencies and source-to-line reasoning…" /> : null}
            {stage === 'Diagnostics' ? <textarea value={answers.diagnostics || ''} onChange={(event) => save('diagnostics', event.target.value)} placeholder="List warnings, blocking diagnostics and unresolved tax-year issues…" /> : null}
            {stage === 'Due diligence' ? <textarea value={answers.due_diligence || ''} onChange={(event) => save('due_diligence', event.target.value)} placeholder="Document questions asked and evidence relied upon…" /> : null}
            {stage === 'Review / e-file readiness' ? <select value={answers.readiness || ''} onChange={(event) => save('readiness', event.target.value)}><option value="">Choose readiness</option><option value="blocked">Blocked — evidence/diagnostics remain</option><option value="review">Ready for reviewer</option></select> : null}
          </article>
        ))}
      </section>
    </div>
  );
}
