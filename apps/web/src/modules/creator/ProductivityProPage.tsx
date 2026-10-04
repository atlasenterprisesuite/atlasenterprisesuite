import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getAssistantStatus,
  hasVerifiedAssistantProvider,
  sendAssistantWorkspaceMessage,
  type AssistantChatResponse,
  type AssistantStatusResponse
} from '../../assistant/client';
import './creator.css';

type ProMode = 'researcher' | 'analyst' | 'writer' | 'executive';

const PRO_MODES: Array<{
  id: ProMode;
  label: string;
  description: string;
  instruction: string;
}> = [
  {
    id: 'researcher',
    label: 'Researcher',
    description: 'Build a sourced research plan, separate verified facts from assumptions, identify evidence gaps and produce an executive brief.',
    instruction: 'Operate as ATLAS Researcher. Analyze the supplied request deeply. Separate verified facts, assumptions, uncertainties, evidence gaps, recommended validation steps and an executive synthesis. Never claim access to files, systems or sources that were not supplied or actually connected.'
  },
  {
    id: 'analyst',
    label: 'Analyst',
    description: 'Analyze pasted business or financial data, detect patterns, anomalies, drivers and decision-relevant next actions.',
    instruction: 'Operate as ATLAS Analyst. Analyze only the data and facts supplied in the request. Show calculations or reasoning summaries where useful, call out missing fields, identify anomalies and trends, and produce decision-ready findings. Never invent rows, balances, transactions or measurements.'
  },
  {
    id: 'writer',
    label: 'Writer',
    description: 'Turn rough material into structured professional copy while preserving claims and source boundaries.',
    instruction: 'Operate as ATLAS Writer. Transform the supplied material into polished professional content. Preserve factual meaning, mark unsupported claims, and return a clear structure that can continue in ATLAS Writing Desk.'
  },
  {
    id: 'executive',
    label: 'Executive Brief',
    description: 'Condense operating detail into decisions, risks, owners, dependencies and next actions.',
    instruction: 'Operate as ATLAS Executive Briefing. Convert the supplied information into a concise leadership brief with current state, material changes, risks, dependencies, decisions required and next actions. Do not mark work complete without evidence.'
  }
];

const PRODUCTIVITY_CAPABILITIES = [
  {
    label: 'Documents',
    title: 'Writing Desk',
    description: 'Draft, rewrite, summarize and structure text through the governed ATLAS intelligence bus.',
    to: '/studio/write'
  },
  {
    label: 'Analytics',
    title: 'ATLAS Analytics',
    description: 'Continue from AI analysis into the governed analytics workspace for organization-scoped operational intelligence.',
    to: '/analytics'
  },
  {
    label: 'Knowledge',
    title: 'Knowledge Atlas',
    description: 'Use approved organization knowledge, evidence and decisions without treating unapproved chat content as truth.',
    to: '/knowledge'
  },
  {
    label: 'Images',
    title: 'Image Lab',
    description: 'Generate or edit visual assets only through verified creative providers and preserved provenance.',
    to: '/studio/create?type=image'
  },
  {
    label: 'Voice',
    title: 'Voice Studio',
    description: 'Use ATLAS Voice for governed voice and conversational workflows with truthful provider readiness.',
    to: '/studio/voice'
  },
  {
    label: 'Presentation',
    title: 'Smart Teleprompter',
    description: 'Prepare and deliver presentations with camera, microphone and authorized recording boundaries.',
    to: '/studio/teleprompter'
  }
] as const;

const PRO_REFERENCE = [
  ['Advanced Copilot chat', 'ATLAS Assistant with verified provider routing and Deep profile'],
  ['Researcher', 'ATLAS Productivity Pro · Researcher mode'],
  ['Analyst', 'ATLAS Productivity Pro · Analyst mode + ATLAS Analytics'],
  ['Word-style drafting', 'ATLAS Writing Desk'],
  ['Image creation', 'ATLAS Image Lab'],
  ['Voice / audio workflows', 'ATLAS Voice'],
  ['Cloud knowledge context', 'Knowledge Atlas / authorized organization storage'],
  ['Microsoft work files', 'External Microsoft 365 bridge required; not inferred from ATLAS login']
] as const;

