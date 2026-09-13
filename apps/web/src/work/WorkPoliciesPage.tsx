import { ExecutionConfiguration } from './ExecutionConfiguration';
import { WorkSubnav } from './WorkSubnav';

export function WorkPoliciesPage() {
  return (
    <section className="work-page page-stack">
      <header className="page-header"><p className="eyebrow">ATLAS Work Soberano</p><h1>Policies</h1><p>Current fail-closed defaults for new Work workflows. Provider authorization, permissions and approvals remain server-authoritative.</p></header>
      <WorkSubnav />
      <section className="execution-panel" aria-labelledby="work-default-policy-title">
        <h2 id="work-default-policy-title">Default execution policy</h2>
        <ExecutionConfiguration executionMode="hybrid" autonomyLevel="guided" runtimePreference="auto" budgetLimit={0} />
        <p className="notice">Autonomous never bypasses tenant scope, permissions, approval policy, execution envelopes, regulated-domain rules or the paid-provider budget.</p>
      </section>
    </section>
  );
}
