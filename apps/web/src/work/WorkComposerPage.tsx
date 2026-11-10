import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { getAtlasMemoryRecord } from '../modules/knowledge/memoryApi';
import { buildMemoryWorkDraft, knowledgeRecordUrl, parseAtlasMemoryReference } from '../modules/knowledge/memoryIntegration';
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
  const [searchParams] = useSearchParams();
  const sourceRef = searchParams.get('source');
  const sourceId = parseAtlasMemoryReference(sourceRef);
  const [sourceState, setSourceState] = useState<'idle' | 'loading' | 'ready' | 'blocked'>('idle');
  const [sourceResolvedId, setSourceResolvedId] = useState<string | null>(null);
  const [sourceVersion, setSourceVersion] = useState<string | null>(null);
  const [sourceTitle, setSourceTitle] = useState('');
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

  useEffect(() => {
    const controller = new AbortController();
    setSourceResolvedId(null);
    setSourceVersion(null);
    setSourceTitle('');
    setPreview(null);
    if (!sourceRef) {
      setSourceState('idle');
      return () => controller.abort();
    }
    setIntent('');
    if (!sourceId) {
      setSourceState('blocked');
      return () => controller.abort();
    }
    setSourceState('loading');
    void getAtlasMemoryRecord(sourceId, controller.signal)
      .then(({ record }) => {
        if (controller.signal.aborted) return;
        const draft = buildMemoryWorkDraft(record, OWNER_MODULES.map(module => module.id));
        setIntent(draft.intent);
        setOwnerModule(draft.ownerModule);
        setAutonomyLevel(draft.autonomyLevel);
        setBudgetLimit(draft.budgetLimit);
        setConnectionRefs(draft.connectionRefs);
        setSourceVersion(record.updated_at);
        setSourceResolvedId(sourceId);
        setSourceTitle(record.title);
        setSourceState('ready');
      })
      .catch(() => { if (!controller.signal.aborted) setSourceState('blocked'); });
    return () => controller.abort();
  }, [sourceId, sourceRef]);

  const sourceBlocked = Boolean(sourceRef) && (sourceState !== 'ready' || sourceResolvedId !== sourceId);

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
  const launchBlocked = (browserRequired && !browserReady) || sourceBlocked;

  const invalidatePreview = () => {
    setPreview(null);
    setError(null);
  };

  const reviewPlan = () => {
    if (sourceBlocked) {
      setError('source_authorization_required');
      return;
    }
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
      if (sourceId) {
        // Recheck authorization and approval immediately before creating the workflow.
        const fresh = await getAtlasMemoryRecord(sourceId);
        buildMemoryWorkDraft(fresh.record, OWNER_MODULES.map(module => module.id));
        if (fresh.record.updated_at !== sourceVersion) {
          setSourceState('blocked');
          setError('Source changed; reopen the authorized record and review the plan again.');
          setCreating(false);
          return;
        }
      }
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

      {sourceRef ? (
        <section className="execution-panel" aria-labelledby="work-knowledge-source-title">
          <h2 id="work-knowledge-source-title">Knowledge Atlas → Work</h2>
          {sourceState === 'loading' ? <p role="status" aria-busy="true">Rechecking the active organization's source permissions…</p> : null}
          {sourceBlocked && sourceState !== 'loading' ? <p role="alert" className="work-error">This knowledge source is unavailable, not approved, or no longer authorized. Work creation is blocked.</p> : null}
          {sourceState === 'ready' && sourceId && sourceResolvedId === sourceId ? (
            <p role="status">Authorized memory: <strong>{sourceTitle}</strong>. Guided work draft only; no execution or spending is authorized by this handoff. <Link to={knowledgeRecordUrl(sourceId)}>Review original record</Link></p>
          ) : null}
        </section>
      ) : null}

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
          <button type="button" className="execution-action" onClick={reviewPlan} disabled={sourceBlocked}>Review plan</button>
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
