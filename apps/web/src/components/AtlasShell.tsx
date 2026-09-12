import { NavLink } from 'react-router-dom';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ATLAS_SESSION_EVENT,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../lib/atlasSession';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/finance', label: 'Finance' },
  { to: '/finance/accounting/accounts-payable', label: 'Payables' },
  { to: '/health', label: 'Health' },
  { to: '/hospitality/access', label: 'Hospitality' },
  { to: '/studio', label: 'Creator' }
];

export function AtlasShell({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(() => getCachedAtlasShellOrganization());

  useEffect(() => {
    const handleSessionChange = () => {
      setOrganization(getCachedAtlasShellOrganization());
    };

    window.addEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    return () => {
      window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    };
  }, []);

  const organizationName = organization ? organization.name : 'ATLAS Organization';
  const organizationContext = organization
    ? organization.legalName || 'Authenticated organization'
    : 'Verifying organization';
  const roleLabel = organization ? organization.role.toUpperCase() : 'CHECKING';

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
          <div>
            <strong>{organization ? 'Live organization' : 'Identity pending'}</strong>
            <small>{organization ? 'Supabase RLS active' : 'Waiting for authenticated context'}</small>
          </div>
        </div>
      </aside>
      <div className="atlas-workspace">
        <header className="topbar">
          <div><span className="eyebrow">Organization</span><strong>{organizationName}</strong></div>
          <div className="topbar-meta"><span>{organizationContext}</span><span className="badge">{roleLabel}</span></div>
        </header>
        <main>{children}</main>
      </div>
    </div>
  );
}
