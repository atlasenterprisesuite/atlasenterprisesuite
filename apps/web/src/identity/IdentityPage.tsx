import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  clearAtlasSession,
  getActiveAtlasOrganization,
  getAtlasAccessToken,
  signInAtlas
} from '../lib/atlasSession';
import { ATLAS_MODULES } from '../modules/registry';
import './identity.css';

const DEFAULT_TARGET = '/';
const SUPPORTED_PREFIXES = [
  '/finance',
  '/health',
  '/studio',
  '/insurance',
  ...ATLAS_MODULES.filter((module) => module.requiresAuth).map((module) => module.route),
  '/execution',
  '/business/growth/social-publisher'
];

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
  if (/invalid login credentials/i.test(message)) {
    return 'The email or password is incorrect.';
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
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(() => Boolean(getAtlasAccessToken()));
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getAtlasAccessToken()) {
      setCheckingSession(false);
      return;
    }

    let cancelled = false;
    void (async () => {
      try {
        await getActiveAtlasOrganization();
        if (!cancelled) navigate(target, { replace: true });
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : '';
        if (message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session' || message === 'no_active_organization') {
          clearAtlasSession();
        }
        setError(identityErrorMessage(cause));
        setCheckingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, target]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;

    setLoading(true);
    setError('');
    try {
      await signInAtlas(email.trim(), password);
      await getActiveAtlasOrganization();
      setPassword('');
      navigate(target, { replace: true });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '';
      if (message === 'no_active_organization' || message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session') {
        clearAtlasSession();
      }
      setError(identityErrorMessage(cause));
    } finally {
      setLoading(false);
    }
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
          {checkingSession ? (
            <div className="identity-checking" role="status" aria-live="polite">
              <span className="pulse-dot" />
              <div>
                <strong>Verifying ATLAS session</strong>
                <p>Confirming identity and active organization access.</p>
              </div>
            </div>
          ) : (
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
          )}
        </article>

        <aside className="identity-context" aria-label="ATLAS Identity security boundary">
          <p className="eyebrow">Access boundary</p>
          <h2>Identity → Organization → Permission</h2>
          <p>ATLAS only continues after Supabase Auth succeeds and an active organization membership is confirmed.</p>
          <dl>
            <div><dt>Destination</dt><dd>{target}</dd></div>
            <div><dt>Session</dt><dd>Supabase Auth</dd></div>
            <div><dt>Tenant gate</dt><dd>Active organization required</dd></div>
          </dl>
        </aside>
      </div>
    </section>
  );
}
