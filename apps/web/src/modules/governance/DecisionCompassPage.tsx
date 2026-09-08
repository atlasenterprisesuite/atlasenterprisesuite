import { type FormEvent, useEffect, useMemo, useState } from 'react';
import type {
  DecisionCompassRecord,
  DecisionRisk,
  DecisionSignalKind,
  DecisionTruthState
} from '../../../../../packages/decision-compass';
import {
  addDecisionEvidence,
  createDecisionCompassRecord,
  listDecisionCompassRecords,
  setDecisionCompassGate,
  transitionDecisionCompassRecord
} from '../../lib/atlasSession';

const signalKinds: Array<{ value: DecisionSignalKind; label: string }> = [
  { value: 'symbolic', label: 'Symbolic reflection' },
  { value: 'intuition', label: 'Intuition' },
  { value: 'observation', label: 'Strategic observation' },
  { value: 'user-note', label: 'User note' },
  { value: 'ai-reflection', label: 'AI reflection' }
];

const risks: DecisionRisk[] = ['low', 'medium', 'high', 'critical'];

function readableError(cause: unknown) {
  return (cause instanceof Error ? cause.message : 'decision_compass_unavailable').replaceAll('_', ' ');
}

function nextState(record: DecisionCompassRecord): { state: DecisionTruthState; label: string } | null {
  if (record.truthState === 'reflection') return { state: 'needs_evidence', label: 'Start evidence review' };
  if (record.truthState === 'needs_evidence' && record.evidenceRefs.length > 0) return { state: 'evidence_found', label: 'Mark evidence found' };
  if (record.truthState === 'evidence_found' && record.proposedAction) return { state: 'action_proposed', label: 'Propose action' };
  if (record.truthState === 'action_proposed') return { state: 'verified', label: 'Verify decision' };
  if (record.truthState === 'blocked') return { state: 'needs_evidence', label: 'Resume evidence review' };
  return null;
}

function verificationReady(record: DecisionCompassRecord) {
  return record.evidenceRefs.length > 0
    && record.verificationGate.length > 0
    && record.verificationGate.every((gate) => gate.passed);
}

