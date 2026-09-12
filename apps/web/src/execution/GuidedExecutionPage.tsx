import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadGuidedExecutionState } from './api';
import type { GuidedExecutionState } from './types';

export function GuidedExecutionPage() {
  const { workflowId = '' } = useParams();
  const [data, setData] = useState<GuidedExecutionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!workflowId) {
      setData(null);
      setError('workflow_not_found');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await loadGuidedExecutionState(workflowId);
      setData(next);
      const currentTask = next.tasks.find((task) => task.id === next.workflow.currentTaskId) ?? next.tasks[0];
      setSelectedStepId(currentTask?.currentStepId ?? null);
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'execution_unavailable');
    } finally {
      setLoading(false);
    }
  }, [workflowId]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    if (!workflowId) {
      setData(null);
      setError('workflow_not_found');
      setLoading(false);
      return () => { active = false; };
    }

    void loadGuidedExecutionState(workflowId)
      .then((next) => {
        if (!active) return;
        setData(next);
        const currentTask = next.tasks.find((task) => task.id === next.workflow.currentTaskId) ?? next.tasks[0];
        setSelectedStepId(currentTask?.currentStepId ?? null);
      })
      .catch((caught) => {
        if (!active) return;
        setData(null);
        setError(caught instanceof Error ? caught.message : 'execution_unavailable');
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [workflowId]);

  if (loading) return <section aria-busy="true"><h1>Loading execution workflow</h1></section>;
  if (error === 'workflow_not_found') return <section><h1>Workflow not found</h1><p>The workflow is unavailable in the active organization.</p></section>;
  if (error) return <section role="alert"><h1>Execution unavailable</h1><p>{error}</p><button type="button" onClick={reload}>Retry</button></section>;
  if (!data) return <section><h1>No execution state</h1></section>;

  const activeTask = data.tasks.find((task) => task.id === data.workflow.currentTaskId) ?? data.tasks[0];

  return (
    <section className="page-stack" data-selected-step-id={selectedStepId ?? undefined}>
      <header className="page-header">
        <p className="eyebrow">ATLAS Guided Execution</p>
        <h1>{activeTask?.title || 'Execution workflow'}</h1>
        <p>{activeTask?.goal || 'No active task is available for this workflow.'}</p>
      </header>
      <div className="notice">
        Canonical execution state is loaded from the active organization. Refreshing this page reloads the workflow from the backend.
      </div>
      <button type="button" onClick={reload}>Refresh workflow</button>
    </section>
  );
}
