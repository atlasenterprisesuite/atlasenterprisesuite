import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { runtimeIsHealthy } from '../../../../packages/execution/src/work-runtime';
import { listWorkRuntimes, type WorkRuntimeSummary } from './api';
import {
  COMPUTER_OPERATIONS_CONTRACT,
  browserProductionProbeSupported,
  buildComputerOperationsRoutes,
  buildEssentialComputerOperationsRoutes,
  idleComputerOperationsProbes,
  probeComputerOperationsRoutes,
  type ComputerOperationsProbe
} from './computerOperations';
import { WorkSubnav } from './WorkSubnav';

type ProbeScope = 'essential' | 'full';

function probeStatusLabel(probe: ComputerOperationsProbe) {
  if (probe.state === 'pass') return 'PASS';
  if (probe.state === 'fail') return 'FAIL';
  if (probe.state === 'checking') return 'CHECKING';
  if (probe.state === 'unavailable') return 'UNAVAILABLE';
  return 'NOT CHECKED';
}

function routeGroupLabel(group: ComputerOperationsProbe['group']) {
  if (group === 'network') return 'ATLAS Network';
  if (group === 'work') return 'ATLAS Work';
  return 'Public';
}

function browserRuntimeReady(runtime: WorkRuntimeSummary) {
  return runtime.status === 'online'
    && runtimeIsHealthy(runtime)
    && runtime.capabilities.some((capability) => capability.toLowerCase() === 'browser');
}

