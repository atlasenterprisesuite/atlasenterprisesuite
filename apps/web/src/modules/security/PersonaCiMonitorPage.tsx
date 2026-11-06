import { useCallback, useEffect, useRef, useState } from 'react';
import {
  safePersonaCiUrl,
  summarizePersonaChecks,
  type PersonaCiSummary,
  type CheckState
} from '../../../../../packages/compliance/persona-monitor';
import './persona-ci-monitor.css';

const REPO = 'atlasenterprisesuite/atlasenterprisesuite';
const PR_NUMBER = 1016;
const PR_URL = 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1016';
const API = 'https://api.github.com/repos/' + REPO;
const REFRESH_MS = 300000; // At most 24 API requests/hour for one visible open tab.
const labels: Record<CheckState, string> = {
  passed: 'Aprobado', failed: 'Fallido', running: 'En curso',
  skipped: 'Omitido', inconclusive: 'Sin conclusión'
};

type Snapshot = {
  sha: string;
  draft: boolean;
  state: string;
  checks: PersonaCiSummary;
  fetchedAt: string;
};

async function fetchEvidence(url: string, signal: AbortSignal): Promise<Record<string, unknown>> {
  const response = await fetch(url, {
    cache: 'no-store',
    signal,
    headers: { Accept: 'application/vnd.github+json' }
  });
  if (!response.ok) throw new Error('github_api_unavailable');
  const json: unknown = await response.json();
  if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error('github_invalid_response');
  return json as Record<string, unknown>;
}

function heading(result: PersonaCiSummary['result']): string {
  switch (result) {
    case 'passed': return 'CI aprobado para este SHA';
    case 'blocked': return 'CI con fallos bloqueantes';
    case 'running': return 'GitHub Actions en ejecución';
    case 'inconclusive': return 'Resultado inconcluso';
    default: return 'Sin evidencia de CI';
  }
}

