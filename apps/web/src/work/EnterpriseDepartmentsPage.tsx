import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ATLAS_MODULES } from '../modules/registry';
import { listWorkflows } from './api';
import { projectEnterpriseDepartments } from './enterpriseDepartments';
import type { WorkWorkflow } from './types';
import { WorkQueue } from './WorkQueue';
import { WorkSubnav } from './WorkSubnav';

export function EnterpriseDepartmentsPage() {
  const [snapshot, setSnapshot] = useState<WorkWorkflow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);
  const [observedAt, setObservedAt] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setSnapshot(null);
    setObservedAt(null);
    setError(null);
    void listWorkflows().then(items => {
      if (!active) return;
      setSnapshot(items);
      setObservedAt(new Date().toISOString());
    }).catch(caught => {
      if (active) setError(caught instanceof Error ? caught.message : 'department_workflows_unavailable');
    });
    return () => { active = false; };
  }, [revision]);

  const projection = snapshot === null ? null : projectEnterpriseDepartments(snapshot);

  return (
    <section className="work-page page-stack">
      <WorkSubnav />
      <header className="page-header work-hero">
        <div>
          <p className="eyebrow">ATLAS Virtual Enterprise OS 777</p>
          <h1>Enterprise departments</h1>
          <p>Organization-scoped workflow activity, module access and governed work intake. Department assignments follow workflow owner modules, not agent presence.</p>
        </div>
        <button type="button" className="execution-action" disabled={snapshot === null && !error} onClick={() => { setSnapshot(null); setObservedAt(null); setError(null); setRevision(n => n + 1); }}>Refresh activity</button>
      </header>
      <p>Workflow statuses are a snapshot, not live agent telemetry or a production certification. Agent messaging and departmental meetings are not yet verified on this surface.</p>
      {observedAt ? <p role="status">Last retrieved: <time dateTime={observedAt}>{new Date(observedAt).toLocaleString()}</time></p> : null}
      {!snapshot && !error ? <p role="status">Loading organization workflows…</p> : null}
      {error ? <p role="alert" className="work-error">Department activity unavailable: {error}</p> : null}
      {projection ? (
        <>
          <div className="work-ops-summary-grid" aria-label="Enterprise departments">
            {projection.departments.map(({ department, workflows, awaitingApproval, completed, blocked, inProgress }) => (
              <section className="execution-panel" key={department.id} aria-labelledby={`department-${department.id}`}>
                <h2 id={`department-${department.id}`}>{department.name}</h2>
                <dl className="work-preview-facts">
                  <div><dt>In progress or delegated</dt><dd>{inProgress}</dd></div>
                  <div><dt>Awaiting approval</dt><dd>{awaitingApproval}</dd></div>
                  <div><dt>Blocked or failed</dt><dd>{blocked}</dd></div>
                  <div><dt>Completed</dt><dd>{completed}</dd></div>
                </dl>
                <div className="work-actions">
                  <Link to={`/work/new?ownerModule=${encodeURIComponent(department.primary)}`}>Create department work</Link>
                  <Link to="/work/approvals">Approval queue</Link>
                </div>
                <h3>Module access</h3>
                <ul>{ATLAS_MODULES.filter(module => (department.modules as readonly string[]).includes(module.id)).map(module => <li key={module.id}><Link to={module.route}>{module.navLabel}</Link></li>)}</ul>
                <details><summary>Workflows ({workflows.length})</summary><WorkQueue workflows={workflows} emptyMessage="No workflows assigned to this department." /></details>
              </section>
            ))}
          </div>
          <section className="execution-panel">
            <h2>Unassigned workflows</h2>
            <p>Unmapped owner modules remain visible rather than being silently reassigned.</p>
            <WorkQueue workflows={projection.unassigned} />
          </section>
        </>
      ) : null}
    </section>
  );
}
