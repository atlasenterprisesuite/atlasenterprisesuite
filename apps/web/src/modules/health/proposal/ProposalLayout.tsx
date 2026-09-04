import { Outlet } from 'react-router-dom';
import { HealthDataNotice } from '../shared/HealthDataNotice';
import { ProposalNav } from './ProposalNav';

export function ProposalLayout() {
  return (
    <section className="page-stack health-page proposal-workspace">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health / Proposal</p>
        <h1>AdventHealth Business Proposal</h1>
        <p>A route-driven concept workspace for evaluating an ATLAS Smart Health pilot, governance model, integration strategy, and measurable implementation framework.</p>
      </header>
      <HealthDataNotice
        state="demo"
        text="Illustrative proposal environment. It does not represent a live AdventHealth deployment, endorsement, production integration, or production metric feed."
      />
      <ProposalNav />
      <div className="workspace-card proposal-section-surface">
        <Outlet />
      </div>
    </section>
  );
}