export function PersonaCiMonitorPage() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const busy = useRef(false);
  const controller = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRefreshing(true);
    const request = new AbortController();
    controller.current = request;
    const timeout = window.setTimeout(() => request.abort(), 15000);
    try {
      const pr = await fetchEvidence(API + '/pulls/' + PR_NUMBER, request.signal);
      const head = pr.head && typeof pr.head === 'object' && !Array.isArray(pr.head)
        ? pr.head as Record<string, unknown> : {};
      if (typeof head.sha !== 'string' || !/^[a-f0-9]{40}$/i.test(head.sha)) {
        throw new Error('github_invalid_sha');
      }
      const checks = await fetchEvidence(
        API + '/commits/' + encodeURIComponent(head.sha) + '/check-runs?per_page=100', request.signal
      );
      if (!Array.isArray(checks.check_runs)) throw new Error('github_missing_checks');
      if (request.signal.aborted) return;
      setSnapshot({
        sha: head.sha,
        draft: pr.draft === true,
        state: typeof pr.state === 'string' ? pr.state : 'unknown',
        checks: summarizePersonaChecks(checks),
        fetchedAt: new Date().toISOString()
      });
      setError(false);
    } catch {
      if (controller.current === request) setError(true);
    } finally {
      window.clearTimeout(timeout);
      if (controller.current === request) {
        controller.current = null;
        busy.current = false;
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    void refresh();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, REFRESH_MS);
    const resume = () => {
      if (document.visibilityState === 'visible') void refresh();
    };
    document.addEventListener('visibilitychange', resume);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', resume);
      const current = controller.current;
      controller.current = null;
      busy.current = false;
      current?.abort();
    };
  }, [refresh]);

  const checks = snapshot?.checks;
  const counts: Array<{ key: CheckState; value: number }> = checks
    ? [
      { key: 'passed', value: checks.passed },
      { key: 'running', value: checks.running },
      { key: 'failed', value: checks.failed },
      { key: 'skipped', value: checks.skipped },
      { key: 'inconclusive', value: checks.inconclusive }
    ]
    : [];
  return (
    <section className="persona-ci-monitor page-stack" aria-labelledby="persona-monitor-title">
      <div className="persona-ci-sticky">
        <div>
          <p className="eyebrow">ATLAS Identity · GitHub Actions · PR #1016</p>
          <h1 id="persona-monitor-title">Persona — Live CI Monitor</h1>
          <p>Panel permanente, solo lectura. Actualización desde GitHub cada 5 minutos con la pestaña visible.</p>
        </div>
        <div className="persona-ci-actions">
          <button type="button" onClick={() => void refresh()} disabled={refreshing} aria-busy={refreshing}>
            {refreshing ? 'Consultando GitHub…' : 'Actualizar ahora'}
          </button>
          <a href={PR_URL} target="_blank" rel="noopener noreferrer">Abrir PR #1016</a>
        </div>
      </div>

      <div className="persona-ci-evidence" role="status" aria-live="polite">
        {error ? (
          <p className="persona-ci-error" role="alert">
            GitHub no respondió. {snapshot ? 'La última lectura se conserva como historial; no representa el estado actual.' : 'No se muestran estados inventados.'}
          </p>
        ) : null}
        {!snapshot ? (
          <div className="persona-ci-empty">
            {refreshing ? 'Consultando evidencia verificable…' : 'Sin datos verificables de GitHub.'}
          </div>
        ) : (
          <>
            <div className="persona-ci-summary">
              <div>
                <span className="persona-ci-overline">Estado del pipeline · no de producción</span>
                <strong>{heading(checks!.result)}</strong>
                <small>SHA exacto: <code>{snapshot.sha}</code></small>
                <small>PR: {snapshot.draft ? 'Draft' : snapshot.state} · Última lectura: {new Date(snapshot.fetchedAt).toLocaleString('es-US')}</small>
              </div>
              <div className="persona-ci-total" aria-label={checks!.total + ' comprobaciones reportadas'}>
                <b>{checks!.total}</b><span>controles</span>
              </div>
            </div>
            <div className="persona-ci-track" role="img" aria-label={
              checks!.passed + ' aprobados, ' + checks!.running + ' ejecutándose, ' +
              checks!.failed + ' fallidos, ' + checks!.skipped + ' omitidos, ' +
              checks!.inconclusive + ' inconclusos'
            }>
              {counts.filter(item => item.value > 0).map(item => (
                <div key={item.key}
                  className={'persona-ci-segment persona-ci-' + item.key}
                  style={{ width: (item.value / checks!.total * 100) + '%' }}
                  title={labels[item.key] + ': ' + item.value} />
              ))}
            </div>
            <div className="persona-ci-metrics">
              {counts.map(item => (
                <div className="persona-ci-metric" key={item.key}>
                  <span className={'persona-ci-dot persona-ci-' + item.key} />
                  <b>{item.value}</b>
                  <span>{labels[item.key]}</span>
                </div>
              ))}
            </div>
            <h2>Verificaciones del SHA actual</h2>
            <div className="persona-ci-checks">
              {checks!.checks.map(item => (
                <a key={item.id + '-' + item.name} className="persona-ci-check"
                  href={safePersonaCiUrl(item.url)} target="_blank" rel="noopener noreferrer">
                  <span className={'persona-ci-dot persona-ci-' + item.state} aria-hidden="true" />
                  <span>{item.name}</span>
                  <strong>{labels[item.state]}</strong>
                </a>
              ))}
            </div>
          </>
        )}
      </div>
      <aside className="persona-ci-no-go">
        <strong>ATLAS 777 REVIEW · P0 NO-GO</strong>
        <p>Un CI aprobado no confirma que Persona esté conectado, ni que las migraciones/RLS se hayan
          probado en PostgreSQL 17, ni autoriza merge o despliegue. Sandbox, revisión de seguridad
          independiente y verificación E2E siguen siendo controles separados.</p>
        <a href="https://github.com/atlasenterprisesuite/atlasenterprisesuite/blob/feat/persona-identity-adapter-777-20261106/docs/architecture/ATLAS_PERSONA_IDENTITY_ADAPTER.md"
          target="_blank" rel="noopener noreferrer">Consultar criterios de aceptación</a>
      </aside>
    </section>
  );
}
