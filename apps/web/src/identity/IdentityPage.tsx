import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  clearAtlasSession,
  enrollAtlasTotp,
  getActiveAtlasOrganization,
  getAtlasAccessToken,
  getAtlasMfaState,
  signInAtlas,
  type AtlasTotpEnrollment,
  verifyAtlasMfa
} from '../lib/atlasSession';
import './identity.css';

const DEFAULT_TARGET = '/';
const SUPPORTED_PREFIXES = ['/finance', '/health', '/studio', '/insurance'];

type IdentityStage = 'login' | 'checking' | 'mfa';
type MfaMode = 'enroll' | 'challenge';

export function resolveAtlasIdentityTarget(rawTarget: string | null) {
  if (!rawTarget) return DEFAULT_TARGET;

  let target = rawTarget.trim();
  try {
    target = decodeURIComponent(target);
  } catch {
    return DEFAULT_TARGET;
  }

  if (!target.startsWith('/') || target.startsWith('//') || target.includes('\\')) return DEFAULT_TARGET;

  const pathname = target.split(/[?#]/, 1)[0];
  if (pathname === '/identity' || pathname.startsWith('/identity/')) return DEFAULT_TARGET;
  if (pathname === '/') return target;
  if (SUPPORTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))) return target;

  return DEFAULT_TARGET;
}

function identityErrorMessage(cause: unknown) {
  const message = cause instanceof Error ? cause.message : String(cause || '');
  if (message === 'no_active_organization') {
    return 'Your account is authenticated but has no active ATLAS organization access.';
  }
  if (message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session') {
    return 'Your ATLAS session is no longer valid. Sign in again.';
  }
  if (message === 'mfa_code_invalid') {
    return 'Enter the 6-digit code from your authenticator app.';
  }
  if (/invalid login credentials/i.test(message)) {
    return 'The email or password is incorrect.';
  }
  if (/mfa|factor|challenge|totp/i.test(message)) {
    return 'ATLAS could not complete MFA verification. Check the authenticator code and try again.';
  }
  return 'ATLAS Identity could not verify access. Check your credentials or try again.';
}

