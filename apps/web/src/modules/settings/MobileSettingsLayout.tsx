import { NavLink, Outlet } from 'react-router-dom';
import { useMobileRuntime } from '../../mobile/useMobileRuntime';

export const MOBILE_SETTINGS_SECTIONS = [
  { label: 'Account', to: '/settings/account', description: 'Identity and organization context.' },
  { label: 'Preferences', to: '/settings/preferences', description: 'Personal ATLAS application preferences.' },
  { label: 'Privacy', to: '/settings/privacy', description: 'Consent and device permission evidence.' },
  { label: 'Security', to: '/settings/security', description: 'Identity and session diagnostics.' },
  { label: 'Billing', to: '/settings/billing', description: 'Plan and entitlement evidence.' },
  { label: 'Diagnostics', to: '/settings/diagnostics', description: 'Safe runtime and support diagnostics.' },
  { label: 'About', to: '/settings/about', description: 'ATLAS app, build and runtime information.' }
] as const;

function RuntimeEvidenceBanner() {
  const runtime = useMobileRuntime();

  if (runtime.status === 'loading') {
    return <div className="mobile-settings-runtime" role="status"><strong>Checking runtime evidence</strong><span>ATLAS is validating the current browser and server state.</span></div>;
  }

  if (runtime.status === 'error') {
    return <div className="mobile-settings-runtime is-warning" role="status"><strong>Runtime evidence unavailable</strong><span>Current server evidence is unavailable. State remains stale/unverified.</span></div>;
  }

  return (
    <div className="mobile-settings-runtime" role="status">
      <strong>{runtime.local.runtime === 'web' ? 'Web runtime' : runtime.local.runtime}</strong>
      <span>{runtime.local.deviceClass} · {runtime.local.osFamily || 'OS unknown'} · server evidence loaded</span>
    </div>
  );
}

export function MobileSettingsLayout() {
  return (
    <section className="mobile-settings-shell">
      <header className="mobile-settings-header">
        <p className="eyebrow">ATLAS Platform</p>
        <h1>Settings</h1>
        <p>Account, privacy, security, billing and support controls share one governed settings surface.</p>
      </header>

      <RuntimeEvidenceBanner />

      <div className="mobile-settings-grid">
        <nav className="mobile-settings-nav" aria-label="ATLAS settings">
          {MOBILE_SETTINGS_SECTIONS.map((section) => (
            <NavLink
              key={section.to}
              to={section.to}
              className={({ isActive }) => isActive ? 'mobile-settings-link is-active' : 'mobile-settings-link'}
            >
              <strong>{section.label}</strong>
              <span>{section.description}</span>
            </NavLink>
          ))}
        </nav>
        <div className="mobile-settings-content"><Outlet /></div>
      </div>
    </section>
  );
}
