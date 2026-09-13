import { FormEvent, useMemo, useState } from 'react';
import { buildIncidentEvidenceEnvelope, classifyIncidentRisk, type IncidentDraft } from './incidents';

type IncidentCategory = IncidentDraft['category'];

export function IncidentIntake() {
  const [module, setModule] = useState('core');
  const [summary, setSummary] = useState('');
  const [category, setCategory] = useState<IncidentCategory>('reversible');
  const [submitted, setSubmitted] = useState<ReturnType<typeof buildIncidentEvidenceEnvelope> | null>(null);

  const risk = useMemo(() => classifyIncidentRisk({ module, summary, category }), [module, summary, category]);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!summary.trim()) return;
    setSubmitted(buildIncidentEvidenceEnvelope({ module, summary: summary.trim(), category }));
  }

  return (
    <section className="orchestrator-card incident-intake" aria-labelledby="incident-intake-title">
      <h2 id="incident-intake-title">Report a Problem</h2>
      <p>Capture an incident for diagnosis. High-risk categories are routed to governed approval and are never self-authorized.</p>
      <form onSubmit={submit} className="incident-form">
        <label><span>Module</span><input value={module} onChange={(event) => setModule(event.target.value)} required /></label>
        <label><span>Category</span><select value={category} onChange={(event) => setCategory(event.target.value as IncidentCategory)}><option value="reversible">Reversible / low risk</option><option value="destructive">Destructive</option><option value="financial">Financial</option><option value="permissions">Permissions</option><option value="security">Security boundary</option><option value="audit">Audit</option><option value="irreversible">Irreversible</option></select></label>
        <label><span>What failed?</span><textarea value={summary} onChange={(event) => setSummary(event.target.value)} rows={4} required /></label>
        <div className="incident-risk"><span>Routing</span><strong>{risk === 'low' ? 'Safe diagnosis queue' : 'Approval required'}</strong></div>
        <button type="submit">Create incident evidence</button>
      </form>
      {submitted ? <div className="incident-result" role="status"><strong>Incident captured</strong><span>{submitted.risk === 'low' ? 'Ready for bounded diagnosis.' : 'Held for governed approval before any high-risk action.'}</span></div> : null}
    </section>
  );
}