export function ProductivityProPage() {
  const [status, setStatus] = useState<AssistantStatusResponse | null>(null);
  const [statusError, setStatusError] = useState('');
  const [mode, setMode] = useState<ProMode>('researcher');
  const [request, setRequest] = useState('');
  const [runState, setRunState] = useState<'idle' | 'running' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<AssistantChatResponse | null>(null);
  const [runError, setRunError] = useState('');

  useEffect(() => {
    let active = true;
    getAssistantStatus()
      .then(value => {
        if (!active) return;
        setStatus(value);
        setStatusError('');
      })
      .catch(error => {
        if (!active) return;
        setStatus(null);
        setStatusError(error instanceof Error ? error.message : 'assistant_status_unavailable');
      });
    return () => { active = false; };
  }, []);

  const providerReady = Boolean(status && hasVerifiedAssistantProvider(status));
  const selectedMode = useMemo(() => PRO_MODES.find(item => item.id === mode) || PRO_MODES[0], [mode]);

  async function runProTask() {
    const trimmed = request.trim();
    if (!trimmed) {
      setRunState('error');
      setRunError('Describe the work you want ATLAS Productivity Pro to perform.');
      return;
    }
    if (!providerReady) {
      setRunState('error');
      setRunError('Verified AI required. ATLAS will not simulate a Pro result while no assistant provider is verified.');
      return;
    }

    setRunState('running');
    setRunError('');
    setResult(null);
    try {
      const response = await sendAssistantWorkspaceMessage({
        message: `${selectedMode.instruction}\n\nUSER WORK REQUEST:\n${trimmed}`,
        mode: 'auto',
        profile: 'deep',
        executionMode: 'interactive'
      });
      setResult(response);
      setRunState('success');
    } catch (error) {
      setRunState('error');
      setRunError(error instanceof Error ? error.message : 'productivity_pro_request_failed');
    }
  }

  return <section className="creator-page ai-universe-page">
    <nav className="creator-breadcrumb" aria-label="Breadcrumb">
      <Link to="/studio">ATLAS Studio</Link><span>/</span><span>Productivity Pro</span>
    </nav>

    <header className="creator-hero ai-universe-hero">
      <div>
        <p className="eyebrow">ATLAS Productivity Pro</p>
        <h1>Research, analyze, write and move the result into the ATLAS suite.</h1>
        <p>This workspace brings the useful productivity pattern behind premium AI office suites into ATLAS without pretending Microsoft 365 is connected. Native ATLAS capabilities execute through existing identity, tenant, provider-readiness and audit boundaries.</p>
        <div className="ai-universe-hero-actions">
          <Link className="creator-primary" to="/assistant">Open full Assistant</Link>
          <Link className="ai-universe-secondary" to="/studio/providers">Check provider readiness</Link>
        </div>
      </div>
    </header>

    <section className="creator-section" aria-labelledby="productivity-pro-workbench">
      <div className="section-heading">
        <div><p className="eyebrow">Agentic workbench</p><h2 id="productivity-pro-workbench">Run a Pro task now</h2></div>
        <span className={`provider-state ${providerReady ? 'is-ready' : ''}`}>{providerReady ? 'verified AI ready' : 'AI not verified'}</span>
      </div>

      <div className="ai-universe-toolbar">
        <label>
          <span>Mode</span>
          <select value={mode} onChange={event => setMode(event.target.value as ProMode)}>
            {PRO_MODES.map(item => <option value={item.id} key={item.id}>{item.label}</option>)}
          </select>
        </label>
        <label>
          <span>Execution profile</span>
          <select value="deep" disabled><option value="deep">Deep · governed provider routing</option></select>
        </label>
      </div>

      <article className="ai-universe-card">
        <small>{selectedMode.label}</small>
        <h3>{selectedMode.description}</h3>
        <label className="creator-search">
          <span>Work request or pasted data</span>
          <textarea
            value={request}
            onChange={event => setRequest(event.target.value)}
            rows={10}
            placeholder="Example: Analyze these AP aging balances, identify anomalies and produce the five actions with the greatest cash-flow impact…"
            style={{ width: '100%', resize: 'vertical' }}
          />
        </label>
        <div className="creator-actions">
          <button className="creator-primary" type="button" onClick={() => void runProTask()} disabled={runState === 'running' || !providerReady}>
            {runState === 'running' ? 'Running deep analysis…' : `Run ${selectedMode.label}`}
          </button>
          <button type="button" onClick={() => { setRequest(''); setResult(null); setRunState('idle'); setRunError(''); }}>Clear</button>
        </div>
        {statusError && <p className="creator-notice" role="status">Provider status unavailable: {statusError}</p>}
        {runError && <p className="creator-notice" role="alert">{runError}</p>}
      </article>

      {result && <article className="ai-universe-card" aria-live="polite">
        <div className="ai-universe-card-heading">
          <div><small>Verified execution result</small><h3>{selectedMode.label} output</h3></div>
          <span className="provider-state is-ready">{result.provider_state || 'completed'}</span>
        </div>
        <p style={{ whiteSpace: 'pre-wrap' }}>{result.text || result.output || 'No textual result returned.'}</p>
        <dl className="ai-universe-facts">
          <div><dt>Provider</dt><dd>{result.provider || result.providers?.join(', ') || 'server-routed'}</dd></div>
          <div><dt>Model</dt><dd>{result.model || 'server-selected'}</dd></div>
          <div><dt>Profile</dt><dd>{result.profile || 'deep'}</dd></div>
          <div><dt>Conversation</dt><dd>{result.conversation_id || 'not persisted / not reported'}</dd></div>
        </dl>
      </article>}
    </section>

    <section className="creator-section" aria-labelledby="productivity-pro-capabilities">
      <div className="section-heading"><div><p className="eyebrow">Productivity system</p><h2 id="productivity-pro-capabilities">Continue the work across ATLAS</h2></div></div>
      <div className="ai-universe-grid">
        {PRODUCTIVITY_CAPABILITIES.map(item => <article className="ai-universe-card" key={item.title}>
          <small>{item.label}</small>
          <h3>{item.title}</h3>
          <p>{item.description}</p>
          <Link className="ai-universe-secondary" to={item.to}>Open</Link>
        </article>)}
      </div>
    </section>

    <section className="creator-section" aria-labelledby="m365-pro-reference">
      <div className="section-heading"><div><p className="eyebrow">Microsoft 365 Pro reference</p><h2 id="m365-pro-reference">Capability mapping without false connectivity</h2></div><span className="provider-state">external bridge gated</span></div>
      <p className="creator-notice">Microsoft 365 Pro is used here only as a capability reference. ATLAS does not report Microsoft Graph, Outlook, OneDrive, SharePoint or Teams as connected until an organization completes a real Microsoft authorization flow and the server verifies it.</p>
      <div className="ai-universe-table-wrap">
        <table className="ai-universe-table">
          <thead><tr><th>Premium productivity capability</th><th>ATLAS implementation / boundary</th></tr></thead>
          <tbody>{PRO_REFERENCE.map(([capability, atlas]) => <tr key={capability}><td>{capability}</td><td>{atlas}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="ai-universe-onboarding">
        <article><strong>Native ATLAS</strong><p>Researcher, Analyst, writing, image, voice, analytics and knowledge workflows reuse existing ATLAS modules and their current verification boundaries.</p></article>
        <article><strong>Microsoft bridge</strong><p>Real Microsoft work-file, mailbox, calendar and collaboration access requires Microsoft identity/OAuth plus approved Graph permissions. No credential is requested in this browser page.</p></article>
        <article><strong>Fail closed</strong><p>If the AI provider or future Microsoft bridge cannot be verified, execution stays unavailable and the UI shows the missing dependency instead of a simulated connected state.</p></article>
      </div>
    </section>

    <section className="creator-privacy">
      <strong>Governance boundary</strong>
      <p>ATLAS Productivity Pro does not inherit Microsoft 365 Pro licensing or usage limits. It reproduces the useful workflow pattern with ATLAS-native services and keeps Microsoft-specific data access behind a separate, verifiable integration boundary.</p>
    </section>
  </section>;
}
