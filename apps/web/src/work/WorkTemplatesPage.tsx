import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { WORK_TEMPLATES } from '../../../../packages/execution/src/work-templates';
import { createWorkTemplate } from './api';
import { WorkSubnav } from './WorkSubnav';

export function WorkTemplatesPage() {
  const navigate = useNavigate();
  const [domain, setDomain] = useState('atlasenterprisesuite.com');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const template = WORK_TEMPLATES.find((item) => item.id === 'manager.openai_domain_verification');

  if (!template) return <section><h1>Templates unavailable</h1></section>;

  const launch = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const result = await createWorkTemplate(template.id, { domain });
      navigate(`/execution/${encodeURIComponent(result.workflowId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_template_launch_failed');
      setBusy(false);
    }
  };

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Templates</h1><p>Governed reusable workflows with server-owned steps and explicit verification criteria.</p></header>
      <WorkSubnav />
      <article className="execution-panel work-template-card">
        <p className="eyebrow">ATLAS Manager</p>
        <h2>{template.title}</h2>
        <p>{template.description}</p>
        <p><strong>Hybrid · Guided · $0</strong></p>
        <label>
          <span>Domain</span>
          <input value={domain} maxLength={253} onChange={(event) => setDomain(event.target.value.trim().toLowerCase())} />
        </label>
        <p className="notice">The live OpenAI verification value is never hard-coded here. It must be observed from an authorized OpenAI session when the workflow reaches that step.</p>
        {error ? <p role="alert" className="work-error">{error}</p> : null}
        <button type="button" className="execution-action" disabled={busy || !domain} onClick={() => void launch()}>{busy ? 'Creating workflow…' : 'Create verification workflow'}</button>
      </article>
    </section>
  );
}
