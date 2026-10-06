import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ATLAS_SESSION_EVENT,
  getAtlasAccessToken,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../lib/atlasSession';
import { ATLAS_MODULES } from '../modules/registry';
import { searchAtlasNavigation } from '../navigation/atlasNavigation';
import {
  ATLAS_ACCESSIBILITY_PROFILE_EVENT,
  loadAccessibilityProfile,
  loadAccessibilityProfileRemote,
  resolveAccessibilityUserId,
  saveAccessibilityProfile,
  syncAccessibilityProfileRemote
} from '../services/accessibilityProfile';
import type { AccessibilityAction, AccessibilityProfile } from '../types/accessibility';
import { AtlasAccessibility } from './AtlasAccessibility';
import { AtlasAssistant } from './assistant/AtlasAssistant';

export function AtlasShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(() => getCachedAtlasShellOrganization());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [accessibilityProfile, setAccessibilityProfile] = useState<AccessibilityProfile>(() =>
    loadAccessibilityProfile(resolveAccessibilityUserId())
  );

  useEffect(() => {
    const handleSessionChange = () => {
      setOrganization(getCachedAtlasShellOrganization());
      const userId = resolveAccessibilityUserId();
      setAccessibilityProfile(loadAccessibilityProfile(userId));
    };

    window.addEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    return () => {
      window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
    };
  }, []);

  useEffect(() => {
    const handleProfileChange = (event: Event) => {
      const updated = (event as CustomEvent<AccessibilityProfile>).detail;
      if (updated?.userId === accessibilityProfile.userId) setAccessibilityProfile(updated);
    };
    window.addEventListener(ATLAS_ACCESSIBILITY_PROFILE_EVENT, handleProfileChange);
    return () => window.removeEventListener(ATLAS_ACCESSIBILITY_PROFILE_EVENT, handleProfileChange);
  }, [accessibilityProfile.userId]);

  useEffect(() => {
    let cancelled = false;
    void loadAccessibilityProfileRemote(accessibilityProfile.userId)
      .then((remoteProfile) => {
        if (!cancelled && remoteProfile) setAccessibilityProfile(saveAccessibilityProfile(remoteProfile));
      })
      .catch(() => undefined);
    return () => { cancelled = true; };
  }, [accessibilityProfile.userId]);

  const updateAccessibilityProfile = useCallback((updated: AccessibilityProfile) => {
    const normalized = saveAccessibilityProfile(updated);
    setAccessibilityProfile(normalized);
    void syncAccessibilityProfileRemote(normalized);
  }, []);

  const dispatchAccessibilityAction = useCallback((action: AccessibilityAction, payload?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('atlas-accessibility-action', { detail: { action, payload: payload || {} } }));
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

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === 'Escape' && document.activeElement === searchRef.current) {
        setSearchQuery('');
        searchRef.current?.blur();
      }
    };

    window.addEventListener('keydown', focusSearch);
    return () => window.removeEventListener('keydown', focusSearch);
  }, []);

  const hasSession = Boolean(getAtlasAccessToken());
  const organizationName = organization ? organization.name : 'ATLAS Enterprise Suite';
  const organizationContext = organization
    ? organization.legalName || 'Authenticated organization'
    : hasSession
      ? 'Verifying organization'
      : 'Public workspace';
  const roleLabel = organization ? organization.role.toUpperCase() : hasSession ? 'CHECKING' : 'PUBLIC';
  const shellClassName = [
    (location.pathname === '/voice/studio' || location.pathname === '/studio/voice') ? 'atlas-shell-voice-studio' : '',
    'atlas-shell',
    'atlas-shell-futuristic',
    accessibilityProfile.highContrast ? 'accessibility-high-contrast' : '',
    accessibilityProfile.motionReduced ? 'accessibility-reduced-motion' : ''
  ].filter(Boolean).join(' ');
  const organizationInitials = organizationName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AT';
  const closeMobileNav = () => setMobileNavOpen(false);
  const routeOwnsAssistantSurface = location.pathname === '/assistant'
    || location.pathname.startsWith('/assistant/')
    || location.pathname === '/studio/voice'
    || location.pathname === '/voice'
    || location.pathname.startsWith('/voice/');

  const searchResults = useMemo(() => searchAtlasNavigation(searchQuery), [searchQuery]);

  const navigationGroups = useMemo(() => {
    const grouped = new Map<string, Array<{ to: string; label: string }>>();

    for (const module of ATLAS_MODULES) {
      if (!module.showInNavigation) continue;
      const items = grouped.get(module.area) || [];
      items.push({ to: module.route, label: module.navLabel });
      grouped.set(module.area, items);
    }

    const financeItems = grouped.get('Finance') || [];
    financeItems.push(
      { to: '/finance/accounting/accounts-payable', label: 'Payables' },
      { to: '/finance/accounting/accounts-receivable', label: 'Receivables' },
      { to: '/finance/accounting/reports/automotive-sales', label: 'Automotive' }
    );
    grouped.set('Finance', financeItems);

    return Array.from(grouped.entries()).map(([area, items]) => ({ area, items }));
  }, []);

  const isRouteActive = (to: string) =>
    to === '/' ? location.pathname === '/' : location.pathname === to || location.pathname.startsWith(`${to}/`);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = searchResults[0];
    if (!target) return;
    navigate(target.to);
    setSearchQuery('');
    searchRef.current?.blur();
  };

  return (
    <div
      className={shellClassName}
      style={{ fontSize: `${accessibilityProfile.textSizeScale * 100}%` }}
      data-screen-reader-optimized={accessibilityProfile.screenReaderOptimized ? 'true' : 'false'}
      data-braille-preferred={accessibilityProfile.brailleMode ? 'true' : 'false'}
    >
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

        <NavLink className="brand-lockup" to="/" onClick={closeMobileNav} aria-label="ATLAS home">
          <div className="brand-mark atlas-slash-mark" aria-hidden="true"><i /><i /><i /></div>
          <div><span>ATLAS OS</span><small>Total Control</small></div>
        </NavLink>

        <div className="atlas-active-company">
          <span>EMPRESA ACTIVA</span>
          <strong>{organizationName}</strong>
          <small>{organization ? 'Organización verificada' : organizationContext}</small>
        </div>

        <nav aria-label="ATLAS modules">
          <div className="atlas-nav-primary">
            <NavLink
              to="/"
              end
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={closeMobileNav}
            >
              <span className="atlas-nav-glyph" aria-hidden="true">HM</span>
              <span>Home</span>
            </NavLink>
            <NavLink
              to="/suite"
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={closeMobileNav}
            >
              <span className="atlas-nav-glyph" aria-hidden="true">ALL</span>
              <span>All Modules</span>
            </NavLink>
          </div>

          <div className="atlas-nav-groups">
            {navigationGroups.map((group) => {
              const groupActive = group.items.some((item) => isRouteActive(item.to));
              return (
                <details
                  key={`${group.area}-${groupActive ? 'active' : 'idle'}`}
                  className={groupActive ? 'atlas-nav-group is-active' : 'atlas-nav-group'}
                  defaultOpen={groupActive}
                >
                  <summary className="atlas-nav-group-summary">
                    <span>{group.area}</span>
                    <small>{group.items.length}</small>
                    <span className="atlas-nav-chevron" aria-hidden="true">⌄</span>
                  </summary>
                  <div className="atlas-nav-submenu">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
                        onClick={closeMobileNav}
                      >
                        <span className="atlas-nav-glyph" aria-hidden="true">{item.label.slice(0, 3).toUpperCase()}</span>
                        <span>{item.label}</span>
                      </NavLink>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <NavLink
            to="/settings/accessibility/communication"
            className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
            onClick={closeMobileNav}
          >
            <span className="atlas-nav-glyph" aria-hidden="true">A11Y</span>
            <span>Accessibility</span>
          </NavLink>
        </nav>

        {organization ? (
          <div className="environment-card">
            <span className="pulse-dot pulse-dot-live" />
            <div>
              <strong>Sistema operativo</strong>
              <small>Organización activa · RLS</small>
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

        <div className="atlas-sidebar-spatial" aria-hidden="true">
          <span>←</span><div><strong>Explorar espacio</strong><small>Desliza en cualquier dirección</small></div><span>→</span>
        </div>
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
        <header className="topbar atlas-futuristic-topbar">
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

          <form className="atlas-global-search" role="search" onSubmit={submitSearch}>
            <span className="atlas-search-icon" aria-hidden="true">⌕</span>
            <input
              ref={searchRef}
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Buscar en ATLAS..."
              aria-label="Buscar módulos y rutas ATLAS"
              autoComplete="off"
            />
            <kbd>Ctrl K</kbd>
            {searchResults.length > 0 ? (
              <div className="atlas-search-results">
                {searchResults.map((item) => (
                  <button
                    key={item.to}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      navigate(item.to);
                      setSearchQuery('');
                      searchRef.current?.blur();
                    }}
                  >
                    <span>{item.label}</span><small>{item.area} · {item.to}</small>
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <nav className="atlas-top-actions" aria-label="ATLAS quick access">
            <NavLink to="/assistant" aria-label="ATLAS Assistant">AI</NavLink>
            <NavLink to="/connect" aria-label="ATLAS Connect">↗</NavLink>
            <NavLink to="/galaxy" aria-label="ATLAS Galaxy">◇</NavLink>
          </nav>

          <NavLink className="atlas-profile-chip" to="/identity" aria-label="Open identity and organization">
            <span>{organizationInitials}</span>
            <div><strong>{organizationName}</strong><small>{roleLabel}</small></div>
          </NavLink>
        </header>

        <main>{children}</main>
        {organization && !routeOwnsAssistantSurface ? <AtlasAssistant /> : null}
      </div>
      <AtlasAccessibility
        initialProfile={accessibilityProfile}
        onProfileChange={updateAccessibilityProfile}
        onActionTriggered={dispatchAccessibilityAction}
      />
    </div>
  );
}
