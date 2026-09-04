import { Link, Outlet } from 'react-router-dom';
import { OperationsNav } from './OperationsNav';

export function OperationsLayout() {
  return <section className="health-page health-stack"><div className="proposal-banner"><div><p className="eyebrow">ATLAS Health</p><strong>Operations Workspace</strong></div><Link className="health-secondary-action" to="/health/proposal/adventhealth">Proposal Mode</Link></div><OperationsNav /><Outlet /></section>;
}
