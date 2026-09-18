import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..');
const contractPath = resolve(repoRoot, 'data/ops/global-production-verification.json');
const contract = JSON.parse(readFileSync(contractPath, 'utf8'));

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const TRANSIENT_STATUSES = new Set([500, 502, 503, 504]);
const MAX_REDIRECTS = 5;
const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 10_000;

function parseArgs(argv) {
  const args = {
    mode: contract.default_mode,
    baseUrl: contract.production_origin,
    jsonOutput: null,
    deferEdgeChallenge: false
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--mode') args.mode = argv[++index];
    else if (current === '--base-url') args.baseUrl = argv[++index];
    else if (current === '--json-output') args.jsonOutput = argv[++index];
    else if (current === '--defer-edge-challenge') args.deferEdgeChallenge = true;
    else if (current === '--help') {
      console.log(
        'Usage: node scripts/verify-global-production.mjs [--mode fail-closed|warning-only] [--base-url https://host] [--json-output path] [--defer-edge-challenge]'
      );
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${current}`);
    }
  }

  if (!['fail-closed', 'warning-only'].includes(args.mode)) {
    throw new Error(`Unsupported verification mode: ${args.mode}`);
  }

  const base = new URL(args.baseUrl);
  if (base.protocol !== 'https:') throw new Error('Production verification requires HTTPS.');
  base.pathname = '/';
  base.search = '';
  base.hash = '';
  args.baseUrl = base.origin;

  return args;
}

const sleep = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function routeResult({ path, status, ok, reason, target, redirects, cfMitigated, attempts }) {
  return {
    path,
    status,
    ok,
    reason,
    effective_url: target ? target.toString() : null,
    redirect_count: redirects,
    cf_mitigated: cfMitigated,
    attempts
  };
}

async function fetchWithRetry(target) {
  let lastError = null;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    try {
      const response = await fetch(target, {
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          'user-agent': 'ATLAS-Global-Production-Verifier/1.0',
          'cache-control': 'no-cache, no-store'
        },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS)
      });

      if (TRANSIENT_STATUSES.has(response.status) && attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 400);
        continue;
      }

      return { response, attempts: attempt, error: null };
    } catch (error) {
      lastError = error;
      if (attempt < MAX_ATTEMPTS) {
        await sleep(attempt * 400);
        continue;
      }
    }
  }
  return { response: null, attempts: MAX_ATTEMPTS, error: lastError };
}

async function probePublicRoute(baseOrigin, path) {
  const origin = new URL(baseOrigin).origin;
  let target = new URL(path, origin);
  let redirects = 0;
  let attempts = 0;

  while (true) {
    const fetched = await fetchWithRetry(target);
    attempts += fetched.attempts;
    if (!fetched.response) {
      return routeResult({
        path,
        status: 0,
        ok: false,
        reason: 'network-or-timeout-error',
        target,
        redirects,
        cfMitigated: null,
        attempts
      });
    }

    const response = fetched.response;
    const cfMitigated = response.headers.get('cf-mitigated');
    if (response.status === 403 && String(cfMitigated || '').toLowerCase() === 'challenge') {
      return routeResult({
        path,
        status: response.status,
        ok: false,
        reason: 'cloudflare-edge-challenge',
        target,
        redirects,
        cfMitigated,
        attempts
      });
    }

    const location = response.headers.get('location');
    if (REDIRECT_STATUSES.has(response.status) && location) {
      if (redirects >= MAX_REDIRECTS) {
        return routeResult({
          path,
          status: response.status,
          ok: false,
          reason: 'redirect-limit-exceeded',
          target,
          redirects,
          cfMitigated,
          attempts
        });
      }

      const next = new URL(location, target);
      if (next.protocol !== 'https:' || next.origin !== origin) {
        return routeResult({
          path,
          status: response.status,
          ok: false,
          reason: 'blocked-cross-origin-redirect',
          target: next,
          redirects,
          cfMitigated,
          attempts
        });
      }

      target = next;
      redirects += 1;
      continue;
    }

    return routeResult({
      path,
      status: response.status,
      ok: response.status === 200 && target.origin === origin,
      reason: response.status === 200 ? null : 'unexpected-status',
      target,
      redirects,
      cfMitigated,
      attempts
    });
  }
}

async function probeProtectedRoute(baseOrigin, definition) {
  const origin = new URL(baseOrigin).origin;
  const target = new URL(definition.path, origin);
  const fetched = await fetchWithRetry(target);

  if (!fetched.response) {
    return routeResult({
      path: definition.path,
      status: 0,
      ok: false,
      reason: 'network-or-timeout-error',
      target,
      redirects: 0,
      cfMitigated: null,
      attempts: fetched.attempts
    });
  }

  const response = fetched.response;
  const allowed = definition.allowed_statuses.includes(response.status);
  return routeResult({
    path: definition.path,
    status: response.status,
    ok: allowed,
    reason: allowed ? null : 'protected-route-regression',
    target,
    redirects: 0,
    cfMitigated: response.headers.get('cf-mitigated'),
    attempts: fetched.attempts
  });
}

function writeResult(path, result) {
  if (!path) return;
  const outputPath = resolve(process.cwd(), path);
  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const requiredPaths = [...contract.public_routes, ...contract.critical_network_routes];
  const requiredResults = [];

  for (const path of requiredPaths) {
    requiredResults.push(await probePublicRoute(args.baseUrl, path));
  }

  const protectedResults = [];
  for (const definition of contract.protected_routes) {
    protectedResults.push(await probeProtectedRoute(args.baseUrl, definition));
  }

  const failures = [...requiredResults, ...protectedResults].filter((result) => !result.ok);
  const challengeFailures = failures.filter((result) => result.reason === 'cloudflare-edge-challenge');
  const nonChallengeFailures = failures.filter((result) => result.reason !== 'cloudflare-edge-challenge');
  const verified = failures.length === 0;
  const challengeDeferred =
    !verified &&
    args.deferEdgeChallenge &&
    challengeFailures.length > 0 &&
    nonChallengeFailures.length === 0;

  const result = {
    version: contract.version,
    production_origin: args.baseUrl,
    mode: args.mode,
    ok: verified,
    status: verified
      ? 'passed'
      : challengeDeferred
        ? 'challenge-deferred'
        : args.mode === 'warning-only'
          ? 'warning'
          : 'failed',
    requires_authorized_fallback: challengeDeferred,
    edge_challenge_detected: challengeFailures.length > 0,
    checks: {
      public_routes_reachable: requiredResults
        .slice(0, contract.public_routes.length)
        .every((entry) => entry.ok),
      critical_network_routes_reachable: requiredResults
        .slice(contract.public_routes.length)
        .every((entry) => entry.ok),
      protected_routes_enforced: protectedResults.every((entry) => entry.ok),
      required_routes: requiredResults,
      protected_routes: protectedResults
    },
    failure_count: failures.length
  };

  writeResult(args.jsonOutput, result);
  console.log(JSON.stringify(result, null, 2));

  if (verified || challengeDeferred || args.mode === 'warning-only') return;
  process.exitCode = 1;
}

main().catch((error) => {
  const failure = {
    ok: false,
    status: 'failed',
    error: error instanceof Error ? error.message : String(error)
  };
  console.error(JSON.stringify(failure, null, 2));
  process.exitCode = 1;
});
