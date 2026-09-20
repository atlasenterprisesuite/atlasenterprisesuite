import { NavLink, useLocation } from 'react-router-dom';
import { type ReactNode, useEffect, useState } from 'react';
import {
  ATLAS_SESSION_EVENT,
  getAtlasAccessToken,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../lib/atlasSession';
import { ATLAS_NAV_ITEMS } from '../modules/registry';
import { AtlasAssistant } from './assistant/AtlasAssistant';

export function AtlasShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(() => getCachedAtlasShellOrganization());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  useEffect(() => {
    const handleSessionChange = () => {
      setOrganization(getCachedAtlasShellOrganization());
    };

    window.addEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    return () => {
      window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    };
  }, []);

  useEffect(() => {
    if (!mobileNavOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMobileNavOpen(false);
    };
    const desktopMedia = window.matchMedia('(min-width: 1025px)');
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setMobileNavOpen(false);
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', closeOnEscape);
    desktopMedia.addEventListener('change', closeOnDesktop);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', closeOnEscape);
      desktopMedia.removeEventListener('change', closeOnDesktop);
    };
  }, [mobileNavOpen]);

  const hasSession = Boolean(getAtlasAccessToken());
  const organizationName = organization ? organization.name : 'ATLAS Enterprise Suite';
  const organizationContext = organization
    ? organization.legalName || 'Authenticated organization'
    : hasSession
      ? 'Verifying organization'
      : 'Public workspace';
  const roleLabel = organization ? organization.role.toUpperCase() : hasSession ? 'CHECKING' : 'PUBLIC';
  const closeMobileNav = () => setMobileNavOpen(false);
  const voiceOwnsAssistantSurface = location.pathname === '/studio/voice'
    || location.pathname === '/voice'
    || location.pathname.startsWith('/voice/');

  return (
    <div className="atlas-shell">
      <aside
        id="atlas-primary-navigation"
        className={mobileNavOpen ? 'atlas-sidebar is-open' : 'atlas-sidebar'}
        aria-label="ATLAS navigation"
      >
        <button
          type="button"
          className="atlas-mobile-nav-close"
          aria-label="Close ATLAS navigation"
          onClick={closeMobileNav}
        >
          <span aria-hidden="true">×</span>
        </button>
        <div className="brand-lockup">
          <div className="brand-mark">A</div>
          <div><span>ATLAS</span><small>Enterprise Suite</small></div>
        </div>
        <nav aria-label="ATLAS modules">
          {ATLAS_NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={closeMobileNav}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        {organization ? (
          <div className="environment-card">
            <span className="pulse-dot" />
            <div>
              <strong>Live organization</strong>
              <small>Supabase RLS active</small>
            </div>
          </div>
        ) : (
          <NavLink className="environment-card environment-card-link" to="/identity" onClick={closeMobileNav}>
            <span className="pulse-dot" />
            <div>
              <strong>{hasSession ? 'Identity pending' : 'Sign in'}</strong>
              <small>{hasSession ? 'Verify organization access' : 'Open secure organization access'}</small>
            </div>
          </NavLink>
        )}
      </aside>

      {mobileNavOpen ? (
        <button
          type="button"
          className="atlas-nav-backdrop"
          aria-label="Close ATLAS navigation"
          onClick={closeMobileNav}
        />
      ) : null}

      <div className="atlas-workspace">
        <header className="topbar">
          <button
            type="button"
            className="atlas-mobile-nav-toggle"
            aria-label="Open ATLAS navigation"
            aria-controls="atlas-primary-navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((current) => !current)}
          >
            <span className="atlas-mobile-nav-icon" aria-hidden="true"><i /><i /><i /></span>
            <span>Menu</span>
          </button>
          <div className="topbar-organization">
            <span className="eyebrow">Organization</span>
            <strong>{organizationName}</strong>
          </div>
          <div className="topbar-meta"><span>{organizationContext}</span><span className="badge">{roleLabel}</span></div>
        </header>
        <main>{children}</main>
        {organization && !voiceOwnsAssistantSurface ? <AtlasAssistant /> : null}
      </div>
    </div>
  );
}
