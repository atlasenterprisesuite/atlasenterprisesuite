import { Link, Outlet } from 'react-router-dom';
import { ProposalNav } from './ProposalNav';
import { HealthDataNotice } from '../shared/HealthDataNotice';

export function ProposalLayout() {
  return <section className="health-page health-stack proposal-workspace"><div className="proposal-banner"><div><p className="eyebrow">ATLAS Health · Business Proposal</p><strong>AdventHealth Smart Health Ecosystem</strong></div><Link className="health-secondary-action" to="/health/operations/command-center">View Operations Mode</Link></div><HealthDataNotice state="demo" text="Concept proposal only. AdventHealth endorsement, deployment and production metrics are not represented." /><ProposalNav /><Outlet /></section>;
}
