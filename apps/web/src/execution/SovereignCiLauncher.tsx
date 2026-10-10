import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { startManagerSovereignCi } from './api';

const CANONICAL_REPOSITORY = 'atlasenterprisesuite/atlasenterprisesuite';

export function SovereignCiLauncher() {
  const navigate = useNavigate();
  const [repository, setRepository] = useState(CANONICAL_REPOSITORY);
  const [requestedRef, setRequestedRef] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ref = requestedRef.trim();
    if (!ref) {
      setError('Branch, tag, or SHA is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const { workflowId } = await startManagerSovereignCi({
        repository: repository.trim(),
        requestedRef: ref
      });
      navigate(`/execution/${encodeURIComponent(workflowId)}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'manager_sovereign_ci_unavailable');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="page-stack execution-page">
      <div>
        <p className="eyebrow">ATLAS Manager</p>
        <h1>Sovereign CI</h1>
        <p>Run the canonical read-only verification gate for an explicit repository ref. ATLAS pins the run to an immutable SHA and records evidence without deploying or mutating source control.</p>
      </div>

      <form className="execution-panel page-stack" onSubmit={submit} aria-busy={submitting}>
        <label className="field">
          <span>Repository</span>
          <input
            name="repository"
            value={repository}
            onChange={(event) => setRepository(event.target.value)}
            autoComplete="off"
            spellCheck={false}
          />
        </label>

        <label className="field">
          <span>Branch, tag, or SHA</span>
          <input
            name="requested-ref"
            value={requestedRef}
            onChange={(event) => setRequestedRef(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="feat/example, v1.2.3, or full commit SHA"
          />
        </label>

        {error ? <div role="alert" className="execution-action-error">{error}</div> : null}

        <div className="execution-action-bar">
          <button className="execution-action" type="submit" disabled={submitting}>
            {submitting ? 'Starting verification…' : 'Run verification'}
          </button>
        </div>
      </form>
    </section>
  );
}
