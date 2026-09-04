import { Link } from 'react-router-dom';

export function EnterpriseHome() {
  return <section className="page-stack"><header className="page-header"><p className="eyebrow">ATLAS Enterprise Suite</p><h1>One governed enterprise ecosystem</h1><p>Business and health modules share one shell, routing model, tenant boundaries and audit-ready contracts.</p></header><div className="module-grid"><Link className="module-card enabled" to="/finance"><span>Business</span><strong>Finance</strong><p>Accounting and financial operations.</p></Link><Link className="module-card enabled" to="/health"><span>Health</span><strong>ATLAS Health</strong><p>Smart Health proposal, operations and governed research.</p></Link></div></section>;
}
