#!/usr/bin/env node
import { createServer } from 'node:http';

const port = Number(process.env.PORT || 10000);
const intervalMs = Math.max(60_000, Number(process.env.ATLAS_WATCHDOG_INTERVAL_MS || 300_000));
const timeoutMs = Math.max(1_000, Number(process.env.ATLAS_WATCHDOG_TIMEOUT_MS || 12_000));

const targets = [
  {
    id: 'orchestrator',
    url: process.env.ATLAS_WATCHDOG_ORCHESTRATOR_URL || 'https://atlas-sovereign-orchestrator.onrender.com/readyz',
    required: true,
  },
  {
    id: 'auxiliary-health',
    url: process.env.ATLAS_WATCHDOG_AUXILIARY_URL || 'https://atlas-sovereign-free-01.onrender.com/healthz',
    required: false,
  },
];

let lastRun = null;
const history = [];

function safeUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url : null;
  } catch {
    return null;
  }
}

async function probe(target) {
  const startedAt = new Date().toISOString();
  const started = Date.now();
  const url = safeUrl(target.url);
  if (!url) {
    return {
      id: target.id,
      ok: false,
      required: target.required,
      status: null,
      latency_ms: 0,
      started_at: startedAt,
      error: 'invalid_https_target',
    };
  }

  try {
    const response = await fetch(url, {
      method: 'GET',
      redirect: 'manual',
      headers: {
        accept: 'application/json',
        'user-agent': 'ATLAS-Sovereign-Watchdog/1.0',
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    const text = await response.text();
    let payload = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

    const semanticReady =
      target.id === 'orchestrator'
        ? response.status === 200 && payload?.ready === true
        : response.status === 200 && payload?.status === 'ok';

    return {
      id: target.id,
      ok: semanticReady,
      required: target.required,
      status: response.status,
      latency_ms: Date.now() - started,
      started_at: startedAt,
      detail: payload && typeof payload === 'object'
        ? {
            status: payload.status ?? null,
            ready: payload.ready ?? null,
            reason: payload.reason ?? null,
            durable: payload.durable ?? null,
            service: payload.service ?? null,
          }
        : null,
      error: semanticReady ? null : 'target_not_ready',
    };
  } catch (error) {
    return {
      id: target.id,
      ok: false,
      required: target.required,
      status: null,
      latency_ms: Date.now() - started,
      started_at: startedAt,
      error: error instanceof Error ? error.name : 'probe_failed',
    };
  }
}

async function runWatchdog() {
  const checks = await Promise.all(targets.map(probe));
  const requiredChecks = checks.filter((check) => check.required);
  const ok = requiredChecks.length > 0 && requiredChecks.every((check) => check.ok);
  const run = {
    ok,
    status: ok ? 'passed' : 'failed',
    checked_at: new Date().toISOString(),
    checks,
  };
  lastRun = run;
  history.unshift(run);
  history.splice(20);
  return run;
}

function writeJson(res, status, body) {
  res.statusCode = status;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.setHeader('cache-control', 'no-store');
  res.setHeader('x-content-type-options', 'nosniff');
  res.end(JSON.stringify(body));
}

const server = createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/healthz') {
    return writeJson(res, 200, {
      ok: true,
      service: 'atlas-sovereign-watchdog',
      mode: 'zero-cost-independent-monitor',
      last_run: lastRun,
    });
  }

  if (req.method === 'GET' && req.url === '/status') {
    return writeJson(res, lastRun?.ok ? 200 : 503, {
      service: 'atlas-sovereign-watchdog',
      targets: targets.map(({ id, url, required }) => ({ id, url, required })),
      last_run: lastRun,
      history,
    });
  }

  if (req.method === 'POST' && req.url === '/probe') {
    const result = await runWatchdog();
    return writeJson(res, result.ok ? 200 : 503, result);
  }

  return writeJson(res, 404, { ok: false, error: 'not_found' });
});

server.listen(port, '0.0.0.0', async () => {
  console.log(JSON.stringify({
    event: 'atlas_sovereign_watchdog_started',
    port,
    interval_ms: intervalMs,
    targets: targets.map(({ id, url, required }) => ({ id, url, required })),
  }));
  const first = await runWatchdog();
  console.log(JSON.stringify({ event: 'atlas_sovereign_watchdog_probe', ...first }));
});

setInterval(async () => {
  const result = await runWatchdog();
  console.log(JSON.stringify({ event: 'atlas_sovereign_watchdog_probe', ...result }));
}, intervalMs);
