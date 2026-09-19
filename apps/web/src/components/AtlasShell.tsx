import { NavLink } from 'react-router-dom';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import {
  ATLAS_SESSION_EVENT,
  getCachedAtlasShellOrganization,
  type AtlasShellOrganization
} from '../lib/atlasSession';
import { ATLAS_NAV_ITEMS } from '../modules/registry';
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
  const [organization, setOrganization] = useState<AtlasShellOrganization | null>(() => getCachedAtlasShellOrganization());
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
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, handleSessionChange);
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

  const organizationName = organization ? organization.name : 'ATLAS Organization';
  const organizationContext = organization ? organization.legalName || 'Authenticated organization' : 'Verifying organization';
  const roleLabel = organization ? organization.role.toUpperCase() : 'CHECKING';
  const shellClassName = [
    'atlas-shell',
    accessibilityProfile.highContrast ? 'accessibility-high-contrast' : '',
    accessibilityProfile.motionReduced ? 'accessibility-reduced-motion' : ''
  ].filter(Boolean).join(' ');

  return (
    <div
      className={shellClassName}
      style={{ fontSize: `${accessibilityProfile.textSizeScale * 100}%` }}
      data-screen-reader-optimized={accessibilityProfile.screenReaderOptimized ? 'true' : 'false'}
      data-braille-preferred={accessibilityProfile.brailleMode ? 'true' : 'false'}
    >
      <aside className="atlas-sidebar">
        <div className="brand-lockup">
          <div className="brand-mark">A</div>
          <div><span>ATLAS</span><small>Enterprise Suite</small></div>
        </div>
        <nav aria-label="ATLAS modules">
          {ATLAS_NAV_ITEMS.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
              {item.label}
            </NavLink>
          ))}
          <NavLink to="/settings/accessibility/communication" className={({ isActive }) => isActive ? 'nav-item active' : 'nav-item'}>
            Accessibility
          </NavLink>
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
        {organization ? <AtlasAssistant /> : null}
      </div>
      <AtlasAccessibility
        initialProfile={accessibilityProfile}
        onProfileChange={updateAccessibilityProfile}
        onActionTriggered={dispatchAccessibilityAction}
      />
    </div>
  );
}
