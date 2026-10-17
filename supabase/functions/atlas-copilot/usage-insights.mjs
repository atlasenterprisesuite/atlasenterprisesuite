// Aggregates existing, already-authorized ATLAS AI request rows.
// No actor identifiers are ever included in the serialized result.
// All time buckets use UTC dates; the API supplies the rolling observation window.
const DAY_MS = 86_400_000;

export function summarizeAIActivity(rows, { periodStart, periodEnd, sourceLimit = 1000 } = {}) {
  if (!Array.isArray(rows)) throw new TypeError('usage_rows_required');

  const start = Date.parse(periodStart);
  const end = Date.parse(periodEnd);
  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || end - start > 90 * DAY_MS) {
    throw new RangeError('invalid_usage_window');
  }

  const limit = Number(sourceLimit);
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 2000) {
    throw new RangeError('invalid_usage_source_limit');
  }

  const firstDay = Math.floor(start / DAY_MS) * DAY_MS;
  const lastDay = Math.floor(end / DAY_MS) * DAY_MS;
  const buckets = new Map();

  for (let utcDay = firstDay; utcDay <= lastDay; utcDay += DAY_MS) {
    const date = new Date(utcDay).toISOString().slice(0, 10);
    buckets.set(date, {
      date,
      requests: 0,
      completed: 0,
      failed: 0,
      actors: new Set(),
      identityMissing: false,
    });
  }

  const allActors = new Set();
  let identityMissing = false;
  let observed = 0;

  for (const row of rows) {
    const createdAt = Date.parse(row?.created_at);
    if (!Number.isFinite(createdAt) || createdAt < start || createdAt > end) continue;

    const date = new Date(createdAt).toISOString().slice(0, 10);
    const bucket = buckets.get(date);
    if (!bucket) continue;

    observed += 1;
    bucket.requests += 1;
    if (row.status === 'completed') bucket.completed += 1;
    if (row.status === 'failed') bucket.failed += 1;

    const actor = typeof row.actor_id === 'string' ? row.actor_id.trim() : '';
    if (!actor) {
      identityMissing = true;
      bucket.identityMissing = true;
    } else {
      allActors.add(actor);
      bucket.actors.add(actor);
    }
  }

  const daily_activity = [...buckets.values()].map(({ date, requests, completed, failed, actors, identityMissing: missing }) => ({
    date,
    requests,
    completed,
    failed,
    active_users: missing ? null : actors.size,
  }));

  return {
    observed_requests: observed,
    active_users: identityMissing ? null : allActors.size,
    identity_coverage: identityMissing ? 'partial' : 'complete',
    source_coverage: rows.length >= limit ? 'potentially_truncated' : 'complete',
    source_limit: limit,
    daily_activity,
  };
}
