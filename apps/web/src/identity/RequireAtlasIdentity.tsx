import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  clearAtlasSession,
  getActiveAtlasOrganization,
  getAtlasAccessToken
} from '../lib/atlasSession';
import { canAccessAtlasModule, resolveAtlasModuleForPath } from '../access/moduleAccess';

type GateState = 'checking' | 'authorized' | 'denied' | 'forbidden' | 'error';

export function RequireAtlasIdentity({ children }: { children: ReactNode }) {
  const location = useLocation();
  const returnTarget = useMemo(
    () => `${location.pathname}${location.search}${location.hash}`,
    [location.hash, location.pathname, location.search]
  );
  const identityUrl = `/identity?app=${encodeURIComponent(returnTarget)}`;
  const hasToken = Boolean(getAtlasAccessToken());
  const [state, setState] = useState<GateState>(() => hasToken ? 'checking' : 'denied');

  useEffect(() => {
    if (!getAtlasAccessToken()) {
      setState('denied');
      return;
    }

    let cancelled = false;
    setState('checking');
    void (async () => {
      try {
        await getActiveAtlasOrganization();
        const module = resolveAtlasModuleForPath(location.pathname);
        // This component is itself the protected-route boundary. If the route belongs
        // to a registered module, enforce that module even when its top-level landing
        // page is intentionally public.
        if (module) {
          const access = await canAccessAtlasModule(module.id);
          if (!cancelled) setState(access?.allowed ? 'authorized' : 'forbidden');
          return;
        }
        if (!cancelled) setState('authorized');
      } catch (cause) {
        if (cancelled) return;
        const message = cause instanceof Error ? cause.message : '';
        if (message === 'authentication_required' || message === 'session_expired' || message === 'invalid_session' || message === 'no_active_organization') {
          clearAtlasSession();
          setState('denied');
          return;
        }
        setState('error');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [location.pathname, returnTarget]);

  if (!hasToken || state === 'denied') {
    return <Navigate to={identityUrl} replace />;
  }

  if (state === 'forbidden') {
    return (
      <section className="page-stack" aria-labelledby="atlas-access-denied-title">
        <div className="identity-checking" role="alert">
          <div>
            <strong id="atlas-access-denied-title">Module access unavailable</strong>
            <p>This organization or role is not entitled to open this ATLAS module.</p>
            <Link className="text-link" to="/">Return to ATLAS Home</Link>
          </div>
        </div>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <section className="page-stack" aria-labelledby="atlas-access-error-title">
        <div className="identity-checking" role="alert">
          <div>
            <strong id="atlas-access-error-title">Access verification unavailable</strong>
            <p>ATLAS could not verify module entitlement and permission. Access remains closed.</p>
          </div>
        </div>
      </section>
    );
  }

  if (state === 'checking') {
    return (
      <section className="page-stack" aria-live="polite">
        <div className="identity-checking" role="status">
          <span className="pulse-dot" />
          <div>
            <strong>Verifying ATLAS Identity</strong>
            <p>Confirming active organization access before opening this workspace.</p>
          </div>
        </div>
      </section>
    );
  }

  return <>{children}</>;
}
