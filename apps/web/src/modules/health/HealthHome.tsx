import { HealthDataNotice } from './shared/HealthDataNotice';
import { HealthModuleCard } from './shared/HealthModuleCard';

export function HealthHome() {
  return <section className="health-page health-stack"><div className="health-hero"><div><p className="eyebrow">ATLAS Health</p><h1>Smart Health Ecosystem</h1><p>One governed workspace for health-system proposals, operations, facilities, workforce, finance, intelligence and research.</p></div><div className="health-hero-orbit" aria-hidden="true"><span>A</span></div></div><HealthDataNotice state="demo" text="Operational values in this milestone are ATLAS demonstration data unless a source is explicitly marked live." /><div className="health-entry-grid"><HealthModuleCard title="Business Proposal" description="Explore the AdventHealth proposal workspace." to="/health/proposal/adventhealth" /><HealthModuleCard title="Health Operations" description="Open the Smart Health Command Center and module portfolio." to="/health/operations/command-center" /><HealthModuleCard title="Research & Innovation" description="Enter the governed research workspace." to="/health/research" /></div></section>;
}
