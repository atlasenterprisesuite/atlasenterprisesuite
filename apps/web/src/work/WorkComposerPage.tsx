import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { compileWorkIntent, type WorkPlanPreview } from '../../../../packages/execution/src/work-intent';
import type { WorkAutonomyLevel, WorkExecutionMode, WorkRuntimePreference } from '../../../../packages/execution/src/work-types';
import { createWorkWorkflow } from './api';
import { ExecutionConfiguration } from './ExecutionConfiguration';

export function WorkComposerPage() {
  const navigate = useNavigate();
  const [intent, setIntent] = useState('');
  const [ownerModule, setOwnerModule] = useState('manager');
  const [executionMode, setExecutionMode] = useState<WorkExecutionMode>('hybrid');
  const [autonomyLevel, setAutonomyLevel] = useState<WorkAutonomyLevel>('guided');
  const [runtimePreference, setRuntimePreference] = useState<WorkRuntimePreference>('auto');
  const [budgetLimit, setBudgetLimit] = useState<number | null>(0);
  const [preview, setPreview] = useState<WorkPlanPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const launchInput = useMemo(() => ({
    intent,
    ownerModule,
    executionMode,
    autonomyLevel,
    runtimePreference,
    budgetLimit,
    connectionRefs: [] as string[]
  }), [intent, ownerModule, executionMode, autonomyLevel, runtimePreference, budgetLimit]);

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
    if (!preview || creating) return;
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

  return (
    <section className="work-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Work Soberano</p>
        <h1>Create work</h1>
        <p>Review the execution envelope before ATLAS persists a canonical workflow.</p>
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
            <select value={ownerModule} onChange={(event) => { setOwnerModule(event.target.value); invalidatePreview(); }}>
              <option value="manager">Manager</option>
              <option value="finance">Finance</option>
              <option value="payroll">Payroll</option>
              <option value="health">Health</option>
              <option value="ride">Ride</option>
              <option value="hospitality">Hospitality</option>
              <option value="studio">Studio</option>
            </select>
          </label>

          <label>
            <span>Execution mode</span>
            <select value={executionMode} onChange={(event) => { setExecutionMode(event.target.value as WorkExecutionMode); invalidatePreview(); }}>
              <option value="hybrid">Hybrid</option>
              <option value="api">API</option>
              <option value="browser">Browser</option>
            </select>
          </label>

          <label>
            <span>Autonomy</span>
            <select value={autonomyLevel} onChange={(event) => { setAutonomyLevel(event.target.value as WorkAutonomyLevel); invalidatePreview(); }}>
              <option value="guided">Guided</option>
              <option value="manual">Manual</option>
              <option value="autonomous">Autonomous</option>
            </select>
          </label>

          <label>
            <span>Runtime</span>
            <select value={runtimePreference} onChange={(event) => { setRuntimePreference(event.target.value as WorkRuntimePreference); invalidatePreview(); }}>
              <option value="auto">Auto</option>
              <option value="local">Local</option>
              <option value="self_hosted">Self-hosted</option>
              <option value="cloud_ephemeral">Cloud ephemeral</option>
            </select>
          </label>

          <label>
            <span>External budget (USD)</span>
            <input
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
          <h3>Success criteria</h3>
          <ul>{preview.successCriteria.map((criterion) => <li key={criterion}>{criterion}</li>)}</ul>
          <p className="notice">This is a draft preview. No provider action has been executed.</p>
          <button type="button" className="execution-action" disabled={creating} onClick={() => void createWorkflow()}>
            {creating ? 'Creating workflow…' : 'Create workflow'}
          </button>
        </section>
      ) : null}
    </section>
  );
}
