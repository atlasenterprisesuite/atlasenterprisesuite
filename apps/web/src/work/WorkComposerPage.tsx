import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compileWorkIntent, type WorkPlanPreview } from '../../../../packages/execution/src/work-intent';
import { runtimeIsHealthy } from '../../../../packages/execution/src/work-runtime';
import type { WorkAutonomyLevel, WorkExecutionMode, WorkRuntimePreference } from '../../../../packages/execution/src/work-types';
import { getActiveAtlasOrganization } from '../lib/atlasSession';
import { ATLAS_MODULES } from '../modules/registry';
import {
  createWorkWorkflow,
  listWorkConnections,
  listWorkRuntimes,
  type WorkConnectionSummary,
  type WorkRuntimeSummary
} from './api';
import { ExecutionConfiguration } from './ExecutionConfiguration';
import { WorkSubnav } from './WorkSubnav';

const OWNER_MODULES = [
  { id: 'manager', label: 'Manager' },
  ...ATLAS_MODULES
    .filter((module) => !['work', 'execution', 'automations'].includes(module.id))
    .map((module) => ({ id: module.id, label: module.navLabel }))
];

function runtimeMatchesPreference(runtime: WorkRuntimeSummary, preference: WorkRuntimePreference) {
  return preference === 'auto' || runtime.kind === preference;
}

