const REPO = 'atlasenterprisesuite/atlasenterprisesuite';
const OWNER = 'atlasenterprisesuite';
const AUDIENCE = 'atlas-production-http-verifier';
const ALLOWED_WORKFLOWS = new Set([
  `${REPO}/.github/workflows/cloudflare-deploy.yml@refs/heads/main`,
  `${REPO}/.github/workflows/global-production-verify.yml@refs/heads/main`
]);
const PRODUCTION_URL = 'https://www.atlasenterprisesuite.com';
const PRODUCTION_ORIGIN = new URL(PRODUCTION_URL).origin;
const VERSION = 16;
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
    payload.repository !== REPO ||
    payload.repository_owner !== OWNER ||
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
    suite,
    identity,
    finance,
    automotiveSales,
    voice,
    health,
    frontier,
    jaqueMateSentinel,
    studioWebLaunch,
    studioWriting,
    commerce,
    revenue,
    analytics,
    network,
    networkPricing,
    networkCommissions,
    networkPayouts,
    networkCompliance,
    work,
    workNew,
    workConnections,
    workRuntimes,
    workPolicies,
    deployment
  ] = await Promise.all([
    probe('/'),
    probe('/suite'),
    probe('/identity?app=%2Ffinance'),
    probe('/finance'),
    probe('/finance/accounting/reports/automotive-sales'),
    probe('/voice'),
    probe('/health'),
    probe('/frontier'),
    probe('/health/research/frontiers/disease-reconstruction/jaque-mate-sentinel'),
    probe('/studio/web-launch'),
    probe('/studio/write'),
    probe('/commerce'),
    probe('/revenue'),
    probe('/analytics'),
    probe('/business/network'),
    probe('/business/network/pricing'),
    probe('/business/network/commissions'),
    probe('/business/network/payouts'),
    probe('/business/network/compliance'),
    probe('/work'),
    probe('/work/new'),
    probe('/work/connections'),
    probe('/work/runtimes'),
    probe('/work/policies'),
    probe('/deployment.json', false)
  ]);

  const publicShellOk =
    home.status === 200 &&
    suite.status === 200 &&
    identity.status === 200 &&
    finance.status === 200 &&
    automotiveSales.status === 200 &&
    voice.status === 200 &&
    health.status === 200 &&
    frontier.status === 200 &&
    jaqueMateSentinel.status === 200 &&
    studioWebLaunch.status === 200 &&
    studioWriting.status === 200 &&
    work.status === 200 &&
    workNew.status === 200 &&
    workConnections.status === 200 &&
    workRuntimes.status === 200 &&
    workPolicies.status === 200;
  const commerceRouteOk = commerce.status === 200;
  const revenueRouteOk = revenue.status === 200;
  const analyticsRouteOk = analytics.status === 200;
  const routedProbes = [
    home,
    suite,
    identity,
    finance,
    automotiveSales,
    voice,
    health,
    frontier,
    jaqueMateSentinel,
    studioWebLaunch,
    studioWriting,
    commerce,
    revenue,
    analytics,
    network,
    networkPricing,
    networkCommissions,
    networkPayouts,
    networkCompliance,
    work,
    workNew,
    workConnections,
    workRuntimes,
    workPolicies
  ];
  const criticalNetworkRoutesOk = [
    network,
    networkPricing,
    networkCommissions,
    networkPayouts,
    networkCompliance
  ].every((result) => result.status === 200);
  const workRoutesOk = [work, workNew, workConnections, workRuntimes, workPolicies]
    .every((result) => result.status === 200);
  const deploymentPathProtected = [302, 401, 403].includes(deployment.status);
  const observedVersionId = home.atlas_version_id;
  const observedVersionTag = home.atlas_version_tag;
  const observedVersionIds = [...new Set(
    routedProbes
      .map((result) => result.atlas_version_id)
      .filter((versionId): versionId is string => Boolean(versionId))
  )];
  const productionCommitVerified = Boolean(caller.claims.sha) &&
    routedProbes.every((result) =>
      Boolean(result.atlas_version_id) && result.atlas_version_tag === caller.claims.sha
    );
  const verified = publicShellOk && commerceRouteOk && revenueRouteOk && analyticsRouteOk && criticalNetworkRoutesOk && workRoutesOk && deploymentPathProtected && productionCommitVerified;

  return json(
    {
      ok: verified,
      status: verified ? 'passed' : 'failed',
      verification_source: 'atlas-authorized-supabase-runtime',
      verifier_version: VERSION,
      production_url: PRODUCTION_URL,
      target_sha: caller.claims.sha,
      observed_version_id: observedVersionId,
      observed_version_ids: observedVersionIds,
      observed_version_tag: observedVersionTag,
      multi_version_same_sha: productionCommitVerified && observedVersionIds.length > 1,
      edge_security_preserved: true,
      checks: {
        public_home_reachable: home.status === 200,
        suite_route_reachable: suite.status === 200,
        identity_route_reachable: identity.status === 200,
        module_spa_shell_reachable: finance.status === 200,
        automotive_sales_report_reachable: automotiveSales.status === 200,
        voice_route_reachable: voice.status === 200,
        health_route_reachable: health.status === 200,
        frontier_route_reachable: frontier.status === 200,
        jaque_mate_sentinel_route_reachable: jaqueMateSentinel.status === 200,
        studio_web_launch_route_reachable: studioWebLaunch.status === 200,
        studio_writing_route_reachable: studioWriting.status === 200,
        commerce_route_reachable: commerce.status === 200,
        revenue_route_reachable: revenue.status === 200,
        analytics_route_reachable: analytics.status === 200,
        critical_network_routes_reachable: criticalNetworkRoutesOk,
        work_routes_reachable: workRoutesOk,
        work_command_center_reachable: work.status === 200,
        work_new_route_reachable: workNew.status === 200,
        work_connections_route_reachable: workConnections.status === 200,
        work_runtimes_route_reachable: workRuntimes.status === 200,
        work_policies_route_reachable: workPolicies.status === 200,
        production_commit_sha_verified: productionCommitVerified,
        network_route_reachable: network.status === 200,
        network_pricing_route_reachable: networkPricing.status === 200,
        network_commissions_route_reachable: networkCommissions.status === 200,
        network_payouts_route_reachable: networkPayouts.status === 200,
        network_compliance_route_reachable: networkCompliance.status === 200,
        deployment_path_protected: deploymentPathProtected,
        home,
        suite,
        identity,
        finance,
        automotive_sales: automotiveSales,
        voice,
        health,
        frontier,
        jaque_mate_sentinel: jaqueMateSentinel,
        studio_web_launch: studioWebLaunch,
        studio_writing: studioWriting,
        commerce,
        revenue,
        analytics,
        network,
        network_pricing: networkPricing,
        network_commissions: networkCommissions,
        network_payouts: networkPayouts,
        network_compliance: networkCompliance,
        work,
        work_new: workNew,
        work_connections: workConnections,
        work_runtimes: workRuntimes,
        work_policies: workPolicies,
        deployment
      },
      secrets_returned: false
    },
    verified ? 200 : 502
  );
});
