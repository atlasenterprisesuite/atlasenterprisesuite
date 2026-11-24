import { type FormEvent, useEffect, useState } from 'react';
import {
  type AtlasMfaFactor,
  type AtlasTotpEnrollment,
  challengeAndVerifyAtlasTotp,
  enrollAtlasTotp,
  getAtlasMfaFactors,
  verifyAtlasMfaIdentity
} from '../lib/atlasMfa';

type Phase = 'loading' | 'ready' | 'enrolling' | 'verified' | 'error';

function humanMfaError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message === 'mfa_six_digit_code_required') return 'Enter the six-digit code from your authenticator.';
  if (message === 'mfa_aal2_session_not_proven') return 'Supabase did not confirm an AAL2 session. Access remains restricted.';
  if (message === 'session_expired' || message === 'authentication_required') return 'Your session expired. Sign in again before setting up MFA.';
  return 'Supabase could not verify this factor. Check the code and try again.';
}

/**
 * Signed-in account holder only. Factor enrollment must be intentional and
 * verified by Supabase Auth, never by a database admin or a local simulation.
 */
export function AtlasMfaPanel({ onSignOut }: { onSignOut: () => void }) {
  const [phase, setPhase] = useState<Phase>('loading');
  const [verifiedFactors, setVerifiedFactors] = useState<AtlasMfaFactor[]>([]);
  const [enrollment, setEnrollment] = useState<AtlasTotpEnrollment | null>(null);
  const [selectedFactorId, setSelectedFactorId] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;
    void (async () => {
      try {
        await verifyAtlasMfaIdentity();
        const factors = await getAtlasMfaFactors();
        if (mounted) {
          setVerifiedFactors(factors);
          setSelectedFactorId(factors[0]?.id || '');
          setPhase('ready');
        }
      } catch (cause) {
        if (mounted) {
          setError(humanMfaError(cause));
          setPhase('error');
        }
      }
    })();
    return () => { mounted = false; };
  }, []);

  async function beginEnrollment() {
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const next = await enrollAtlasTotp();
      setEnrollment(next);
      setSelectedFactorId(next.id);
      setCode('');
      setPhase('enrolling');
    } catch (cause) {
      setError(humanMfaError(cause));
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setError('');
    setBusy(true);
    try {
      await challengeAndVerifyAtlasTotp(selectedFactorId, code.trim());
      setCode('');
      setEnrollment(null);
      setPhase('verified');
    } catch (cause) {
      setError(humanMfaError(cause));
    } finally {
      setBusy(false);
    }
  }

  if (phase === 'loading') return <p role="status">Checking your ATLAS Auth session…</p>;
  if (phase === 'error') {
    return <div role="alert"><p>{error}</p><button type="button" onClick={onSignOut}>Sign out and try again</button></div>;
  }
  if (phase === 'verified') {
    return <div role="status">
      <h2>MFA verified</h2>
      <p>Supabase issued an AAL2 session. Protected administrative actions still require independent server authorization.</p>
      <a href="/">Return to ATLAS</a>
    </div>;
  }

  return (
    <section aria-labelledby="atlas-mfa-title" className="identity-form">
      <h2 id="atlas-mfa-title">Multi-factor authentication</h2>
      <p>Add an authenticator app to your own ATLAS account. Supabase—not ATLAS UI—verifies your six-digit code.</p>
      {phase === 'enrolling' && enrollment ? (
        <>
          <p>Scan this QR code with an authenticator app. Keep your backup access in a safe place.</p>
          <img
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(enrollment.totp.qr_code)}`}
            alt="QR code for adding ATLAS to an authenticator app"
            width={208}
            height={208}
          />
          <p>Can't scan? Enter this setup key into your authenticator app:</p>
          <code style={{ overflowWrap: 'anywhere' }}>{enrollment.totp.secret}</code>
          <p>This key is displayed only during enrollment and is not saved in ATLAS storage.</p>
        </>
      ) : (
        <>
          {verifiedFactors.length > 0 ? (
            <label className="field">
              <span>Verified authenticator</span>
              <select
                value={selectedFactorId}
                onChange={(event) => setSelectedFactorId(event.target.value)}
                disabled={busy}
              >
                {verifiedFactors.map((factor) => (
                  <option key={factor.id} value={factor.id}>{factor.friendly_name || 'Authenticator app'}</option>
                ))}
              </select>
            </label>
          ) : <p>No verified authenticator was found for this account.</p>}
          <button type="button" className="identity-submit" onClick={beginEnrollment} disabled={busy}>
            {busy ? 'Connecting…' : 'Add an authenticator'}
          </button>
        </>
      )}
      {(phase === 'enrolling' || selectedFactorId && verifiedFactors.length > 0) ? (
        <form className="identity-form" onSubmit={verifyCode}>
          <label className="field">
            <span>Six-digit authenticator code</span>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
              required
              disabled={busy}
            />
          </label>
          {error ? <p className="identity-error" role="alert">{error}</p> : null}
          <button type="submit" className="identity-submit" disabled={busy || code.length !== 6}>
            {busy ? 'Verifying…' : 'Verify MFA with Supabase'}
          </button>
        </form>
      ) : error ? <p className="identity-error" role="alert">{error}</p> : null}
      <p>Never share your setup key or one-time codes. Enrollment and AAL2 validation are required for privileged access.</p>
    </section>
  );
}
