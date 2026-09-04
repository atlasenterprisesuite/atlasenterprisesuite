import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAtlasContext } from '../providers/AtlasContext';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/finance', label: 'Finance' },
  { to: '/finance/accounting', label: 'Accounting' },
  { to: '/finance/accounting/accounts-payable', label: 'Payables' },
  { to: '/health', label: 'Health' }
];

export function AtlasShell({ children }: { children: ReactNode }) {
  const { scope, environment } = useAtlasContext();
  const demo = environment === 'demo';

  return (
    <div className="atlas-shell">
      <aside className="atlas-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark" aria-hidden="true">A</div>
          <div><span>ATLAS</span><small>Enterprise Suite</small></div>
        </div>
        <nav aria-label="ATLAS modules">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="environment-card">
          <span className="pulse-dot" aria-hidden="true" />
          <div>
            <strong>{demo ? 'Demo adapter' : 'Production context'}</strong>
            <small>{demo ? 'No live integration implied' : 'Integration state verified per module'}</small>
          </div>
        </div>
      </aside>
      <div className="atlas-workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Organization</span>
            <strong>{demo ? 'ATLAS Demo Organization' : scope.organizationId}</strong>
          </div>
          <div className="topbar-meta">
            <span>{scope.tenantId} / {scope.organizationId}</span>
            <span className="badge">{environment.toUpperCase()}</span>
          </div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
