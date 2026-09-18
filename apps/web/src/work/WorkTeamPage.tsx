import { useEffect, useState } from 'react';
import { executionPermissionsForRole, type ExecutionPermission } from '../../../../packages/execution/src/types';
import { getActiveAtlasOrganization } from '../lib/atlasSession';
import { WorkSubnav } from './WorkSubnav';

export function WorkTeamPage() {
  const [organization, setOrganization] = useState<{ id: string; role: string } | null>(null);
  const [permissions, setPermissions] = useState<ExecutionPermission[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void getActiveAtlasOrganization()
      .then((next) => {
        if (!active) return;
        setOrganization(next);
        setPermissions(executionPermissionsForRole(next.role));
      })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : 'work_team_unavailable'); });
    return () => { active = false; };
  }, []);

  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Team</h1><p>Current organization identity and execution permissions. This view does not invent team-management capabilities.</p></header>
      <WorkSubnav />
      {error ? <div role="alert" className="work-error">{error}</div> : null}
      {!organization && !error ? <p aria-busy="true">Loading organization access…</p> : null}
      {organization ? (
        <section className="execution-panel">
          <h2>Current access</h2>
          <dl className="work-preview-facts">
            <div><dt>Organization</dt><dd>{organization.id}</dd></div>
            <div><dt>Role</dt><dd>{organization.role}</dd></div>
          </dl>
          <h3>Execution permissions</h3>
          {permissions.length ? <ul>{permissions.map((permission) => <li key={permission}><code>{permission}</code></li>)}</ul> : <p>No execution permissions are derived for this role.</p>}
        </section>
      ) : null}
    </section>
  );
}