export function WorkComposerPage() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('');
  const [ownerModule, setOwnerModule] = useState('manager');
  const [executionMode, setExecutionMode] = useState<WorkExecutionMode>('hybrid');
  const [autonomyLevel, setAutonomyLevel] = useState<WorkAutonomyLevel>('guided');
  const [runtimePreference, setRuntimePreference] = useState<WorkRuntimePreference>('auto');
  const [budgetLimit, setBudgetLimit] = useState<number | null>(0);
  const [connectionRefs, setConnectionRefs] = useState<string[]>([]);
  const [connections, setConnections] = useState<WorkConnectionSummary[]>([]);
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[]>([]);
  const [organization, setOrganization] = useState<{ id: string; role: string } | null>(null);
  const [capabilityLoading, setCapabilityLoading] = useState(true);
  const [capabilityError, setCapabilityError] = useState<string | null>(null);
  const [preview, setPreview] = useState<WorkPlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let active = true;
    void Promise.all([listWorkConnections(), listWorkRuntimes(), getActiveAtlasOrganization()])
      .then(([nextConnections, nextRuntimes, nextOrganization]) => {
        if (!active) return;
        setConnections(nextConnections.filter((connection) => connection.status === 'active'));
        setRuntimes(nextRuntimes);
        setOrganization(nextOrganization);
      })
      .catch((caught) => {
        if (active) setCapabilityError(caught instanceof Error ? caught.message : 'work_capability_state_unavailable');
      })
      .finally(() => {
        if (active) setCapabilityLoading(false);
      });
    return () => { active = false; };
  }, []);

  const launchInput = useMemo(() => ({
    intent,
    ownerModule,
    executionMode,
    autonomyLevel,
    runtimePreference,
    budgetLimit,
    connectionRefs
  }), [intent, ownerModule, executionMode, autonomyLevel, runtimePreference, budgetLimit, connectionRefs]);

  const healthyBrowserRuntimes = useMemo(
    () => runtimes.filter((runtime) =>
      runtime.capabilities.includes('browser')
      && runtimeMatchesPreference(runtime, runtimePreference)
      && runtimeIsHealthy(runtime)
    ),
    [runtimes, runtimePreference]
  );

  const browserReady = healthyBrowserRuntimes.length > 0;
  const browserRequired = executionMode === 'browser';
  const launchBlocked = browserRequired && !browserReady;

  const invalidatePreview = () => {
    setPreview(null);
    setError(null);
  };

  const reviewPlan = () => {
    setError(null);
    try {
      setPreview(compileWorkIntent(launchInput));
    } catch (caught) {
      setPreview(null);
      setError(caught instanceof Error ? caught.message : 'work_preview_failed');
    }
  };

  const createWorkflow = async () => {
    if (!preview || creating || launchBlocked) return;
    setCreating(true);
    setError(null);
    try {
      const result = await createWorkWorkflow(launchInput);
      navigate(`/execution/${encodeURIComponent(result.workflowId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'work_create_failed');
      setCreating(false);
    }
  };

  const toggleConnection = (connectionId: string, checked: boolean) => {
    setConnectionRefs((current) => checked
      ? [...new Set([...current, connectionId])]
      : current.filter((id) => id !== connectionId));
    invalidatePreview();
  };

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <p className="eyebrow">ATLAS Work Soberano</p>
        <h1>Create work</h1>
        <p>Review organization scope, authorized capabilities and the execution envelope before ATLAS persists a canonical workflow.</p>
      </header>

      <div className="work-composer execution-panel">
        <label htmlFor="work-intent">What do you want ATLAS to accomplish?</label>
        <textarea
          id="work-intent"
          value={intent}
          rows={5}
          maxLength={2000}
          onChange={(event) => { setIntent(event.target.value); invalidatePreview(); }}
          placeholder="Describe the outcome to achieve and verify."
        />

        <div className="work-config-grid">
          <label>
            <span>Owner module</span>
            <select aria-label="Owner module" value={ownerModule} onChange={(event) => { setOwnerModule(event.target.value); invalidatePreview(); }}>
              {OWNER_MODULES.map((module) => <option key={module.id} value={module.id}>{module.label}</option>)}
            </select>
          </label>

          <label>
            <span>Execution mode</span>
            <select aria-label="Execution mode" value={executionMode} onChange={(event) => { setExecutionMode(event.target.value as WorkExecutionMode); invalidatePreview(); }}>
              <option value="hybrid">Hybrid</option>
              <option value="api">API</option>
              <option value="browser">Browser</option>
            </select>
          </label>

          <label>
            <span>Autonomy</span>
            <select aria-label="Autonomy" value={autonomyLevel} onChange={(event) => { setAutonomyLevel(event.target.value as WorkAutonomyLevel); invalidatePreview(); }}>
              <option value="guided">Guided</option>
              <option value="manual">Manual</option>
              <option value="autonomous">Autonomous</option>
            </select>
          </label>

          <label>
            <span>Runtime</span>
            <select aria-label="Runtime" value={runtimePreference} onChange={(event) => { setRuntimePreference(event.target.value as WorkRuntimePreference); invalidatePreview(); }}>
              <option value="auto">Auto</option>
              <option value="local">Local</option>
              <option value="self_hosted">Self-hosted</option>
              <option value="cloud_ephemeral">Cloud ephemeral</option>
            </select>
          </label>

          <label>
            <span>External budget (USD)</span>
            <input
              aria-label="External budget (USD)"
              type="number"
              min="0"
              step="1"
              value={budgetLimit ?? ''}
              onChange={(event) => {
                const next = event.target.value === '' ? null : Math.max(0, Number(event.target.value) || 0);
                setBudgetLimit(next);
                invalidatePreview();
              }}
            />
          </label>
        </div>

        <section className="execution-panel" aria-labelledby="work-capability-title">
          <h2 id="work-capability-title">Authorized execution capability</h2>
          {capabilityLoading ? <p aria-busy="true">Loading organization capability state…</p> : null}
          {capabilityError ? <p role="alert" className="work-error">{capabilityError}</p> : null}
          {organization ? (
            <dl className="work-preview-facts">
              <div><dt>Organization</dt><dd>{organization.id}</dd></div>
              <div><dt>Role</dt><dd>{organization.role}</dd></div>
              <div><dt>Tenant scope</dt><dd>Resolved and enforced server-side</dd></div>
              <div><dt>Required base permission</dt><dd><code>execution.write</code></dd></div>
            </dl>
          ) : null}

          <h3>Connections</h3>
          {connections.length ? connections.map((connection) => (
            <label key={connection.id}>
              <input
                type="checkbox"
                aria-label={`Use ${connection.provider} connection`}
                checked={connectionRefs.includes(connection.id)}
                onChange={(event) => toggleConnection(connection.id, event.target.checked)}
              />
              <span>{connection.provider} · {connection.mechanism} · {connection.capabilities.join(', ') || 'no registered capabilities'}</span>
            </label>
          )) : <p>No active Work connection references are available. Provider-dependent steps will remain blocked until authorized.</p>}

          <h3>Browser runtime readiness</h3>
          <p>{browserReady
            ? `${healthyBrowserRuntimes.length} eligible runtime(s) have a current heartbeat and browser capability.`
            : 'No eligible browser runtime has a current heartbeat for the selected runtime policy.'}</p>
          {executionMode === 'hybrid' && !browserReady ? <p className="notice">Hybrid work may still use authorized API paths, but any browser-required step will fail closed until a runtime becomes eligible.</p> : null}
          {launchBlocked ? <p role="alert" className="work-error">Browser execution is selected, but no eligible browser runtime is currently verified.</p> : null}

          <h3>Approval and spend boundary</h3>
          <p>Approvals are resolved server-side per action sensitivity and cannot be bypassed by Autonomous mode.</p>
          <p>{budgetLimit && budgetLimit > 0 ? `Paid-provider ceiling: $${budgetLimit}.` : 'Paid-provider ceiling: $0 effective. No external provider spend is authorized.'}</p>
        </section>

        <div className="work-actions">
          <button type="button" className="execution-action" onClick={reviewPlan}>Review plan</button>
        </div>
        {error ? <p role="alert" className="work-error">{error}</p> : null}
      </div>

      {preview ? (
        <section className="work-preview execution-panel" aria-labelledby="work-preview-title">
          <p className="eyebrow">Review before launch</p>
          <h2 id="work-preview-title">Plan preview</h2>
          <ExecutionConfiguration
            executionMode={preview.executionMode}
            autonomyLevel={preview.autonomyLevel}
            runtimePreference={preview.runtimePreference}
            budgetLimit={preview.budgetLimit}
          />
          <p>Authorized connection references: <strong>{preview.connectionRefs.length}</strong></p>
          <h3>Success criteria</h3>
          <ul>{preview.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
          <p className="notice">This is a draft preview. No provider action has been executed. Authorization, capability, approval and budget are revalidated server-side before every mutation.</p>
          <button type="button" className="execution-action" disabled={creating || launchBlocked} onClick={() => void createWorkflow()}>
            {creating ? 'Creating workflow…' : 'Create workflow'}
          </button>
        </section>
      ) : null}
    </section>
  );
}
