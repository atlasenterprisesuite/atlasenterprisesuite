import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { loadGuidedExecutionState } from './api';
import { ExecutionBreadcrumbs } from './ExecutionBreadcrumbs';
import { TaskGroup } from './TaskGroup';
import type { GuidedExecutionState } from './types';
import { activeTask } from './view-model';
import { WorkflowHeader } from './WorkflowHeader';

export function GuidedExecutionPage() {
  const { workflowId = '' } = useParams();
  const [data, setData] = useState<GuidedExecutionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);

  const adoptState = useCallback((next: GuidedExecutionState) => {
    setData(next);
    const currentTask = next.tasks.find((task) => task.id === next.workflow.currentTaskId) ?? next.tasks[0];
    setSelectedStepId(currentTask?.currentStepId ?? null);
  }, []);

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
      adoptState(await loadGuidedExecutionState(workflowId));
    } catch (caught) {
      setData(null);
      setError(caught instanceof Error ? caught.message : 'execution_unavailable');
    } finally {
      setLoading(false);
    }
  }, [adoptState, workflowId]);

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
        adoptState(next);
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
  }, [adoptState, workflowId]);

  if (loading) return <section aria-busy="true"><h1>Loading execution workflow</h1></section>;
  if (error === 'workflow_not_found') return <section><h1>Workflow not found</h1><p>The workflow is unavailable in the active organization.</p></section>;
  if (error) return <section role="alert"><h1>Execution unavailable</h1><p>{error}</p><button type="button" onClick={reload}>Retry</button></section>;
  if (!data) return <section><h1>No execution state</h1></section>;

  const currentTask = activeTask(data);
  const selectedStep = data.steps.find((step) => step.id === selectedStepId) ?? null;

  return (
    <section className="page-stack execution-page">
      <ExecutionBreadcrumbs workflow={data.workflow} />
      <WorkflowHeader state={data} task={currentTask} />
      <div className="execution-layout">
        <div className="execution-task-list" aria-label="Execution tasks">
          {data.tasks.length === 0 ? <div className="empty-state"><strong>No tasks</strong><span>This workflow has no persisted tasks.</span></div> : data.tasks.map((task, index) => (
            <TaskGroup
              key={task.id}
              task={task}
              taskNumber={index + 1}
              steps={data.steps.filter((step) => step.taskId === task.id).sort((a, b) => a.sequence - b.sequence)}
              selectedStepId={selectedStepId}
              current={task.id === currentTask?.id}
              onSelectStep={setSelectedStepId}
            />
          ))}
        </div>
        <aside className="execution-selection" aria-label="Selected execution step">
          {selectedStep ? (
            <>
              <p className="eyebrow">Selected step</p>
              <h2>{selectedStep.actionType.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())}</h2>
              <p>Status: {selectedStep.status.replaceAll('_', ' ')}</p>
            </>
          ) : <p>Select a persisted step to inspect its execution details.</p>}
          <button type="button" className="execution-action" onClick={reload}>Refresh workflow</button>
        </aside>
      </div>
    </section>
  );
}
