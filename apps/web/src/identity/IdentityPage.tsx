import { FormEvent, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAtlasContext, useAtlasSessionActions } from '../app/AtlasContext';
import { resolveAtlasIdentityTarget } from './identityTarget';
import './identity.css';

export function IdentityPage() {
  const identity = useAtlasContext();
  const actions = useAtlasSessionActions();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [signInError, setSignInError] = useState('');

  const target = useMemo(() => {
    const params = new URLSearchParams(location.search);
    return resolveAtlasIdentityTarget(params.get('app'));
  }, [location.search]);

  if (identity.status === 'ready') {
    return <Navigate to={target} replace />;
  }

  if (identity.status === 'loading') {
    return (
      <main className="atlas-identity" aria-busy="true">
        <section className="atlas-identity__card">
          <p className="atlas-identity__eyebrow">ATLAS Identity</p>
          <h1>Checking secure access</h1>
          <p>Resolving the authenticated ATLAS session.</p>
        </section>
      </main>
    );
  }

  if (identity.status === 'configuration_required') {
    return (
      <main className="atlas-identity">
        <section className="atlas-identity__card">
          <p className="atlas-identity__eyebrow">ATLAS Identity</p>
          <h1>ATLAS configuration required</h1>
          <p>The Supabase authentication client is not configured for this runtime. No account credentials can be accepted until configuration is present.</p>
        </section>
      </main>
    );
  }

  if (identity.status === 'organization_required') {
    return (
      <main className="atlas-identity">
        <section className="atlas-identity__card">
          <p className="atlas-identity__eyebrow">ATLAS Identity</p>
          <h1>Organization required</h1>
          <p>Your account is authenticated, but it does not yet have an active ATLAS organization context. An authorized owner bootstrap is required before business modules can open.</p>
          <button className="atlas-identity__secondary" type="button" onClick={() => void actions.signOut()}>
            Sign out
          </button>
        </section>
      </main>
    );
  }

  if (identity.status === 'error') {
    return (
      <main className="atlas-identity">
        <section className="atlas-identity__card">
          <p className="atlas-identity__eyebrow">ATLAS Identity</p>
          <h1>Unable to open ATLAS</h1>
          <p>{identity.message}</p>
          <button className="atlas-identity__secondary" type="button" onClick={() => void actions.refresh()}>
            Try again
          </button>
        </section>
      </main>
    );
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim() || !password) return;
    setSubmitting(true);
    setSignInError('');
    try {
      await actions.signIn(email.trim(), password);
    } catch {
      setPassword('');
      setSignInError('Unable to sign in. Check the account details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="atlas-identity">
      <section className="atlas-identity__card">
        <div className="atlas-identity__brand" aria-label="ATLAS Enterprise Suite">
          <span>ATLAS</span>
          <small>Enterprise Suite</small>
        </div>
        <p className="atlas-identity__eyebrow">Secure enterprise access</p>
        <h1>Sign in to ATLAS</h1>
        <p>Use your authorized ATLAS account. Your password is sent directly through Supabase Auth and is not stored as an ATLAS business record.</p>

        <form className="atlas-identity__form" onSubmit={submit}>
          <label>
            <span>Email</span>
            <input
              type="email"
              name="email"
              autoComplete="username"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              disabled={submitting}
            />
          </label>
          <label>
            <span>Password</span>
            <input
              type="password"
              name="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              disabled={submitting}
            />
          </label>
          {signInError ? <p className="atlas-identity__error" role="alert">{signInError}</p> : null}
          <button className="atlas-identity__submit" type="submit" disabled={submitting || !email.trim() || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}
