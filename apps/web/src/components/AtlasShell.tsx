import { NavLink } from 'react-router-dom';
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AtlasAccessibility } from './AtlasAccessibility';
import {
  ATLAS_ACCESSIBILITY_PROFILE_EVENT,
  loadAccessibilityProfile,
  resolveAccessibilityUserId,
  saveAccessibilityProfile
} from '../services/accessibilityProfile';
import type { AccessibilityAction, AccessibilityProfile } from '../types/accessibility';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/finance', label: 'Finance' },
  { to: '/finance/accounting/accounts-payable', label: 'Payables' },
  { to: '/health', label: 'Health' },
  { to: '/studio', label: 'Creator' },
  { to: '/settings/accessibility/communication', label: 'Settings' }
];

export function AtlasShell({ children }: { children: ReactNode }) {
  const [accessibilityProfile, setAccessibilityProfile] = useState<AccessibilityProfile>(() => (
    loadAccessibilityProfile(resolveAccessibilityUserId())
  ));

  useEffect(() => {
    const handleProfileChange = (event: Event) => {
      const updated = (event as CustomEvent<AccessibilityProfile>).detail;
      if (updated?.userId === accessibilityProfile.userId) setAccessibilityProfile(updated);
    };
    window.addEventListener(ATLAS_ACCESSIBILITY_PROFILE_EVENT, handleProfileChange);
    return () => window.removeEventListener(ATLAS_ACCESSIBILITY_PROFILE_EVENT, handleProfileChange);
  }, [accessibilityProfile.userId]);

  const updateAccessibilityProfile = (updated: AccessibilityProfile) => {
    setAccessibilityProfile(saveAccessibilityProfile(updated));
  };

  const dispatchAccessibilityAction = (action: AccessibilityAction, payload?: Record<string, unknown>) => {
    window.dispatchEvent(new CustomEvent('atlas-accessibility-action', {
      detail: { action, payload: payload || {} }
    }));
  };

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
      <AtlasAccessibility
        initialProfile={accessibilityProfile}
        onProfileChange={updateAccessibilityProfile}
        onActionTriggered={dispatchAccessibilityAction}
      />
    </div>
  );
}
