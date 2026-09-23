import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { type FormEvent, type ReactNode, useEffect, useMemo, useRef, useState } from 'react';
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
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(() => getCachedAtlasShellOrganization());
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
  const organizationInitials = organizationName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('') || 'AT';
  const closeMobileNav = () => setMobileNavOpen(false);
  const voiceOwnsAssistantSurface = location.pathname === '/studio/voice'
    || location.pathname === '/voice'
    || location.pathname.startsWith('/voice/');

  const searchResults = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return [];
    return ATLAS_NAV_ITEMS
      .filter((item) => item.label.toLowerCase().includes(query) || item.to.toLowerCase().includes(query))
      .slice(0, 7);
  }, [searchQuery]);

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const target = searchResults[0];
    if (!target) return;
    navigate(target.to);
    setSearchQuery('');
    searchRef.current?.blur();
  };

  return (
    <div className="atlas-shell atlas-shell-futuristic">
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
          {ATLAS_NAV_ITEMS.map((item, index) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}
              onClick={closeMobileNav}
            >
              <span className="atlas-nav-glyph" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
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
                    <span>{item.label}</span><small>{item.to}</small>
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
        {organization && !voiceOwnsAssistantSurface ? <AtlasAssistant /> : null}
      </div>
    </div>
  );
}
