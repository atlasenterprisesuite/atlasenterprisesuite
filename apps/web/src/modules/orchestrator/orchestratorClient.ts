export type OrchestratorProbeState = 'healthy' | 'degraded' | 'unavailable' | 'unknown' | 'unconfigured';

export interface OrchestratorProbeResult {
  state: OrchestratorProbeState;
  health?: unknown;
  readiness?: unknown;
  detail?: string;
}

const baseUrl = (import.meta.env.VITE_ATLAS_ORCHESTRATOR_URL || '').replace(/\/$/, '');

async function getJson(path: string, signal?: AbortSignal): Promise<{ ok: boolean; body: unknown }> {
  const response = await fetch(`${baseUrl}${path}`, { method: 'GET', signal, headers: { accept: 'application/json' } });
  let body: unknown = null;
  try { body = await response.json(); } catch { body = null; }
  return { ok: response.ok, body };
}

export async function probeOrchestrator(signal?: AbortSignal): Promise<OrchestratorProbeResult> {
  if (!baseUrl) return { state: 'unconfigured', detail: 'VITE_ATLAS_ORCHESTRATOR_URL is not configured.' };

  try {
    const [health, readiness] = await Promise.all([getJson('/healthz', signal), getJson('/readyz', signal)]);
    if (!health.ok) return { state: 'unavailable', health: health.body, readiness: readiness.body, detail: 'Health probe failed.' };
    if (!readiness.ok) return { state: 'degraded', health: health.body, readiness: readiness.body, detail: 'Runtime is reachable but not ready.' };

    const healthBody = health.body as { status?: unknown } | null;
    const readinessBody = readiness.body as { ready?: unknown; status?: unknown } | null;
    const healthVerified = healthBody?.status === 'ok';
    const readinessVerified = readinessBody?.ready === true || readinessBody?.status === 'ready' || readinessBody?.status === 'ok';

    if (healthVerified && readinessVerified) return { state: 'healthy', health: health.body, readiness: readiness.body };
    return { state: 'unknown', health: health.body, readiness: readiness.body, detail: 'Probe response could not be verified.' };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    return { state: 'unavailable', detail: error instanceof Error ? error.message : 'Unable to reach orchestrator.' };
  }
}