export function DecisionCompassPage() {
  const [records, setRecords] = useState<DecisionCompassRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [signalKind, setSignalKind] = useState<DecisionSignalKind>('observation');
  const [signalLabel, setSignalLabel] = useState('');
  const [signalText, setSignalText] = useState('');
  const [interpretation, setInterpretation] = useState('');
  const [targetModule, setTargetModule] = useState('governance');
  const [risk, setRisk] = useState<DecisionRisk>('medium');
  const [proposedAction, setProposedAction] = useState('');
  const [gateLabel, setGateLabel] = useState('Independent evidence reviewed');
  const [evidenceRecordId, setEvidenceRecordId] = useState('');
  const [evidenceKind, setEvidenceKind] = useState('document');
  const [evidenceSourceModule, setEvidenceSourceModule] = useState('');
  const [evidenceSourceId, setEvidenceSourceId] = useState('');
  const [evidenceLabel, setEvidenceLabel] = useState('');

  async function loadRecords() {
    setLoading(true);
    setError('');
    try {
      setRecords(await listDecisionCompassRecords());
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadRecords();
  }, []);

  const selectedEvidenceRecord = useMemo(
    () => records.find((record) => record.id === evidenceRecordId) || null,
    [evidenceRecordId, records]
  );

  function replaceRecord(next: DecisionCompassRecord) {
    setRecords((current) => current.map((record) => {
      if (record.id !== next.id) return record;
      return {
        ...next,
        evidenceRefs: next.evidenceRefs.length > 0 ? next.evidenceRefs : record.evidenceRefs
      };
    }));
  }

  async function handleCreate(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const created = await createDecisionCompassRecord({
        signalKind,
        signalLabel: signalLabel.trim(),
        signalText: signalText.trim(),
        interpretation: interpretation.trim(),
        targetModule: targetModule.trim() || null,
        risk,
        proposedAction: proposedAction.trim() || null,
        verificationGate: gateLabel.trim()
          ? [{ id: 'gate-primary', label: gateLabel.trim(), passed: false }]
          : []
      });
      setRecords((current) => [created, ...current]);
      setSignalLabel('');
      setSignalText('');
      setInterpretation('');
      setProposedAction('');
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleTransition(record: DecisionCompassRecord) {
    const transition = nextState(record);
    if (!transition) return;
    if (transition.state === 'verified' && !verificationReady(record)) {
      setError('verification gate incomplete');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const next = await transitionDecisionCompassRecord(
        record.id,
        transition.state,
        `Decision Compass review: ${transition.label}`
      );
      replaceRecord(next);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleEvidence(event: FormEvent) {
    event.preventDefault();
    if (!selectedEvidenceRecord) return;
    setSaving(true);
    setError('');
    try {
      const evidence = await addDecisionEvidence(selectedEvidenceRecord.id, {
        kind: evidenceKind.trim(),
        sourceModule: evidenceSourceModule.trim(),
        sourceId: evidenceSourceId.trim(),
        label: evidenceLabel.trim()
      });
      setRecords((current) => current.map((record) => record.id === selectedEvidenceRecord.id
        ? { ...record, evidenceRefs: [...record.evidenceRefs, evidence] }
        : record));
      setEvidenceKind('document');
      setEvidenceSourceModule('');
      setEvidenceSourceId('');
      setEvidenceLabel('');
      setEvidenceRecordId('');
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(false);
    }
  }

  async function handleGate(record: DecisionCompassRecord, gateId: string, passed: boolean) {
    setSaving(true);
    setError('');
    try {
      const next = await setDecisionCompassGate(
        record.id,
        gateId,
        passed,
        `Decision Compass verification gate ${passed ? 'passed' : 'reopened'}`
      );
      replaceRecord(next);
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Governance</p>
        <h1>Decision Compass</h1>
        <p>Turn reflective signals into evidence-gated review work without allowing intuition to become operational truth.</p>
      </header>

      <div className="notice strong" role="note">
        <strong>Reflection, not evidence</strong>
        <span>Intuition may orient attention. Evidence decides state, action, and completion.</span>
      </div>

      <form className="workspace-card page-stack" onSubmit={handleCreate} aria-label="Create Decision Compass reflection">
        <div className="card-heading">
          <div><p className="eyebrow">New record</p><h2>Capture a review signal</h2></div>
          <span className="status-chip neutral">Starts as reflection</span>
        </div>
        <div className="filter-row">
          <label className="field"><span>Signal kind</span><select value={signalKind} onChange={(event) => setSignalKind(event.target.value as DecisionSignalKind)}>{signalKinds.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
          <label className="field"><span>Risk</span><select value={risk} onChange={(event) => setRisk(event.target.value as DecisionRisk)}>{risks.map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
          <label className="field"><span>Target module</span><input value={targetModule} onChange={(event) => setTargetModule(event.target.value)} placeholder="governance, finance, health…" /></label>
        </div>
        <label className="field"><span>Signal label</span><input value={signalLabel} onChange={(event) => setSignalLabel(event.target.value)} required /></label>
        <label className="field"><span>Original signal</span><textarea value={signalText} onChange={(event) => setSignalText(event.target.value)} required /></label>
        <label className="field"><span>Interpretation</span><textarea value={interpretation} onChange={(event) => setInterpretation(event.target.value)} placeholder="Phrase this as a neutral review instruction, not a prediction." required /></label>
        <label className="field"><span>Proposed action</span><input value={proposedAction} onChange={(event) => setProposedAction(event.target.value)} placeholder="Optional recommendation for the owning module" /></label>
        <label className="field"><span>Verification gate</span><input value={gateLabel} onChange={(event) => setGateLabel(event.target.value)} placeholder="Independent evidence reviewed" /></label>
        <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Create reflection'}</button>
      </form>

      {error && <div className="notice" role="alert">{error}</div>}
      {loading && <div className="empty-state"><strong>Loading Decision Compass…</strong><span>Reading the active organization under Supabase RLS.</span></div>}
      {!loading && !error && records.length === 0 && <div className="empty-state"><strong>No Decision Compass records yet</strong><span>Create a reflection to begin evidence review.</span></div>}

      {!loading && records.length > 0 && (
        <div className="evidence-list" aria-label="Decision Compass records">
          {records.map((record) => {
            const transition = nextState(record);
            const ready = verificationReady(record);
            return (
              <article key={record.id} className="evidence-card">
                <div className="card-heading">
                  <div><small>{record.signalKind} · {record.targetModule || 'unassigned'}</small><h3>{record.signalLabel}</h3></div>
                  <div className="card-heading"><span className="status-chip neutral">{record.risk} risk</span><span className="status-chip">{record.truthState}</span></div>
                </div>
                <p>{record.signalText}</p>
                <div className="feature-card wide">
                  <p className="eyebrow">Interpretation</p>
                  <strong>{record.interpretation}</strong>
                  <p>{record.proposedAction ? `Proposed action: ${record.proposedAction}` : 'No operational action proposed.'}</p>
                </div>

                <div className="page-stack">
                  <div className="card-heading"><h4>Independent evidence</h4><button className="link-button" type="button" onClick={() => setEvidenceRecordId(record.id)}>Attach evidence</button></div>
                  {record.evidenceRefs.length === 0
                    ? <div className="empty-state"><strong>No evidence attached</strong><span>This record cannot be verified from the reflective signal alone.</span></div>
                    : <ul>{record.evidenceRefs.map((evidence, index) => <li key={evidence.id || `${evidence.sourceModule}-${evidence.sourceId}-${index}`}><strong>{evidence.label}</strong> · {evidence.sourceModule} / {evidence.kind} · {evidence.sourceId}</li>)}</ul>}
                </div>

                <div className="page-stack">
                  <h4>Verification gates</h4>
                  {record.verificationGate.length === 0
                    ? <div className="empty-state"><strong>No verification gates configured</strong><span>Verified state is unavailable.</span></div>
                    : record.verificationGate.map((gate) => (
                      <div key={gate.id} className="card-heading">
                        <span>{gate.passed ? '✓' : '○'} {gate.label}</span>
                        <button
                          className="link-button"
                          type="button"
                          disabled={saving || (!gate.passed && record.evidenceRefs.length === 0)}
                          onClick={() => void handleGate(record, gate.id, !gate.passed)}
                        >
                          {gate.passed ? 'Reopen gate' : 'Mark gate passed'}
                        </button>
                      </div>
                    ))}
                </div>

                <div className="ai-execution-boundary">
                  <strong>Execution boundary</strong>
                  <span>Decision Compass can recommend and verify review state. It cannot execute payments, deployments, clinical decisions, legal filings, telecom changes, payroll changes, or external communications.</span>
                </div>

                {transition && (
                  <button
                    className="primary-action"
                    type="button"
                    disabled={saving || (transition.state === 'verified' && !ready)}
                    onClick={() => void handleTransition(record)}
                  >
                    {transition.label}
                  </button>
                )}
              </article>
            );
          })}
        </div>
      )}

      {selectedEvidenceRecord && (
        <form className="workspace-card page-stack" onSubmit={handleEvidence} aria-label={`Attach evidence to ${selectedEvidenceRecord.signalLabel}`}>
          <div className="card-heading"><div><p className="eyebrow">Independent evidence</p><h2>{selectedEvidenceRecord.signalLabel}</h2></div><button className="link-button" type="button" onClick={() => setEvidenceRecordId('')}>Cancel</button></div>
          <div className="filter-row">
            <label className="field"><span>Evidence kind</span><input value={evidenceKind} onChange={(event) => setEvidenceKind(event.target.value)} required /></label>
            <label className="field"><span>Source module</span><input value={evidenceSourceModule} onChange={(event) => setEvidenceSourceModule(event.target.value)} placeholder="github, gmail, finance…" required /></label>
            <label className="field"><span>Source ID</span><input value={evidenceSourceId} onChange={(event) => setEvidenceSourceId(event.target.value)} required /></label>
          </div>
          <label className="field"><span>Evidence label</span><input value={evidenceLabel} onChange={(event) => setEvidenceLabel(event.target.value)} required /></label>
          <button className="primary-action" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Attach independent evidence'}</button>
        </form>
      )}
    </section>
  );
}
