import { useEffect, useState } from 'react';
import { atlasAuthorizedJson } from '../../lib/atlasSession';

type EvidenceResult = { verified: boolean; observed_at: string; gates: unknown[]; authorization: 'granted' };

// Fail closed: this endpoint must be implemented and authorized server-side before live evidence is displayed.
async function loadMissionControlEvidence(): Promise<EvidenceResult> {
  const evidence = await atlasAuthorizedJson<EvidenceResult>('/functions/v1/atlas-mission-control-evidence', { method: 'GET' });
  if (evidence?.verified !== true || evidence.authorization !== 'granted' || !Array.isArray(evidence.gates) || !evidence.observed_at) {
    throw new Error('unverified_evidence');
  }
  return evidence;
}

type Gate = { id: string; label: string; status: 'NO-GO' | 'PENDING'; evidence: string; detail: string };
const snapshot = {
  observedAt: '2026-11-06',
  source: 'ATLAS 777 REVIEW — historical inspected GitHub run, not a live feed',
  verifiedCommit: '00e9582b207cdf5b20fd18b9f6984bfe48e7b754',
  ciEvidence: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/actions/runs/42299574021',
  gates: [
    { id: 'foundation', label: 'Foundation / Auth', status: 'NO-GO', detail: 'PostgreSQL 17 bootstrap and 22 RPC certification not proven', evidence: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/974' },
    { id: 'auth-red', label: 'AUTH RED', status: 'PENDING', detail: 'Integration and server-derived authorization not certified', evidence: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1007' },
    { id: 'academy', label: 'Academy', status: 'PENDING', detail: 'Prior isolated CI does not certify production', evidence: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/992' }
  ] satisfies Gate[]
};

export function MissionControlPage() {
  const [expanded, setExpanded] = useState<string | null>('foundation');
  const [evidenceState, setEvidenceState] = useState<'checking' | 'denied' | 'unavailable'>('checking');
  useEffect(() => {
    let active = true;
    void loadMissionControlEvidence().then(() => {
      // Server-side permission, tenant isolation and signed provenance are not yet certified.
      if (active) setEvidenceState('unavailable');
    }).catch((error: unknown) => {
      if (!active) return;
      const message = error instanceof Error ? error.message : '';
      setEvidenceState(/authentication_required|session_expired|401|403|forbidden|unauthorized/i.test(message) ? 'denied' : 'unavailable');
    });
    return () => { active = false; };
  }, []);
  return (
    <section className="page-stack" aria-labelledby="mission-title">
      <header className="page-header">
        <p className="eyebrow">ATLAS 777 REVIEW / Mission Control</p>
        <h1 id="mission-title">Launch readiness</h1>
        <p>Read-only historical evidence. No live telemetry, automatic refresh, or deployment certification is connected.</p>
      </header>
      <p role="status">Server evidence: {evidenceState === 'checking' ? 'Checking authorization' : evidenceState === 'denied' ? 'Access denied' : 'Unavailable or unverified'} — no live release certification.</p>
      <div className="notice strong" role="status">GLOBAL: P0 NO-GO · Snapshot observed {snapshot.observedAt} · Never interpret this page as live status.</div>
      <div className="module-grid">
        <article className="module-card"><span>Foundation</span><strong>0 / 22 RPC certified</strong><p>Certification pending. No inferred passes.</p></article>
        <article className="module-card"><span>Data provenance</span><strong>Historical snapshot</strong><p>{snapshot.source}</p><p>Previously inspected commit: <code>{snapshot.verifiedCommit}</code></p><p><a href={snapshot.ciEvidence} target="_blank" rel="noopener noreferrer">Inspect historical CI evidence</a>. CI success does not certify authenticated E2E or release readiness.</p></article>
      </div>
      <section aria-label="Release gates">
        <h2>Release gates and evidence</h2>
        {snapshot.gates.map((gate) => (
          <article className="module-card" key={gate.id}>
            <button type="button" aria-expanded={expanded === gate.id} aria-controls={`gate-${gate.id}`} onClick={() => setExpanded(expanded === gate.id ? null : gate.id)}>
              {gate.label}: {gate.status} — {expanded === gate.id ? 'Hide details' : 'Show details'}
            </button>
            {expanded === gate.id && <div id={`gate-${gate.id}`}><p>{gate.detail}</p><a href={gate.evidence} target="_blank" rel="noopener noreferrer">Open source evidence</a></div>}
          </article>
        ))}
      </section>
      <p>Production release remains blocked until authorized checks, independent review, exact-SHA CI and E2E evidence are verified. This panel does not authorize merge or deployment.</p>
    </section>
  );
}
