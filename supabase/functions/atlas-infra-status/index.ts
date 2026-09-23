import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  classifyCloudflareIncidentScope,
  evaluateInfrastructure
} from '../_shared/infrastructure-readiness.ts';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 'https://ggmanzcgtlrvqfoccgsh.supabase.co';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const CANONICAL_REPO = Deno.env.get('ATLAS_CANONICAL_REPO') || 'atlasenterprisesuite/atlasenterprisesuite';
const PRODUCTION_URL = Deno.env.get('ATLAS_PRODUCTION_URL') || 'https://www.atlasenterprisesuite.com';
const VERSION = 7;
const CLOUDFLARE_STATUS_URL = 'https://www.cloudflarestatus.com/api/v2/incidents/unresolved.json';

type Blocker = {
  stage: string;
  code: string;
  detail: string;
};

type CloudflareStatusComponent = {
  name?: string;
};

type CloudflareStatusUpdate = {
  affected_components?: CloudflareStatusComponent[];
};

type CloudflareStatusIncident = {
  id?: string;
  name?: string;
  status?: string;
  impact?: string;
  updated_at?: string;
  components?: CloudflareStatusComponent[];
  incident_updates?: CloudflareStatusUpdate[];
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });

const timeout = async (url: string, init: RequestInit = {}, ms = 6000) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store'
    });
  } finally {
    clearTimeout(timer);
  }
};

async function authorize(req: Request) {
  if (!ANON_KEY || !SERVICE_ROLE) {
    return { ok: false as const, status: 500, error: 'supabase_runtime_credentials_missing' };
  }

  const auth = req.headers.get('authorization') || '';
  if (!auth.toLowerCase().startsWith('bearer ')) {
    return { ok: false as const, status: 401, error: 'authentication_required' };
  }

  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: auth } },
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) {
    return { ok: false as const, status: 401, error: 'invalid_session' };
  }

  const { data: memberships, error: membershipError } = await userClient
    .from('organization_members')
    .select('org_id,role,status')
    .eq('status', 'active')
    .limit(1);

  if (membershipError || !memberships?.[0]) {
    return { ok: false as const, status: 403, error: 'active_organization_required' };
  }

  const role = String(memberships[0].role || '');
  if (!['owner', 'admin', 'platform_admin'].includes(role)) {
    return { ok: false as const, status: 403, error: 'infrastructure_admin_required' };
  }

  return {
    ok: true as const,
    orgId: String(memberships[0].org_id),
    role
  };
}

async function probe(url: string) {
  const started = Date.now();
  try {
    const response = await timeout(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'ATLAS-Manager/7.0' }
    });
    return {
      reachable: response.status >= 200 && response.status < 500,
      status_code: response.status,
      duration_ms: Date.now() - started
    };
  } catch (error) {
    return {
      reachable: false,
      status_code: null,
      duration_ms: Date.now() - started,
      error: error instanceof Error ? error.name : 'probe_failed'
    };
  }
}

async function repairBridgeState() {
  const started = Date.now();
  try {
    const response = await timeout(`${SUPABASE_URL}/functions/v1/atlas-repair-bridge?api=readiness`, {
      headers: ANON_KEY
        ? { apikey: ANON_KEY, 'user-agent': 'ATLAS-Manager/7.0' }
        : { 'user-agent': 'ATLAS-Manager/7.0' }
    });
    const data = await response.json().catch(() => ({}));
    const openaiConfigured = data?.openaiConfigured === true;

    return {
      reachable: response.status >= 200 && response.status < 500,
      status_code: response.status,
      duration_ms: Date.now() - started,
      state: data?.state || (response.ok ? 'reachable' : 'unavailable'),
      repository: data?.repository || null,
      workflow: data?.workflow || null,
      version: data?.version || null,
      primary_planner: data?.primaryPlanner || null,
      openaiConfigured,
      planner_ready: openaiConfigured,
      blocker: data?.blocker || (openaiConfigured ? null : 'repair_planner_not_configured')
    };
  } catch (error) {
    return {
      reachable: false,
      status_code: null,
      duration_ms: Date.now() - started,
      state: 'unreachable',
      openaiConfigured: false,
      planner_ready: false,
      blocker: 'repair_bridge_unreachable',
      error: error instanceof Error ? error.name : 'probe_failed'
    };
  }
}

