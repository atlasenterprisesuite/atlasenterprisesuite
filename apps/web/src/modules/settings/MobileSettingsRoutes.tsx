import { Navigate, Route, Routes } from 'react-router-dom';
import { IdentityDiagnosticsPage } from './IdentityDiagnosticsPage';
import { MobileSettingsLayout, MOBILE_SETTINGS_SECTIONS } from './MobileSettingsLayout';
import './mobileSettings.css';

export { MOBILE_SETTINGS_SECTIONS };

function UnavailableSettingsPage({ title, description }: { title: string; description: string }) {
  return (
    <section className="mobile-settings-page" aria-labelledby={`mobile-settings-${title.toLowerCase()}`}>
      <p className="eyebrow">ATLAS Settings</p>
      <h2 id={`mobile-settings-${title.toLowerCase()}`}>{title}</h2>
      <p>{description}</p>
      <div className="mobile-settings-unavailable" role="status">
        <strong>Unavailable</strong>
        <span>This capability is not represented as configured until its backend evidence and controls are implemented.</span>
      </div>
    </section>
  );
}

function SettingsNotFound() {
  return (
    <section className="mobile-settings-page">
      <p className="eyebrow">ATLAS Settings</p>
      <h2>Settings route not found</h2>
      <p>The requested settings section is not part of the approved ATLAS settings graph.</p>
    </section>
  );
}

export function MobileSettingsRoutes() {
  return (
    <Routes>
      <Route path="/settings" element={<MobileSettingsLayout />}>
        <Route index element={<Navigate to="/settings/account" replace />} />
        <Route path="account" element={<UnavailableSettingsPage title="Account" description="Identity and organization account controls." />} />
        <Route path="preferences" element={<UnavailableSettingsPage title="Preferences" description="Personal application preferences." />} />
        <Route path="privacy" element={<UnavailableSettingsPage title="Privacy" description="Consent and device permission evidence." />} />
        <Route path="security" element={<IdentityDiagnosticsPage />} />
        <Route path="billing" element={<UnavailableSettingsPage title="Billing" description="Plan and entitlement evidence." />} />
        <Route path="diagnostics" element={<UnavailableSettingsPage title="Diagnostics" description="Runtime and support diagnostics." />} />
        <Route path="about" element={<UnavailableSettingsPage title="About" description="ATLAS app and runtime information." />} />
        <Route path="*" element={<SettingsNotFound />} />
      </Route>
    </Routes>
  );
}
