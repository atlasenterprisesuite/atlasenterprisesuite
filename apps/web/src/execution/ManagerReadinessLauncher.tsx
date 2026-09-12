import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { syncManagerReadiness } from './api';

export function ManagerReadinessLauncher() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  const run = useCallback(async () => {
    setError(null);
    try {
      const { workflowId } = await syncManagerReadiness();
      navigate(`/execution/${encodeURIComponent(workflowId)}`, { replace: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'manager_readiness_unavailable');
    }
  }, [navigate]);

  useEffect(() => {
    void run();
  }, [attempt, run]);

  if (error) {
    return (
      <section className="page-stack" role="alert">
        <h1>Infrastructure readiness unavailable</h1>
        <p>{error}</p>
        <button type="button" className="execution-action" onClick={() => setAttempt((value) => value + 1)}>Retry</button>
      </section>
    );
  }

  return (
    <section className="page-stack" aria-busy="true">
      <h1>Verifying infrastructure readiness</h1>
      <p>ATLAS Manager is reconciling the read-only readiness workflow from the existing infrastructure status boundary.</p>
    </section>
  );
}
