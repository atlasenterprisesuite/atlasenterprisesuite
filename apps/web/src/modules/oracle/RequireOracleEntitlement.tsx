import { type ReactNode, useEffect, useState } from 'react';
import { getOracleStatus } from '../../lib/oracleApi';

type GateState = 'checking' | 'entitled' | 'denied' | 'error';

export function RequireOracleEntitlement({ children }: { children: ReactNode }) {
  const [state, setState] = useState<GateState>('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;
    setState('checking');
    getOracleStatus()
      .then((status) => {
        if (active) setState(status.entitled ? 'entitled' : 'denied');
      })
      .catch(() => {
        if (active) setState('error');
      });
    return () => {
      active = false;
    };
  }, [attempt]);

  if (state === 'checking') {
    return <div className="oracle-access-state" role="status">Checking private Oracle access…</div>;
  }

  if (state === 'denied') {
    return (
      <section className="oracle-access-state" aria-labelledby="oracle-private-title">
        <h1 id="oracle-private-title">Private ATLAS capability</h1>
        <p>This private ATLAS capability is not enabled for this account.</p>
      </section>
    );
  }

  if (state === 'error') {
    return (
      <div className="oracle-access-state" role="alert">
        <p>Could not verify private Oracle access.</p>
        <button type="button" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </div>
    );
  }

  return <>{children}</>;
}