async function vercelState() {
  const token = Deno.env.get('VERCEL_TOKEN') || '';
  const teamId = Deno.env.get('VERCEL_TEAM_ID') || Deno.env.get('VERCEL_ORG_ID') || '';
  const configuredProject = Deno.env.get('VERCEL_PROJECT_ID') || '';

  if (!token) {
    return {
      state: 'not_configured',
      authorization: 'missing',
      project_verified: false
    };
  }

  try {
    const qs = teamId ? `?teamId=${encodeURIComponent(teamId)}&limit=20` : '?limit=20';
    const response = await timeout(`https://api.vercel.com/v9/projects${qs}`, {
      headers: { authorization: `Bearer ${token}` }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        state: 'authorization_error',
        authorization: 'present',
        project_verified: false,
        status_code: response.status
      };
    }

    const projects = Array.isArray(data?.projects) ? data.projects : [];
    const verified = configuredProject
      ? projects.some((project: { id?: string; name?: string }) =>
          project?.id === configuredProject || project?.name === configuredProject
        )
      : projects.length > 0;

    return {
      state: verified ? 'ready' : 'project_not_configured',
      authorization: 'verified',
      project_verified: verified,
      project_count: projects.length
    };
  } catch {
    return {
      state: 'unreachable',
      authorization: 'present',
      project_verified: false
    };
  }
}

async function githubState() {
  const token = Deno.env.get('GITHUB_TOKEN') || Deno.env.get('ATLAS_GITHUB_TOKEN') || '';
  const repair_bridge = await repairBridgeState();

  if (!token) {
    return {
      state: repair_bridge.reachable ? 'oidc_bridge_reachable_token_not_present' : 'authorization_unverified',
      repository: CANONICAL_REPO,
      repair_bridge
    };
  }

  try {
    const response = await timeout(`https://api.github.com/repos/${CANONICAL_REPO}`, {
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28'
      }
    });

    if (!response.ok) {
      return {
        state: response.status === 404 ? 'repository_not_visible' : 'authorization_error',
        repository: CANONICAL_REPO,
        status_code: response.status,
        repair_bridge
      };
    }

    const repo = await response.json();
    const workflowResponse = await timeout(
      `https://api.github.com/repos/${CANONICAL_REPO}/actions/runs?branch=main&per_page=1`,
      {
        headers: {
          authorization: `Bearer ${token}`,
          accept: 'application/vnd.github+json',
          'x-github-api-version': '2022-11-28'
        }
      }
    );
    const workflowData = await workflowResponse.json().catch(() => ({}));
    const latest = Array.isArray(workflowData?.workflow_runs) ? workflowData.workflow_runs[0] : null;

    return {
      state: 'ready',
      repository: CANONICAL_REPO,
      default_branch: repo?.default_branch || 'main',
      latest_workflow: latest
        ? {
            status: latest.status,
            conclusion: latest.conclusion,
            head_sha: latest.head_sha,
            updated_at: latest.updated_at
          }
        : null,
      repair_bridge
    };
  } catch {
    return {
      state: 'unreachable',
      repository: CANONICAL_REPO,
      repair_bridge
    };
  }
}

function incidentComponentNames(incident: CloudflareStatusIncident) {
  const direct = Array.isArray(incident.components)
    ? incident.components.map((component) => component?.name || '')
    : [];
  const fromUpdates = Array.isArray(incident.incident_updates)
    ? incident.incident_updates.flatMap((update) =>
        Array.isArray(update?.affected_components)
          ? update.affected_components.map((component) => component?.name || '')
          : []
      )
    : [];

  return [...new Set([...direct, ...fromUpdates].filter(Boolean))];
}

function highestIncidentImpact(incidents: Array<{ impact: string }>) {
  const rank: Record<string, number> = { none: 0, minor: 1, major: 2, critical: 3 };
  return incidents.reduce(
    (current, incident) =>
      (rank[incident.impact] ?? 0) > (rank[current] ?? 0) ? incident.impact : current,
    'none'
  );
}

