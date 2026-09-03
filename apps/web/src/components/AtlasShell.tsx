import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';

const enterpriseLinks = [
  { to: '/', label: 'Enterprise' },
  { to: '/health', label: 'Health' },
  { to: '/health/research', label: 'Research & Innovation' }
];

export function AtlasShell({ children }: { children: ReactNode }) {
  return (
    <div className="atlas-shell">
      <header className="topbar">
        <Link className="brand" to="/" aria-label="ATLAS Enterprise Suite home">
          <span className="brand-mark">A</span>
          <span><strong>ATLAS</strong><small>Enterprise Suite</small></span>
        </Link>
        <nav className="topnav" aria-label="Primary navigation">
          {enterpriseLinks.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'active' : undefined}>
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="environment-chip" title="No production integrations configured">Development</div>
      </header>
      <main className="app-main">{children}</main>
      <footer className="app-footer">
        <span>ATLAS Health research environment</span>
        <span>Scientific integrity: provenance · uncertainty · falsification</span>
      </footer>
    </div>
  );
}