export function WorkComputerOperationsPage() {
  const essentialRoutes = useMemo(() => buildEssentialComputerOperationsRoutes(), []);
  const fullRoutes = useMemo(() => buildComputerOperationsRoutes(), []);
  const [scope, setScope] = useState<ProbeScope>('essential');
  const [probes, setProbes] = useState<ComputerOperationsProbe[]>(() => idleComputerOperationsProbes(essentialRoutes));
  const [runtimes, setRuntimes] = useState<WorkRuntimeSummary[] | null>(null);
  const [runtimeError, setRuntimeError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const currentOrigin = typeof window === 'undefined' ? '' : window.location.origin;
  const canProbeProduction = browserProductionProbeSupported(currentOrigin);

  const runProbe = async (nextScope: ProbeScope) => {
    if (!canProbeProduction || busy) return;
    const routes = nextScope === 'full' ? fullRoutes : essentialRoutes;
    setScope(nextScope);
    setBusy(true);
    setProbes(routes.map((route) => ({
      ...route,
      state: 'checking',
      status: null,
      durationMs: null,
      error: null
    })));

    try {
      setProbes(await probeComputerOperationsRoutes(routes));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let active = true;
    void listWorkRuntimes()
      .then((rows) => {
        if (active) setRuntimes(rows);
      })
      .catch((caught) => {
        if (active) setRuntimeError(caught instanceof Error ? caught.message : 'work_runtimes_unavailable');
      });

    if (canProbeProduction) void runProbe('essential');
    return () => {
      active = false;
    };
  }, [canProbeProduction]);

  const readyBrowserRuntimes = runtimes?.filter(browserRuntimeReady) ?? [];
  const passCount = probes.filter((probe) => probe.state === 'pass').length;
  const failCount = probes.filter((probe) => probe.state === 'fail' || probe.state === 'unavailable').length;
  const allBrowserChecksPassed = probes.length > 0 && passCount === probes.length;

  return (
    <section className="work-page page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Work Soberano</p>
        <h1>Computer Operations Center</h1>
        <p>
          Browser execution readiness and production-route diagnostics. Browser probes are operational evidence only;
          canonical production verification remains owned by the fail-closed deployment verifier and exact deployed SHA.
        </p>
      </header>

      <WorkSubnav />

      <div className="work-ops-summary-grid" aria-label="Computer operations summary">
        <article className="execution-panel">
          <p className="eyebrow">Production contract</p>
          <h2>v{COMPUTER_OPERATIONS_CONTRACT.version}</h2>
          <p><strong>{COMPUTER_OPERATIONS_CONTRACT.default_mode}</strong></p>
        </article>
        <article className="execution-panel">
          <p className="eyebrow">Browser runtime</p>
          <h2>{runtimes === null ? 'Checking…' : readyBrowserRuntimes.length}</h2>
          <p>{readyBrowserRuntimes.length === 1 ? 'eligible browser runtime' : 'eligible browser runtimes'}</p>
        </article>
        <article className="execution-panel">
          <p className="eyebrow">Current browser probe</p>
          <h2>{passCount}/{probes.length}</h2>
          <p>{busy ? 'Checking routes…' : allBrowserChecksPassed ? 'Browser checks passed' : failCount ? 'Attention required' : 'Ready to check'}</p>
        </article>
        <article className="execution-panel">
          <p className="eyebrow">Production origin</p>
          <h2>{canProbeProduction ? 'Canonical' : 'Non-production'}</h2>
          <p>{COMPUTER_OPERATIONS_CONTRACT.production_origin}</p>
        </article>
      </div>

      {runtimeError ? <div role="alert" className="work-error">{runtimeError}</div> : null}

      {!canProbeProduction ? (
        <div className="execution-panel" role="status">
          <h2>Production browser probe unavailable from this origin</h2>
          <p>
            Open this center on <strong>{COMPUTER_OPERATIONS_CONTRACT.production_origin}</strong> to run credentialed,
            same-origin route probes. ATLAS does not weaken CORS or browser security to make a development-origin probe look successful.
          </p>
        </div>
      ) : null}

      <section className="execution-panel page-stack" aria-labelledby="computer-probe-title">
        <div className="work-section-heading">
          <div>
            <p className="eyebrow">Browser diagnostics</p>
            <h2 id="computer-probe-title">Production route probes</h2>
          </div>
          <div className="work-actions">
            <button className="execution-action" type="button" disabled={busy || !canProbeProduction} onClick={() => void runProbe('essential')}>
              {busy && scope === 'essential' ? 'Checking…' : 'Check critical'}
            </button>
            <button className="execution-action" type="button" disabled={busy || !canProbeProduction} onClick={() => void runProbe('full')}>
              {busy && scope === 'full' ? 'Checking…' : 'Check full contract'}
            </button>
          </div>
        </div>

        <p className="notice">
          Critical checks cover the public shell, ATLAS Work and all five ATLAS Network critical routes.
          Full contract checks every public route in the canonical production contract.
        </p>

        <div className="work-ops-table-wrap">
          <table className="work-ops-table">
            <thead>
              <tr>
                <th scope="col">Surface</th>
                <th scope="col">Route</th>
                <th scope="col">State</th>
                <th scope="col">HTTP</th>
                <th scope="col">Latency</th>
                <th scope="col">Open</th>
              </tr>
            </thead>
            <tbody>
              {probes.map((probe) => (
                <tr key={probe.path}>
                  <td>{routeGroupLabel(probe.group)}</td>
                  <td><code>{probe.path}</code></td>
                  <td><span className={'work-status work-status-' + probe.state}>{probeStatusLabel(probe)}</span></td>
                  <td>{probe.status ?? '—'}</td>
                  <td>{probe.durationMs === null ? '—' : probe.durationMs + ' ms'}</td>
                  <td>
                    <a
                      className="work-ops-link"
                      href={new URL(probe.path, COMPUTER_OPERATIONS_CONTRACT.production_origin).toString()}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Open
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="work-card-grid">
        <article className="execution-panel">
          <p className="eyebrow">Execution boundary</p>
          <h2>Browser / Computer Use</h2>
          <p>
            Computer execution must use an enrolled, authenticated Work runtime with a current heartbeat and the
            <code> browser </code> capability. Site authorization, CDP access and provider consent remain explicit host-level approvals.
          </p>
          <div className="work-actions">
            <Link className="execution-action work-primary-link" to="/work/runtimes">Runtimes</Link>
            <Link className="execution-action work-primary-link" to="/work/policies">Policies</Link>
          </div>
        </article>

        <article className="execution-panel">
          <p className="eyebrow">Fail-closed release gate</p>
          <h2>Production verification</h2>
          <p>
            A green browser probe does not declare a deployment verified. Final verification still requires the canonical
            global workflow, exact production commit SHA, protected deployment boundary and every configured critical route.
          </p>
          <p className="notice">
            Protected route: <code>{COMPUTER_OPERATIONS_CONTRACT.protected_routes[0]?.path ?? '/deployment.json'}</code> —
            expected status {COMPUTER_OPERATIONS_CONTRACT.protected_routes[0]?.allowed_statuses.join(', ') ?? '302, 401, 403'}.
          </p>
        </article>
      </div>
    </section>
  );
}
