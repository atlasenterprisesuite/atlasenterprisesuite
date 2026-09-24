import { useEffect, useMemo, useState } from 'react';
import { listWorkflows } from './api';
import type { WorkView, WorkWorkflow } from './types';
import { workflowsByView } from './view-model';
import { WorkQueue } from './WorkQueue';
import { WorkSubnav } from './WorkSubnav';

const viewCopy: Record<Exclude<WorkView, 'all'>, { title: string; description: string; empty: string }> = {
  active: {
    title: 'Active Work',
    description: 'Canonical Work workflows that are still in progress or blocked.',
    empty: 'No active Work workflows.'
  },
  approvals: {
    title: 'Approvals',
    description: 'Workflows whose canonical state is awaiting approval.',
    empty: 'No Work workflows are awaiting approval.'
  },
  history: {
    title: 'History',
    description: 'Completed, failed and cancelled Work workflows.',
    empty: 'No Work workflow history yet.'
  }
};

export function WorkListPage({ view }: { view: Exclude<WorkView, 'all'> }) {
  const [workflows, setWorkflows] = useState<WorkWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const result = await listWorkflows();
        if (!cancelled) setWorkflows(result);
      } catch (caught) {
        if (!cancelled) setError(caught instanceof Error ? caught.message : 'work_list_failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const visible = useMemo(() => workflowsByView(workflows, view), [view, workflows]);
  const copy = viewCopy[view];

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header">
        <p className="eyebrow">ATLAS Work Soberano</p>
        <h1>{copy.title}</h1>
        <p>{copy.description}</p>
      </header>
      {loading ? <p role="status">Loading Work workflows…</p> : null}
      {error ? <p role="alert" className="work-error">Work workflows unavailable: {error}</p> : null}
      {!loading && !error ? <WorkQueue workflows={visible} emptyMessage={copy.empty} /> : null}
    </section>
  );
}
