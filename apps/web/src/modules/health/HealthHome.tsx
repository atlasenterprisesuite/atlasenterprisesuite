import { HealthDataNotice } from './shared/HealthDataNotice';
import { HealthModuleCard } from './shared/HealthModuleCard';

export function HealthHome() {
  return (
    <section className="page-stack health-page">
      <header className="page-header">
        <p className="eyebrow">ATLAS Health</p>
        <h1>Smart Health Ecosystem</h1>
        <p>Proposal, operations, and governed research in one tenant-aware ATLAS workspace.</p>
      </header>
      <HealthDataNotice
        state="demo"
        text="Operational data in this milestone is demonstration data unless a source is explicitly marked live."
      />
      <div className="module-grid health-entry-grid">
        <HealthModuleCard title="Business Proposal" description="Explore the AdventHealth proposal workspace." to="/health/proposal/adventhealth" eyebrow="Proposal" />
        <HealthModuleCard title="Health Operations" description="Open the Smart Health Command Center and module portfolio." to="/health/operations" eyebrow="Operations" />
        <HealthModuleCard title="Research & Innovation" description="Enter the governed Health Frontiers research workspace." to="/health/research" eyebrow="Research" />
      </div>
    </section>
  );
}
