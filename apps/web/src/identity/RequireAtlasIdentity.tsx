import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import {
  clearAtlasSession,
  getActiveAtlasOrganization,
  getAtlasAccessToken
} from '../lib/atlasSession';

type GateState = 'checking' | 'authorized' | 'denied';

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
    void (async () => {
      try {
        await getActiveAtlasOrganization();
        if (!cancelled) setState('authorized');
      } catch {
        if (cancelled) return;
        clearAtlasSession();
        setState('denied');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [returnTarget]);

  if (!hasToken || state === 'denied') {
    return <Navigate to={identityUrl} replace />;
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
