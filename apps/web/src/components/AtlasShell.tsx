import { useEffect, useState, type ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { ATLAS_SESSION_EVENT, getAtlasAccessToken } from '../lib/atlasSession';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/finance', label: 'Finance' },
  { to: '/finance/accounting/dashboard', label: 'Accounting' },
  { to: '/finance/accounting/accounts-payable', label: 'Payables + AI' },
  { to: '/health', label: 'Health' },
  { to: '/studio', label: 'Creator' }
];

export function AtlasShell({ children }: { children: ReactNode }) {
  const [authenticated, setAuthenticated] = useState(() => Boolean(getAtlasAccessToken()));

  useEffect(() => {
    const sync = () => setAuthenticated(Boolean(getAtlasAccessToken()));
    window.addEventListener(ATLAS_SESSION_EVENT, sync);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, sync);
  }, []);

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
          <div><strong>{authenticated ? 'Supabase RLS session' : 'Identity required'}</strong><small>{authenticated ? 'Live data remains organization-scoped' : 'No live accounting data is exposed'}</small></div>
        </div>
      </aside>
      <div className="atlas-workspace">
        <header className="topbar">
          <div><span className="eyebrow">Organization</span><strong>{authenticated ? 'Authenticated ATLAS scope' : 'No active identity'}</strong></div>
          <div className="topbar-meta"><span>Accounting · Finance</span><span className="badge">{authenticated ? 'RLS LIVE' : 'GATED'}</span></div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
