import { useEffect, useMemo, useState } from 'react';
import { Link, Route, Routes } from 'react-router-dom';
import {
  DEFAULT_PROVIDER_CALL_LOGGING_MODE,
  getAtlasAiGovernanceState,
  saveAtlasAiDataPolicy,
  SENSITIVE_ATLAS_AI_MODULES,
  type AtlasAiDataPolicyAudit,
  type ProviderCallLoggingMode
} from './securityApi';

const SELECTABLE_MODULES = [
  { id: 'assistant', label: 'Assistant' },
  { id: 'work', label: 'Work' },
  { id: 'business', label: 'Business' },
  { id: 'crm', label: 'CRM' },
  { id: 'commerce', label: 'Commerce' },
  { id: 'connect', label: 'Connect' },
  { id: 'studio', label: 'Creator / Studio' },
  { id: 'hospitality', label: 'Hospitality' },
  { id: 'ride', label: 'Ride' },
  { id: 'learning', label: 'Learning' }
] as const;

const MODE_OPTIONS: Array<{ id: ProviderCallLoggingMode; title: string; description: string }> = [
  { id: 'disabled', title: 'Disabled', description: 'Do not request provider-side storage for any ATLAS AI call.' },
  { id: 'per_call', title: 'Enabled per call', description: 'A caller must explicitly request storage and the module must not be sensitive.' },
  { id: 'all', title: 'All non-sensitive modules', description: 'Allow provider storage across non-sensitive ATLAS modules. Sensitive modules remain locked off.' },
  { id: 'selected_modules', title: 'Selected modules', description: 'Allow provider storage only for the non-sensitive modules selected below.' }
];

function formatWhen(value: string | null | undefined) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? 'Unknown' : date.toLocaleString();
}

function SecurityHome() {
  return (
    <section className="security-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Security Center</p>
        <h1>Security & data governance</h1>
        <p>Organization-scoped controls for AI data handling, auditability and fail-closed provider behavior.</p>
      </header>
      <div className="security-card-grid">
        <Link className="security-card security-card-link" to="/security/ai-governance">
          <span className="security-kicker">AI governance</span>
          <h2>Data controls</h2>
          <p>Control provider-side request storage while keeping sensitive modules locked to no-store behavior.</p>
          <span className="security-action">Open data controls</span>
        </Link>
        <article className="security-card">
          <span className="security-kicker">Audit</span>
          <h2>Immutable change trail</h2>
          <p>ATLAS records policy insertions and changes by organization. Audit logging cannot be disabled by this control plane.</p>
          <span className="security-status good">Enforced</span>
        </article>
      </div>
    </section>
  );
}

function AuditList({ rows }: { rows: AtlasAiDataPolicyAudit[] }) {
  if (!rows.length) {
    return <div className="security-empty"><strong>No policy changes recorded yet</strong><span>The first saved policy will create the audit trail.</span></div>;
  }
  return (
    <div className="security-audit-list">
      {rows.map((row) => (
        <article key={row.id}>
          <div>
            <strong>{row.action === 'insert' ? 'Policy created' : 'Policy updated'}</strong>
            <span>{formatWhen(row.created_at)}</span>
          </div>
          <code>{String(row.resulting_policy?.provider_call_logging_mode || 'disabled')}</code>
        </article>
      ))}
    </div>
  );
}

