import { NavLink } from 'react-router-dom';
import type { ReactNode } from 'react';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/finance', label: 'Finance' },
  { to: '/finance/accounting/accounts-payable', label: 'Payables' },
  { to: '/telecom/devices/mifi', label: 'Telecom' },
  { to: '/health', label: 'Health' }
];

export function AtlasShell({ children }: { children: ReactNode }) {
  return (
    <div className="atlas-shell">
      <aside className="atlas-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">A</div>
          <div><span>ATLAS</span><small>Enterprise Suite</small></div>
        </div>
        <nav aria-label="ATLAS modules">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="environment-card">
          <span className="pulse-dot" />
          <div><strong>Demo adapter</strong><small>No live financial rails</small></div>
        </div>
      </aside>
      <div className="atlas-workspace">
        <header className="topbar">
          <div><span className="eyebrow">Organization</span><strong>ATLAS Demo Organization</strong></div>
          <div className="topbar-meta"><span>tenant-demo / org-demo</span><span className="badge">READ ONLY</span></div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
