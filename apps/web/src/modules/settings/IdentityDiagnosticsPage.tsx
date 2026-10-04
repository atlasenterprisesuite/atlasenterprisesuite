import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCachedAtlasShellOrganization } from '../../lib/atlasSession';
import { getMobileStatus } from '../../mobile/client';
import {
  serializeIdentityDiagnostics,
  type SafeIdentityDiagnostics
} from '../../mobile/identityDiagnostics';

const INITIAL_DIAGNOSTICS: SafeIdentityDiagnostics = {
  state: 'unverified',
  authenticated: null,
  organizationResolved: null,
  identityProvider: null,
  role: null,
  organizationId: null
};

const STATE_LABELS: Record<SafeIdentityDiagnostics['state'], string> = {
  verified: 'Verified',
  unverified: 'Unverified',
  expired: 'Expired',
  unavailable: 'Unavailable',
  error: 'Error'
};

export function IdentityDiagnosticsPage() {
  const [diagnostics, setDiagnostics] = useState<SafeIdentityDiagnostics>(INITIAL_DIAGNOSTICS);
  const [loading, setLoading] = useState(true);
  const cachedOrganization = getCachedAtlasShellOrganization();

  useEffect(() => {
    let cancelled = false;

    void getMobileStatus()
      .then((status) => {
        if (cancelled) return;
        setDiagnostics(serializeIdentityDiagnostics({
          authenticated: status.authenticated === true,
          organizationResolved: Boolean(status.organization_id),
          sessionState: 'current',
          identityProvider: 'supabase',
          role: status.role,
          organizationId: status.organization_id
        }));
      })
      .catch((error) => {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : 'identity_status_unavailable';
        if (message === 'session_expired') {
          setDiagnostics(serializeIdentityDiagnostics({
            authenticated: false,
            organizationResolved: false,
            sessionState: 'expired'
          }));
          return;
        }
        if (message === 'authentication_required') {
          setDiagnostics(serializeIdentityDiagnostics({
            authenticated: false,
            organizationResolved: false,
            sessionState: 'unknown'
          }));
          return;
        }
        if (message === 'mobile_status_invalid_response') {
          setDiagnostics(serializeIdentityDiagnostics({
            authenticated: null,
            organizationResolved: null,
            sessionState: 'error'
          }));
          return;
        }
        setDiagnostics(serializeIdentityDiagnostics({
          authenticated: null,
          organizationResolved: null,
          sessionState: 'unavailable'
        }));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="mobile-settings-page" aria-labelledby="identity-diagnostics-title">
      <p className="eyebrow">ATLAS Settings · Security</p>
      <h2 id="identity-diagnostics-title">Identity diagnostics</h2>
      <p>Current identity and organization evidence is derived from the authenticated ATLAS gateway. Unknown evidence remains Unverified.</p>

      <div className="mobile-settings-unavailable" role="status">
        <strong>{loading ? 'Checking' : STATE_LABELS[diagnostics.state]}</strong>
        <span>Session: {diagnostics.authenticated === true ? 'authenticated' : diagnostics.authenticated === false ? 'not authenticated' : 'unknown'}</span>
        <span>Organization: {diagnostics.organizationResolved === true ? 'resolved' : diagnostics.organizationResolved === false ? 'not resolved' : 'unknown'}</span>
        <span>Provider: {diagnostics.identityProvider || 'Unavailable'}</span>
        <span>Role: {diagnostics.role || 'Unavailable'}</span>
        <span>Organization ID: {diagnostics.organizationId || 'Unavailable'}</span>
      </div>

      {cachedOrganization ? (
        <p className="mobile-settings-note">Local shell context: {cachedOrganization.name}. This label is informational and does not promote server evidence.</p>
      ) : (
        <p className="mobile-settings-note">No local organization label is cached.</p>
      )}

      <Link className="text-link" to="/identity">Open identity and organization</Link>
    </section>
  );
}