async function cloudflarePublicStatus() {
  const started = Date.now();
  try {
    const response = await timeout(CLOUDFLARE_STATUS_URL, {
      headers: { 'user-agent': 'ATLAS-Manager/7.0' }
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        state: 'unavailable',
        reachable: false,
        status_code: response.status,
        duration_ms: Date.now() - started,
        unresolved_count: 0,
        relevant_count: 0,
        incidents: [],
        provider_incident: null
      };
    }

    const sourceIncidents: CloudflareStatusIncident[] = Array.isArray(data?.incidents)
      ? data.incidents
      : [];
    const incidents = sourceIncidents.map((incident) => {
      const components = incidentComponentNames(incident);
      const scope = classifyCloudflareIncidentScope([incident.name || '', ...components]);
      return {
        id: incident.id || null,
        name: incident.name || 'Unnamed Cloudflare incident',
        status: incident.status || 'unknown',
        impact: incident.impact || 'none',
        updated_at: incident.updated_at || null,
        scope,
        components
      };
    });

    const relevantIncidents = incidents.filter((incident) => incident.scope !== 'unknown');
    const dashboardAffected = relevantIncidents.some(
      (incident) => incident.scope === 'dashboard' || incident.scope === 'mixed'
    );
    const edgeAffected = relevantIncidents.some(
      (incident) => incident.scope === 'edge' || incident.scope === 'mixed'
    );
    const aggregateScope: ReturnType<typeof classifyCloudflareIncidentScope> =
      dashboardAffected && edgeAffected
        ? 'mixed'
        : dashboardAffected
          ? 'dashboard'
          : edgeAffected
            ? 'edge'
            : 'unknown';
    const incidentSetForImpact = relevantIncidents.length > 0 ? relevantIncidents : incidents;
    const providerIncident = incidents.length === 0
      ? null
      : {
          source: 'cloudflare_status' as const,
          active: true,
          scope: aggregateScope,
          impact: highestIncidentImpact(incidentSetForImpact),
          name:
            relevantIncidents.length === 1
              ? relevantIncidents[0].name
              : relevantIncidents.length > 1
                ? 'Multiple unresolved Cloudflare incidents'
                : incidents[0].name
        };

    return {
      state: 'reachable',
      reachable: true,
      status_code: response.status,
      duration_ms: Date.now() - started,
      unresolved_count: incidents.length,
      relevant_count: relevantIncidents.length,
      incidents: incidents.slice(0, 10),
      provider_incident: providerIncident
    };
  } catch (error) {
    return {
      state: 'unreachable',
      reachable: false,
      status_code: null,
      duration_ms: Date.now() - started,
      unresolved_count: 0,
      relevant_count: 0,
      incidents: [],
      provider_incident: null,
      error: error instanceof Error ? error.name : 'status_probe_failed'
    };
  }
}

async function cloudflareState() {
  const token = Deno.env.get('CLOUDFLARE_API_TOKEN') || Deno.env.get('CF_API_TOKEN') || '';
  const zoneId = Deno.env.get('CLOUDFLARE_ZONE_ID') || '';
  const [publicEdge, providerStatus] = await Promise.all([
    probe(`${PRODUCTION_URL}/status`),
    cloudflarePublicStatus()
  ]);

  if (!token) {
    return {
      state: publicEdge.reachable
        ? 'public_edge_reachable_control_api_not_configured'
        : 'not_configured',
      authorization: 'missing',
      public_edge: publicEdge,
      provider_status: providerStatus,
      provider_incident: providerStatus.provider_incident
    };
  }

  try {
    const target = zoneId
      ? `https://api.cloudflare.com/client/v4/zones/${zoneId}`
      : 'https://api.cloudflare.com/client/v4/user/tokens/verify';
    const response = await timeout(target, {
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      }
    });
    const data = await response.json().catch(() => ({}));

    return {
      state: response.ok && data?.success !== false ? 'ready' : 'authorization_error',
      authorization: response.ok ? 'verified' : 'rejected',
      zone_verified: Boolean(zoneId && response.ok),
      status_code: response.status,
      public_edge: publicEdge,
      provider_status: providerStatus,
      provider_incident: providerStatus.provider_incident
    };
  } catch {
    return {
      state: 'unreachable',
      authorization: 'present',
      public_edge: publicEdge,
      provider_status: providerStatus,
      provider_incident: providerStatus.provider_incident
    };
  }
}

