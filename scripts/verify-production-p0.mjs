import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const contract = JSON.parse(
  readFileSync(path.join(rootDir, 'data/ops/global-production-verification.json'), 'utf8')
);

const productionOrigin = new URL(contract.production_origin).origin;
const healthPath = String(contract.health_check?.path || '/api/v1/health');
const expected_status = String(contract.health_check?.expected_status || 'healthy');
const requiredSecurityHeaders = Array.isArray(contract.required_security_headers)
  ? contract.required_security_headers.map(value => String(value).toLowerCase())
  : ['strict-transport-security', 'content-security-policy'];

const retriableStatuses = new Set([408, 429, 500, 502, 503, 504]);

async function fetchWithRetry(pathname, accept) {
  const url = new URL(pathname, productionOrigin);
  let lastError = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(10_000),
        headers: {
          accept,
          'cache-control': 'no-cache, no-store',
          'user-agent': 'ATLAS-P0-Production-Verifier/1.0'
        }
      });

      if (!retriableStatuses.has(response.status) || attempt === 3) {
        return response;
      }
    } catch (error) {
      lastError = error;
      if (attempt === 3) throw error;
    }

    await new Promise(resolve => setTimeout(resolve, attempt * 1_000));
  }

  throw lastError || new Error(`Unable to verify ${pathname}`);
}

let healthResponse;
let healthPayload = null;
let rootResponse;
let failure = null;

try {
  healthResponse = await fetchWithRetry(healthPath, 'application/json');
  healthPayload = await healthResponse.clone().json().catch(() => null);
  rootResponse = await fetchWithRetry('/', 'text/html,application/xhtml+xml');
} catch (error) {
  failure = error instanceof Error ? error.message : String(error);
}

const health_contract_verified = Boolean(
  healthResponse?.status === 200 &&
  healthPayload &&
  typeof healthPayload === 'object' &&
  healthPayload.status === expected_status &&
  healthPayload.scope === 'worker_liveness' &&
  healthPayload.dependencies?.supabase_database === 'not_checked' &&
  healthPayload.dependencies?.supabase_auth === 'not_checked' &&
  String(healthResponse.headers.get('content-type') || '').toLowerCase().includes('application/json')
);

const observedSecurityHeaders = Object.fromEntries(
  requiredSecurityHeaders.map(name => [name, rootResponse?.headers.get(name) || null])
);
const security_headers_verified = Boolean(
  rootResponse?.status === 200 &&
  requiredSecurityHeaders.every(name => Boolean(observedSecurityHeaders[name]))
);

const result = {
  version: 1,
  production_origin: productionOrigin,
  mode: 'fail-closed',
  verification_scope: 'worker_liveness_and_edge_security_only',
  ok: !failure && health_contract_verified && security_headers_verified,
  checks: {
    health_contract_verified,
    backend_readiness_verified: false,
    security_headers_verified,
    health: {
      path: healthPath,
      http_status: healthResponse?.status ?? null,
      payload_status: healthPayload?.status ?? null,
      scope: healthPayload?.scope ?? null,
      dependencies: healthPayload?.dependencies ?? null,
      expected_status,
      content_type: healthResponse?.headers.get('content-type') || null
    },
    root: {
      path: '/',
      http_status: rootResponse?.status ?? null,
      required_security_headers: observedSecurityHeaders,
      'strict-transport-security': observedSecurityHeaders['strict-transport-security'] || null,
      'content-security-policy': observedSecurityHeaders['content-security-policy'] || null
    }
  },
  failure
};

console.log(JSON.stringify(result, null, 2));

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(
    process.env.GITHUB_STEP_SUMMARY,
    [
      '## ATLAS P0 production contract',
      `- Worker liveness JSON (not backend readiness): ${health_contract_verified ? 'passed' : 'failed'}`,
      '- Supabase Auth/DB readiness: not checked by this verifier (P0 #557 remains open)',
      `- HSTS + CSP on public root: ${security_headers_verified ? 'passed' : 'failed'}`,
      `- Policy: fail-closed`,
      ''
    ].join('\n')
  );
}

if (!result.ok) {
  console.error('ATLAS P0 production verification failed closed.');
  process.exit(1);
}
