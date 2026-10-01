import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  cancelAssistantBackground,
  listAssistantBackgroundActivity,
  type AssistantBackgroundActivity
} from '../../assistant/client';

function statusLabel(status: string) {
  if (status === 'started' || status === 'queued') return 'Queued';
  if (status === 'in_progress') return 'Running';
  if (status === 'completed') return 'Completed';
  if (status === 'cancelled') return 'Cancelled';
  if (status === 'failed') return 'Failed';
  return status || 'Unknown';
}

function duration(item: AssistantBackgroundActivity) {
  if (item.latency_ms !== null) return item.latency_ms < 1000 ? item.latency_ms + ' ms' : (item.latency_ms / 1000).toFixed(1) + ' s';
  if (!item.created_at) return '—';
  const start = new Date(item.created_at).getTime();
  const end = item.completed_at ? new Date(item.completed_at).getTime() : Date.now();
  const value = Math.max(0, end - start);
  return value < 1000 ? value + ' ms' : (value / 1000).toFixed(1) + ' s';
}

export function BackgroundActivityPage() {
  const [items, setItems] = useState<AssistantBackgroundActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyTrace, setBusyTrace] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setError('');
    try {
      setItems(await listAssistantBackgroundActivity(75));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'background_activity_unavailable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void refresh();
    const timer = window.setInterval(() => {
      if (active && document.visibilityState === 'visible') void refresh();
    }, 5000);
    return () => { active = false; window.clearInterval(timer); };
  }, [refresh]);

  const summary = useMemo(() => ({
    active: items.filter(item => ['started', 'queued', 'in_progress'].includes(item.status)).length,
    completed: items.filter(item => item.status === 'completed').length,
    failed: items.filter(item => item.status === 'failed').length,
    cancelled: items.filter(item => item.status === 'cancelled').length
  }), [items]);

  async function cancel(traceId: string) {
    if (busyTrace) return;
    setBusyTrace(traceId);
    setError('');
    try {
      await cancelAssistantBackground(traceId);
      await refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'background_cancel_failed');
    } finally {
      setBusyTrace('');
    }
  }

  return (
    <section className="page-stack">
      <header className="page-header">
        <p className="eyebrow">ATLAS Assistant · Background Brain</p>
        <h1>Background Activity</h1>
        <p>Organization-scoped AI work with explicit lifecycle state. A queued or running item is never presented as completed until the persisted request reaches a terminal state.</p>
        <div className="atlas-action-row">
          <Link className="module-experience-action" to="/assistant">Back to Assistant</Link>
          <button className="module-experience-action secondary" type="button" onClick={() => void refresh()} disabled={loading}>Refresh</button>
        </div>
      </header>

      <div className="metric-grid" aria-label="Background activity summary">
        <article><span>Active</span><strong>{summary.active}</strong></article>
        <article><span>Completed</span><strong>{summary.completed}</strong></article>
        <article><span>Failed</span><strong>{summary.failed}</strong></article>
        <article><span>Cancelled</span><strong>{summary.cancelled}</strong></article>
      </div>

      {error ? <div className="notice strong" role="alert">{error}</div> : null}
      {loading ? <div className="notice" role="status">Loading authenticated background activity…</div> : null}

      {!loading && !items.length ? (
        <div className="notice">No background AI requests are recorded for this account in the active organization.</div>
      ) : (
        <div className="module-experience-grid">
          {items.map(item => {
            const active = ['started', 'queued', 'in_progress'].includes(item.status);
            return (
              <article className={'module-experience-card ' + (active ? 'is-active' : '')} key={item.trace_id}>
                <span className="module-experience-card-label">{item.provider || 'ATLAS'} · {item.kind}</span>
                <strong>{statusLabel(item.status)}</strong>
                <p>{item.model || 'Model recorded when provider resolves'} · {duration(item)}</p>
                <small>{item.created_at ? new Date(item.created_at).toLocaleString() : 'Timestamp unavailable'}</small>
                {item.error ? <small className="module-experience-card-status">{item.error}</small> : null}
                <div className="atlas-action-row">
                  {item.conversation_id ? <Link to="/assistant" state={{ conversationId: item.conversation_id }}>Open conversation</Link> : null}
                  {active ? (
                    <button type="button" disabled={busyTrace === item.trace_id} onClick={() => void cancel(item.trace_id)}>
                      {busyTrace === item.trace_id ? 'Cancelling…' : 'Cancel'}
                    </button>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
