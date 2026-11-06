/** Read-only GitHub evidence normalization for the ATLAS Persona PR #1016 monitor. */
export type CheckState = 'passed' | 'failed' | 'running' | 'skipped' | 'inconclusive';

export type PersonaCiCheck = {
  id: number;
  name: string;
  state: CheckState;
  url: string;
};
export type PersonaCiSummary = {
  total: number;
  totalReported: number;
  partial: boolean;
  passed: number;
  failed: number;
  running: number;
  skipped: number;
  inconclusive: number;
  result: 'no_evidence' | 'blocked' | 'running' | 'inconclusive' | 'passed';
  checks: PersonaCiCheck[];
};

const FALLBACK_URL = 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/pull/1016';
function object(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
export function safePersonaCiUrl(value: unknown): string {
  if (typeof value !== 'string') return FALLBACK_URL;
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && url.host === 'github.com' &&
        url.pathname.startsWith('/atlasenterprisesuite/atlasenterprisesuite/')) return url.href;
  } catch { /* No untrusted link. */ }
  return FALLBACK_URL;
}
export function summarizePersonaChecks(payload: unknown): PersonaCiSummary {
  const rows = object(payload)?.check_runs;
  const checks: PersonaCiCheck[] = Array.isArray(rows)
    ? rows.filter(row => object(row) !== null).slice(0, 100).map((row, index) => {
      const r = object(row)!;
      const status = r.status;
      const conclusion = r.conclusion;
      let state: CheckState;
      if (status === 'queued' || status === 'in_progress' || status === 'pending' || status === 'requested') {
        state = 'running';
      } else if (status !== 'completed') {
        state = 'inconclusive';
      } else if (conclusion === 'success') {
        state = 'passed';
      } else if (conclusion === 'skipped') {
        state = 'skipped';
      } else if (conclusion === 'failure' || conclusion === 'cancelled' || conclusion === 'timed_out' ||
                 conclusion === 'action_required' || conclusion === 'startup_failure') {
        state = 'failed';
      } else {
        state = 'inconclusive';
      }
      return {
        id: typeof r.id === 'number' && Number.isSafeInteger(r.id) ? r.id : index,
        name: typeof r.name === 'string' && r.name.trim() ? r.name.slice(0, 160) : 'Control sin nombre',
        state,
        url: safePersonaCiUrl(r.details_url ?? r.html_url)
      };
    })
    : [];
  const declaredCount = object(payload)?.total_count;
  const totalReported = typeof declaredCount === 'number' && Number.isSafeInteger(declaredCount) && declaredCount >= 0
    ? declaredCount : checks.length;
  const partial = totalReported > checks.length;
  const tally = (state: CheckState) => checks.filter(check => check.state === state).length;
  const [passed, failed, running, skipped, inconclusive] =
    (['passed', 'failed', 'running', 'skipped', 'inconclusive'] as const).map(tally);
  const result = !checks.length ? 'no_evidence'
    : failed ? 'blocked' : running ? 'running' : (inconclusive || partial) ? 'inconclusive'
    : passed ? 'passed' : 'no_evidence';
  return { total: checks.length, totalReported, partial, passed, failed, running, skipped, inconclusive, result, checks };
}