Deno.serve(async (req: Request) => {
  if (req.method !== 'GET') {
    return json({ ok: false, error: 'method_not_allowed' }, 405);
  }

  const auth = await authorize(req);
  if (!auth.ok) {
    return json({ ok: false, error: auth.error }, auth.status);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const verificationColumns =
    'verification_type,target_service,target_version,environment,status,provider,provider_state,storage_state,error_code,error_detail,created_at,checks,metadata';

  const [
    releaseQ,
    runtimeQ,
    infraQ,
    controlQ,
    productionRoot,
    productionStatus,
    github,
    vercel,
    cloudflare
  ] = await Promise.all([
    admin
      .from('atlas_release_registry')
      .select('release_key,version,release_status,released_at')
      .order('released_at', { ascending: false })
      .limit(1),
    admin
      .from('atlas_runtime_verification_runs')
      .select(verificationColumns)
      .order('created_at', { ascending: false })
      .limit(1),
    admin
      .from('atlas_runtime_verification_runs')
      .select(verificationColumns)
      .eq('verification_type', 'infrastructure-deployment')
      .order('created_at', { ascending: false })
      .limit(1),
    admin
      .from('atlas_runtime_verification_runs')
      .select(verificationColumns)
      .eq('verification_type', 'infrastructure-control')
      .order('created_at', { ascending: false })
      .limit(1),
    probe(`${PRODUCTION_URL}/`),
    probe(`${PRODUCTION_URL}/status`),
    githubState(),
    vercelState(),
    cloudflareState()
  ]);

  const latestRelease = releaseQ.data?.[0] || null;
  const latestRuntimeVerification = runtimeQ.data?.[0] || null;
  const latestInfrastructureVerification = infraQ.data?.[0] || null;
  const latestControlVerification = controlQ.data?.[0] || null;
  const supabaseState =
    releaseQ.error || runtimeQ.error || infraQ.error || controlQ.error ? 'degraded' : 'ready';

  const normalized = evaluateInfrastructure({
    github: {
      state: ['ready', 'oidc_bridge_reachable_token_not_present'].includes(github.state)
        ? 'ready'
        : github.state,
      required: true
    },
    supabase: { state: supabaseState, required: true },
    cloudflare: {
      state: cloudflare.state,
      required: true,
      incident: cloudflare.provider_incident
    },
    production: {
      state: productionRoot.reachable ? 'ready' : 'public_site_unreachable',
      required: true
    },
    vercel: { state: vercel.state, required: false }
  });

  const blockers: Blocker[] = normalized.blockers.map((blocker) => ({
    stage: blocker.provider,
    code: blocker.reason,
    detail: `${blocker.provider} is required for the active production path and is not ready.`
  }));

  if (!github.repair_bridge?.reachable) {
    blockers.push({
      stage: 'repair',
      code: 'repair_bridge_unreachable',
      detail: 'ATLAS repair bridge is not reachable.'
    });
  } else if (github.repair_bridge?.planner_ready === false) {
    blockers.push({
      stage: 'repair',
      code: 'repair_planner_not_configured',
      detail: 'ATLAS repair bridge is reachable, but its OpenAI repair planner is not configured.'
    });
  }

  if (
    latestRuntimeVerification?.status === 'blocked' ||
    latestRuntimeVerification?.status === 'failed'
  ) {
    blockers.push({
      stage: 'runtime',
      code: latestRuntimeVerification.error_code || latestRuntimeVerification.status,
      detail: `Latest ${latestRuntimeVerification.target_service || 'runtime'} verification is ${latestRuntimeVerification.status}.`
    });
  }

  if (
    latestInfrastructureVerification?.status === 'failed' ||
    latestInfrastructureVerification?.status === 'blocked'
  ) {
    blockers.push({
      stage: 'deployment',
      code: latestInfrastructureVerification.error_code || latestInfrastructureVerification.status,
      detail:
        latestInfrastructureVerification.error_detail ||
        'Latest infrastructure deployment verification is not passing.'
    });
  }

  if (
    latestControlVerification?.status === 'failed' ||
    latestControlVerification?.status === 'blocked'
  ) {
    blockers.push({
      stage: 'control',
      code: latestControlVerification.error_code || latestControlVerification.status,
      detail:
        latestControlVerification.error_detail ||
        'Latest infrastructure control verification is not passing.'
    });
  }

  blockers.push({
    stage: 'routing',
    code: 'public_route_bridge_required',
    detail:
      'Internal ATLAS Manager status is available here; /atlas/infra/status still requires verified public routing through the active Cloudflare production path.'
  });

  const blockedStages = new Set(['production', 'supabase', 'runtime', 'deployment', 'control']);
  const readiness =
    blockers.length === 0
      ? 'ready'
      : blockers.some((blocker) => blockedStages.has(blocker.stage))
        ? 'blocked'
        : 'partial';

  return json({
    ok: true,
    service: 'atlas-infra-status',
    owner: 'atlas-sovereign-control-plane',
    version: VERSION,
    scope: {
      organization_id: auth.orgId,
      role: auth.role
    },
    canonical_repository: CANONICAL_REPO,
    canonical_policy: 'docs/governance/ATLAS_CANONICAL_REPOSITORY.md',
    target_public_route: '/atlas/infra/status',
    required_path: normalized.requiredPath,
    provider_requirements: {
      github: true,
      supabase: true,
      cloudflare: true,
      production: true,
      vercel: false
    },
    provider_status: normalized.providers,
    diagnostics: normalized.diagnostics,
    production_readiness: readiness,
    infrastructure: {
      github,
      vercel,
      cloudflare,
      supabase: {
        state: supabaseState,
        project: 'atlas-core',
        project_ref: 'ggmanzcgtlrvqfoccgsh',
        database: 'reachable',
        latest_release: latestRelease,
        latest_runtime_verification: latestRuntimeVerification,
        latest_infrastructure_verification: latestInfrastructureVerification,
        latest_control_verification: latestControlVerification
      },
      production: {
        root: productionRoot,
        status_page: productionStatus
      }
    },
    blockers,
    evidence: {
      release_registry: !releaseQ.error,
      runtime_verification_registry: !runtimeQ.error,
      infrastructure_evidence: latestInfrastructureVerification,
      control_evidence: latestControlVerification,
      generated_at: new Date().toISOString()
    }
  });
});