function AiGovernancePage() {
  const [mode, setMode] = useState<ProviderCallLoggingMode>(DEFAULT_PROVIDER_CALL_LOGGING_MODE);
  const [selectedModules, setSelectedModules] = useState<string[]>([]);
  const [audit, setAudit] = useState<AtlasAiDataPolicyAudit[]>([]);
  const [role, setRole] = useState('');
  const [canManage, setCanManage] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'saving' | 'error'>('loading');
  const [message, setMessage] = useState('');

  async function load() {
    setState('loading');
    setMessage('');
    try {
      const data = await getAtlasAiGovernanceState();
      setMode(data.policy.provider_call_logging_mode);
      setSelectedModules(data.policy.selected_modules || []);
      setAudit(data.audit);
      setRole(data.role);
      setCanManage(data.canManage);
      setLastUpdated(data.policy.updated_at);
      setState('ready');
    } catch (cause) {
      setState('error');
      setMessage(cause instanceof Error ? cause.message : 'security_governance_unavailable');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const selectedSet = useMemo(() => new Set(selectedModules), [selectedModules]);

  function toggleModule(module: string) {
    setSelectedModules((current) =>
      current.includes(module) ? current.filter((item) => item !== module) : [...current, module]
    );
  }

  async function save() {
    if (!canManage || state === 'saving') return;
    setState('saving');
    setMessage('');
    try {
      const saved = await saveAtlasAiDataPolicy(mode, selectedModules);
      setMode(saved.provider_call_logging_mode);
      setSelectedModules(saved.selected_modules || []);
      setLastUpdated(saved.updated_at);
      const refreshed = await getAtlasAiGovernanceState();
      setAudit(refreshed.audit);
      setMessage('AI data-governance policy saved and audited.');
      setState('ready');
    } catch (cause) {
      setState('error');
      setMessage(cause instanceof Error ? cause.message : 'policy_save_failed');
    }
  }

  return (
    <section className="security-page page-stack">
      <nav className="security-breadcrumb" aria-label="Security breadcrumb">
        <Link to="/security">Security Center</Link><span>/</span><span>AI data governance</span>
      </nav>
      <header className="page-header">
        <p className="eyebrow">ATLAS Security Center</p>
        <h1>AI data controls</h1>
        <p>Provider-side storage is controlled independently from ATLAS conversation history. Sensitive modules are always fail-closed.</p>
      </header>

      <div className="security-summary-grid">
        <article><span>Audit logging</span><strong>Always on</strong><small>Immutable policy changes</small></article>
        <article><span>Provider storage</span><strong>{mode.replace('_', ' ')}</strong><small>Organization policy</small></article>
        <article><span>Sensitive modules</span><strong>No-store</strong><small>Runtime enforced</small></article>
        <article><span>Last updated</span><strong>{formatWhen(lastUpdated)}</strong><small>Role: {role || 'checking'}</small></article>
      </div>

      <article className="security-panel">
        <div className="security-panel-heading">
          <div><span className="security-kicker">Audit logging</span><h2>ATLAS audit trail</h2></div>
          <span className="security-status good">Enabled · locked</span>
        </div>
        <p>Security-policy changes are written to an organization-scoped audit ledger. This control cannot be disabled from the UI.</p>
      </article>

      <article className="security-panel">
        <div className="security-panel-heading">
          <div><span className="security-kicker">Provider data retention</span><h2>API call logging policy</h2></div>
          <span className="security-status neutral">{canManage ? 'Owner/Admin control' : 'Read only'}</span>
        </div>
        <div className="security-radio-list" role="radiogroup" aria-label="Provider call logging mode">
          {MODE_OPTIONS.map((option) => (
            <label key={option.id} className={mode === option.id ? 'security-radio selected' : 'security-radio'}>
              <input
                type="radio"
                name="provider-call-logging"
                value={option.id}
                checked={mode === option.id}
                onChange={() => setMode(option.id)}
                disabled={!canManage || state === 'loading' || state === 'saving'}
              />
              <span><strong>{option.title}</strong><small>{option.description}</small></span>
            </label>
          ))}
        </div>

        {mode === 'selected_modules' ? (
          <div className="security-module-selector">
            <span className="security-kicker">Eligible modules</span>
            <div>
              {SELECTABLE_MODULES.map((module) => (
                <label key={module.id} className={selectedSet.has(module.id) ? 'security-module selected' : 'security-module'}>
                  <input
                    type="checkbox"
                    checked={selectedSet.has(module.id)}
                    onChange={() => toggleModule(module.id)}
                    disabled={!canManage || state === 'saving'}
                  />
                  <span>{module.label}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="security-locked-modules">
          <span className="security-kicker">Fail-closed modules</span>
          <p>Provider-side storage remains disabled regardless of the organization-wide mode.</p>
          <div>{SENSITIVE_ATLAS_AI_MODULES.map((module) => <span key={module}>{module}</span>)}</div>
        </div>

        <div className="security-actions">
          <button type="button" onClick={save} disabled={!canManage || state === 'loading' || state === 'saving'}>
            {state === 'saving' ? 'Saving…' : 'Save policy'}
          </button>
          {state === 'error' ? <button className="secondary" type="button" onClick={() => void load()}>Retry</button> : null}
          {message ? <span className={state === 'error' ? 'security-message error' : 'security-message'} role="status">{message}</span> : null}
        </div>
      </article>

      <article className="security-panel external-boundary">
        <div className="security-panel-heading">
          <div><span className="security-kicker">OpenAI organization setting</span><h2>Sharing with OpenAI</h2></div>
          <span className="security-status warning">External control</span>
        </div>
        <p>ATLAS does not claim to change or verify the OpenAI Platform organization-sharing switch. Production should remain disabled; development/test projects may be enabled separately when they contain no sensitive or proprietary data.</p>
      </article>

      <article className="security-panel">
        <div className="security-panel-heading">
          <div><span className="security-kicker">Audit history</span><h2>Recent policy changes</h2></div>
          <span className="security-status neutral">{audit.length} shown</span>
        </div>
        {state === 'loading' ? <div className="security-empty" role="status"><strong>Loading governance state…</strong><span>Reading the active organization policy.</span></div> : <AuditList rows={audit} />}
      </article>
    </section>
  );
}

export function SecurityRoutes() {
  return (
    <Routes>
      <Route path="/security" element={<SecurityHome />} />
      <Route path="/security/ai-governance" element={<AiGovernancePage />} />
      <Route path="*" element={<SecurityHome />} />
    </Routes>
  );
}
