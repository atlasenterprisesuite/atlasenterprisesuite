import { useEffect, useState } from 'react';
import { WORKSPACE_GOVERNANCE_REFERENCE, WORKSPACE_GOVERNANCE_SEATS } from '../../../../packages/core/src/businessWorkspacePolicy';
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
      <section className="execution-panel" aria-labelledby="atlas-workspace-governance-title">
        <h2 id="atlas-workspace-governance-title">Business workspace governance — reference model</h2>
        <p>
          ATLAS adapts enterprise workspace concepts to its own identity and permissions.
          These are proposed administrative responsibilities, not an active ChatGPT Business
          connection, provider membership list, or a grant of access.
        </p>
        <ul>
          {WORKSPACE_GOVERNANCE_REFERENCE.map(({ role, description }) => (
            <li key={role}><strong>{role.replaceAll('_', ' ')}</strong>: {description}</li>
          ))}
        </ul>
        <h3>Seat types</h3>
        <p>
          Reference categories: {WORKSPACE_GOVERNANCE_SEATS.join(' / ')}.
          ATLAS has not verified a provider-backed seat inventory or billing entitlement here.
        </p>
        <h3>Safety boundaries</h3>
        <p>
          Invitations, role changes, auto-join, subscriptions and personal-workspace migration
          are not executed from this reference view. Actual actions require ATLAS Identity
          authorization, applicable MFA, organization isolation, audit and explicit spending consent.
        </p>
      </section>
    </section>
  );
}