export function IdentityPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const target = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveAtlasIdentityTarget(params.get('app'));
  }, [location.search]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [stage, setStage] = useState<IdentityStage>(() => getAtlasAccessToken() ? 'checking' : 'login');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [mfaMode, setMfaMode] = useState<MfaMode>('challenge');
  const [mfaFactorId, setMfaFactorId] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [enrollment, setEnrollment] = useState<AtlasTotpEnrollment | null>(null);

  async function continueAuthenticatedSession() {
    const organization = await getActiveAtlasOrganization();
    const mfaState = await getAtlasMfaState();
    const privileged = organization.role === 'owner' || organization.role === 'admin';
    const optedIntoMfa = mfaState.verifiedTotpFactors.length > 0;

    if ((privileged || optedIntoMfa) && mfaState.currentLevel !== 'aal2') {
      setError('');
      setMfaCode('');
      if (optedIntoMfa) {
        setMfaMode('challenge');
        setMfaFactorId(mfaState.verifiedTotpFactors[0].id);
      } else {
        setMfaMode('enroll');
        setMfaFactorId('');
        setEnrollment(null);
      }
      setStage('mfa');
      return;
    }

    navigate(target, { replace: true });
  }

  useEffect(() => {
    if (!getAtlasAccessToken()) {
      setStage('login');
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await continueAuthenticatedSession();
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : '';
        if (message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session' || message === 'no_active_organization') {
          clearAtlasSession();
          setStage('login');
        } else {
          setStage('login');
        }
        setError(identityErrorMessage(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
    // target and navigate are the only route values that should restart this check.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    try {
      await signInAtlas(email.trim(), password);
      setPassword('');
      setStage('checking');
      await continueAuthenticatedSession();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message === 'no_active_organization' || message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session') {
        clearAtlasSession();
      }
      setStage('login');
      setError(identityErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function handleEnroll() {
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      const nextEnrollment = await enrollAtlasTotp();
      setEnrollment(nextEnrollment);
      setMfaFactorId(nextEnrollment.factorId);
      setMfaCode('');
    } catch (cause) {
      setError(identityErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  async function handleMfaVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    try {
      await verifyAtlasMfa(mfaFactorId, mfaCode.trim());
      const verifiedState = await getAtlasMfaState();
      if (verifiedState.currentLevel !== 'aal2') throw new Error('mfa_aal2_not_established');
      setMfaCode('');
      setStage('checking');
      await continueAuthenticatedSession();
    } catch (cause) {
      setStage('mfa');
      setError(identityErrorMessage(cause));
    } finally {
      setLoading(false);
    }
  }

  function useAnotherAccount() {
    clearAtlasSession();
    setEnrollment(null);
    setMfaFactorId('');
    setMfaCode('');
    setError('');
    setStage('login');
  }

  return (
    <section className="identity-page page-stack" aria-labelledby="atlas-identity-title">
      <header className="page-header identity-header">
        <p className="eyebrow">Secure access</p>
        <h1 id="atlas-identity-title">ATLAS Identity</h1>
        <p>Authenticate once, validate your active organization, and continue into the authorized ATLAS workspace.</p>
      </header>

      <div className="identity-grid">
        <article className="identity-card">
          {stage === 'checking' ? (
            <div className="identity-checking" role="status" aria-live="polite">
              <span className="pulse-dot" />
              <div>
                <strong>Verifying ATLAS session</strong>
                <p>Confirming identity, organization access, and authenticator assurance.</p>
              </div>
            </div>
          ) : null}

          {stage === 'login' ? (
            <form className="identity-form" onSubmit={handleSubmit}>
              <label className="field">
                <span>Email</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setEmail(event.target.value)}
                  required
                  disabled={loading}
                />
              </label>
              <label className="field">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => setPassword(event.target.value)}
                  required
                  disabled={loading}
                />
              </label>

              {error ? <div className="identity-error" role="alert">{error}</div> : null}

              <button className="identity-submit" type="submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Sign in to ATLAS'}
              </button>
            </form>
          ) : null}

          {stage === 'mfa' ? (
            <div className="identity-mfa">
              <p className="eyebrow">Privileged session</p>
              <h2>{mfaMode === 'enroll' ? 'Enroll authenticator' : 'Verify authenticator'}</h2>
              <p className="identity-mfa-copy">
                {mfaMode === 'enroll'
                  ? 'Owner and administrator access requires AAL2. Add ATLAS to an authenticator app before entering the workspace.'
                  : 'Enter the current 6-digit code from your authenticator app to upgrade this session to AAL2.'}
              </p>

              {mfaMode === 'enroll' && !enrollment ? (
                <button className="identity-submit" type="button" onClick={handleEnroll} disabled={loading}>
                  {loading ? 'Preparing…' : 'Enroll authenticator'}
                </button>
              ) : null}

              {mfaMode === 'enroll' && enrollment ? (
                <div className="identity-enrollment">
                  <img className="identity-qr" src={enrollment.qrCode} alt="ATLAS authenticator QR code" />
                  <div className="identity-secret">
                    <span>Manual setup key</span>
                    <code>{enrollment.secret}</code>
                  </div>
                </div>
              ) : null}

              {(mfaMode === 'challenge' || enrollment) ? (
                <form className="identity-form identity-mfa-form" onSubmit={handleMfaVerify}>
                  <label className="field">
                    <span>6-digit code</span>
                    <input
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      pattern="[0-9]{6}"
                      maxLength={6}
                      value={mfaCode}
                      onChange={(event: ChangeEvent<HTMLInputElement>) => setMfaCode(event.target.value.replace(/\D/g, '').slice(0, 6))}
                      required
                      disabled={loading}
                    />
                  </label>
                  {error ? <div className="identity-error" role="alert">{error}</div> : null}
                  <button className="identity-submit" type="submit" disabled={loading || mfaCode.length !== 6}>
                    {loading ? 'Verifying…' : 'Verify authenticator'}
                  </button>
                </form>
              ) : error ? <div className="identity-error" role="alert">{error}</div> : null}

              <button className="identity-secondary" type="button" onClick={useAnotherAccount} disabled={loading}>
                Use another account
              </button>
            </div>
          ) : null}
        </article>

        <aside className="identity-context" aria-label="ATLAS Identity security boundary">
          <p className="eyebrow">Access boundary</p>
          <h2>Identity → Organization → Permission</h2>
          <p>ATLAS only continues after Supabase Auth succeeds, an active organization membership is confirmed, and privileged sessions satisfy MFA/AAL2.</p>
          <dl>
            <div><dt>Destination</dt><dd>{target}</dd></div>
            <div><dt>Session</dt><dd>Supabase Auth</dd></div>
            <div><dt>Tenant gate</dt><dd>Active organization required</dd></div>
            <div><dt>Privileged gate</dt><dd>MFA / AAL2</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
