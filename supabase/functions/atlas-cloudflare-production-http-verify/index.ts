import { createGitHubOidcScope } from '../_shared/github-oidc-scope.ts';

const GITHUB_SCOPE = createGitHubOidcScope([
  'cloudflare-deploy.yml',
  'global-production-verify.yml'
]);
const REPO = GITHUB_SCOPE.canonicalRepository;
const AUDIENCE = 'atlas-production-http-verifier';
const ALLOWED_WORKFLOWS = GITHUB_SCOPE.workflowRefs;
const PRODUCTION_URL = 'https://www.atlasenterprisesuite.com';
const PRODUCTION_ORIGIN = new URL(PRODUCTION_URL).origin;
const VERSION = 11;
const MAX_REDIRECTS = 5;
const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

const baseHeaders = {
  'cache-control': 'no-store',
  'content-type': 'application/json; charset=utf-8',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: baseHeaders });

function b64u(input: string) {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

function decodePart(input: string) {
  return JSON.parse(new TextDecoder().decode(b64u(input)));
}

let jwksCache: { until: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function githubKeys() {
  if (jwksCache && jwksCache.until > Date.now()) return jwksCache.keys;
  const configuration = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' }
  ).then((response) => response.json());
  const data = await fetch(configuration.jwks_uri, { cache: 'no-store' }).then((response) => response.json());
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  jwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyGitHubOIDC(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) return { ok: false as const, status: 401, error: 'github_oidc_required' };

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodePart(parts[0]);
    payload = decodePart(parts[1]);
  } catch {
    return { ok: false as const, status: 401, error: 'invalid_github_oidc' };
  }

  if (header.alg !== 'RS256' || !header.kid) {
    return { ok: false as const, status: 401, error: 'unsupported_github_oidc' };
  }

  const jwk = (await githubKeys()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) return { ok: false as const, status: 401, error: 'github_oidc_key_not_found' };

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const signatureOk = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64u(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`)
  );

  const now = Math.floor(Date.now() / 1000);
  const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (
    !signatureOk ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30
  ) {
    return { ok: false as const, status: 401, error: 'github_oidc_verification_failed' };
  }

  const workflowRef = String(payload.workflow_ref || '');
  const jobWorkflowRef = String(payload.job_workflow_ref || '');
  const workflowAllowed =
    ALLOWED_WORKFLOWS.has(workflowRef) ||
    ALLOWED_WORKFLOWS.has(jobWorkflowRef);

  if (
    !GITHUB_SCOPE.allowsRepository(payload.repository, payload.repository_owner) ||
    payload.ref !== 'refs/heads/main' ||
    !workflowAllowed
  ) {
    return { ok: false as const, status: 403, error: 'github_oidc_scope_denied' };
  }

  return {
    ok: true as const,
    claims: {
      sha: String(payload.sha || ''),
      run_id: String(payload.run_id || ''),
      run_attempt: String(payload.run_attempt || ''),
      actor: String(payload.actor || ''),
      workflow_ref: workflowRef,
      job_workflow_ref: jobWorkflowRef
    }
  };
}

type Probe = {
  status: number;
  ok: boolean;
  content_type: string | null;
  cf_mitigated: string | null;
  atlas_version_id: string | null;
  atlas_version_tag: string | null;
  location: string | null;
  duration_ms: number;
  redirect_count: number;
  final_path: string | null;
};

async function probe(path: string, followRedirects = true): Promise<Probe> {
  const started = Date.now();
  let target = new URL(path, PRODUCTION_URL);
  let redirectCount = 0;

  try {
    while (true) {
      const response = await fetch(target, {
        redirect: 'manual',
        cache: 'no-store',
        headers: {
          'user-agent': 'ATLAS-Authorized-Production-Verifier/5.0',
          'cache-control': 'no-cache, no-store'
        }
      });
      const location = response.headers.get('location');
      const atlasVersionId = response.headers.get('x-atlas-version-id');
      const atlasVersionTag = response.headers.get('x-atlas-version-tag');

      if (followRedirects && REDIRECT_STATUSES.has(response.status) && location) {
        if (redirectCount >= MAX_REDIRECTS) {
          return {
            status: response.status,
            ok: false,
            content_type: response.headers.get('content-type'),
            cf_mitigated: response.headers.get('cf-mitigated'),
            atlas_version_id: atlasVersionId,
            atlas_version_tag: atlasVersionTag,
            location: '[redirect-limit-exceeded]',
            duration_ms: Date.now() - started,
            redirect_count: redirectCount,
            final_path: `${target.pathname}${target.search}`
          };
        }

        const next = new URL(location, target);
        if (next.protocol !== 'https:' || next.origin !== PRODUCTION_ORIGIN) {
          return {
            status: response.status,
            ok: false,
            content_type: response.headers.get('content-type'),
            cf_mitigated: response.headers.get('cf-mitigated'),
            atlas_version_id: atlasVersionId,
            atlas_version_tag: atlasVersionTag,
            location: '[blocked-cross-origin-redirect]',
            duration_ms: Date.now() - started,
            redirect_count: redirectCount,
            final_path: `${target.pathname}${target.search}`
          };
        }

        target = next;
        redirectCount += 1;
        continue;
      }

      return {
        status: response.status,
        ok: response.ok,
        content_type: response.headers.get('content-type'),
        cf_mitigated: response.headers.get('cf-mitigated'),
        atlas_version_id: atlasVersionId,
        atlas_version_tag: atlasVersionTag,
        location: location ? '[redirect-present]' : null,
        duration_ms: Date.now() - started,
        redirect_count: redirectCount,
        final_path: `${target.pathname}${target.search}`
      };
    }
  } catch {
    return {
      status: 0,
      ok: false,
      content_type: null,
      cf_mitigated: null,
      atlas_version_id: null,
      atlas_version_tag: null,
      location: null,
      duration_ms: Date.now() - started,
      redirect_count: redirectCount,
      final_path: null
    };
  }
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = url.searchParams.get('api');

  if (req.method === 'GET' && api === 'readiness') {
    return json({
      ok: true,
      service: 'atlas-cloudflare-production-http-verify',
      version: VERSION,
      production_url: PRODUCTION_URL,
      auth: 'github-oidc-main-approved-production-workflows',
      verification_source: 'atlas-authorized-supabase-runtime'
    });
  }

  if (req.method !== 'POST' || api !== 'verify') {
    return json({ ok: false, error: 'not_found' }, 404);
  }

  const caller = await verifyGitHubOIDC(req);
  if (!caller.ok) return json({ ok: false, error: caller.error }, caller.status);

  const [
    home,
    identity,
    finance,
    voice,
    health,
    jaqueMateSentinel,
    studioWebLaunch,
    studioWriting,
    commerce,
    network,
    networkPricing,
    networkCommissions,
    networkPayouts,
    networkCompliance,
    deployment
  ] = await Promise.all([
    probe('/'),
    probe('/identity?app=%2Ffinance'),
    probe('/finance'),
    probe('/voice'),
    probe('/health'),
    probe('/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel'),
    probe('/studio/web-launch'),
    probe('/studio/write'),
    probe('/commerce'),
    probe('/business/network'),
    probe('/business/network/pricing'),
    probe('/business/network/commissions'),
    probe('/business/network/payouts'),
    probe('/business/network/compliance'),
    probe('/deployment.json', false)
  ]);

  const publicShellOk =
    home.status === 200 &&
    identity.status === 200 &&
    finance.status === 200 &&
    voice.status === 200 &&
    health.status === 200 &&
    jaqueMateSentinel.status === 200 &&
    studioWebLaunch.status === 200 &&
    studioWriting.status === 200;
  const commerceRouteOk = commerce.status === 200;
  const routedProbes = [
    home,
    identity,
    finance,
    voice,
    health,
    jaqueMateSentinel,
    studioWebLaunch,
    studioWriting,
    commerce,
    network,
    networkPricing,
    networkCommissions,
    networkPayouts,
    networkCompliance
  ];
  const criticalNetworkRoutesOk = [
    network,
    networkPricing,
    networkCommissions,
    networkPayouts,
    networkCompliance
  ].every((result) => result.status === 200);
  const deploymentPathProtected = [302, 401, 403].includes(deployment.status);
  const observedVersionId = home.atlas_version_id;
  const observedVersionTag = home.atlas_version_tag;
  const productionCommitVerified = Boolean(caller.claims.sha) &&
    Boolean(observedVersionId) &&
    observedVersionTag === caller.claims.sha &&
    routedProbes.every((result) =>
      result.atlas_version_id === observedVersionId && result.atlas_version_tag === caller.claims.sha
    );
  const verified = publicShellOk && commerceRouteOk && criticalNetworkRoutesOk && deploymentPathProtected && productionCommitVerified;

  return json(
    {
      ok: verified,
      status: verified ? 'passed' : 'failed',
      verification_source: 'atlas-authorized-supabase-runtime',
      production_url: PRODUCTION_URL,
      target_sha: caller.claims.sha,
      observed_version_id: observedVersionId,
      observed_version_tag: observedVersionTag,
      edge_security_preserved: true,
      checks: {
        public_home_reachable: home.status === 200,
        identity_route_reachable: identity.status === 200,
        module_spa_shell_reachable: finance.status === 200,
        voice_route_reachable: voice.status === 200,
        health_route_reachable: health.status === 200,
        jaque_mate_sentinel_route_reachable: jaqueMateSentinel.status === 200,
        studio_web_launch_route_reachable: studioWebLaunch.status === 200,
        studio_writing_route_reachable: studioWriting.status === 200,
        commerce_route_reachable: commerce.status === 200,
        critical_network_routes_reachable: criticalNetworkRoutesOk,
        production_commit_sha_verified: productionCommitVerified,
        network_route_reachable: network.status === 200,
        network_pricing_route_reachable: networkPricing.status === 200,
        network_commissions_route_reachable: networkCommissions.status === 200,
        network_payouts_route_reachable: networkPayouts.status === 200,
        network_compliance_route_reachable: networkCompliance.status === 200,
        deployment_path_protected: deploymentPathProtected,
        home,
        identity,
        finance,
        voice,
        health,
        jaque_mate_sentinel: jaqueMateSentinel,
        studio_web_launch: studioWebLaunch,
        studio_writing: studioWriting,
        commerce,
        network,
        network_pricing: networkPricing,
        network_commissions: networkCommissions,
        network_payouts: networkPayouts,
        network_compliance: networkCompliance,
        deployment
      },
      secrets_returned: false
    },
    verified ? 200 : 502
  );
});
