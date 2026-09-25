import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const VERSION = 1;
const MAX_BODY_BYTES = 32 * 1024;

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

class EdgeError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

function cors(req: Request) {
  const origin = req.headers.get('origin') || '';
  return origin && ALLOWED_ORIGINS.has(origin)
    ? {
        'access-control-allow-origin': origin,
        'access-control-allow-headers': 'authorization,content-type,apikey,x-atlas-org-id',
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        vary: 'Origin'
      }
    : {};
}

function headers(req: Request) {
  return {
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...cors(req)
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: headers(req) });
}

function bearer(req: Request) {
  const auth = req.headers.get('authorization') || '';
  if (!/^Bearer\s+\S+$/i.test(auth)) throw new EdgeError('authentication_required', 401);
  return auth;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function cleanText(value: unknown, max: number, required = false) {
  const text = String(value ?? '').trim().slice(0, max);
  if (required && !text) throw new EdgeError('required_field_missing', 422);
  return text;
}

function userClient(auth: string) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new EdgeError('server_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: auth } }
  });
}

async function context(req: Request) {
  const auth = bearer(req);
  const client = userClient(auth);
  const { data: userData, error: userError } = await client.auth.getUser();
  if (userError || !userData.user) throw new EdgeError('invalid_session', 401);

  const { data: memberships, error: membershipError } = await client
    .from('organization_members')
    .select('org_id,role,status')
    .eq('status', 'active');

  if (membershipError) throw new EdgeError('identity_unavailable', 502);
  const rows = Array.isArray(memberships) ? memberships : [];
  if (!rows.length) throw new EdgeError('active_organization_required', 403);

  const requested = (req.headers.get('x-atlas-org-id') || '').trim();
  if (requested && !isUuid(requested)) throw new EdgeError('invalid_organization_id', 400);
  const membership = requested
    ? rows.find((row) => String(row.org_id) === requested)
    : rows[0];
  if (!membership) throw new EdgeError('organization_membership_required', 403);

  return {
    auth,
    client,
    userId: userData.user.id,
    orgId: String(membership.org_id),
    role: String(membership.role || '')
  };
}

function openApiSpec() {
  return {
    openapi: '3.1.0',
    info: {
      title: 'ATLAS Cloud Control API',
      version: String(VERSION),
      description:
        'Authenticated, organization-scoped control API over existing ATLAS project, service and observability authorities.'
    },
    servers: [{ url: '/functions/v1/atlas-cloud-control' }],
    paths: {
      '/?api=resources': {
        get: {
          summary: 'List organization projects and registered ATLAS services',
          security: [{ atlasBearer: [] }],
          responses: { '200': { description: 'Resource inventory' } }
        }
      },
      '/?api=project&id={projectId}': {
        get: {
          summary: 'Read one project with tasks and milestones',
          security: [{ atlasBearer: [] }],
          parameters: [
            { name: 'projectId', in: 'path', required: true, schema: { type: 'string', format: 'uuid' } }
          ],
          responses: { '200': { description: 'Project detail' } }
        }
      },
      '/?api=observability': {
        get: {
          summary: 'Read the native ATLAS observability summary',
          security: [{ atlasBearer: [] }],
          responses: { '200': { description: 'Sanitized observability summary' } }
        }
      },
      '/?api=project-create': {
        post: {
          summary: 'Create an organization project through existing RLS',
          security: [{ atlasBearer: [] }],
          responses: {
            '201': { description: 'Project created' },
            '403': { description: 'Project write permission required' }
          }
        }
      }
    },
    components: {
      securitySchemes: {
        atlasBearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }
      }
    }
  };
}

async function resources(ctx: Awaited<ReturnType<typeof context>>) {
  const [projectsQ, modulesQ] = await Promise.all([
    ctx.client
      .from('projects')
      .select('id,name,description,status,priority,owner_user_id,start_date,due_date,completed_at,updated_at')
      .eq('org_id', ctx.orgId)
      .order('updated_at', { ascending: false })
      .limit(200),
    ctx.client
      .from('atlas_module_registry')
      .select('module_code,enabled,launch_status,data_backend,updated_at')
      .eq('org_id', ctx.orgId)
      .order('module_code', { ascending: true })
      .limit(300)
  ]);

  if (projectsQ.error) throw new EdgeError('projects_unavailable', 502);
  if (modulesQ.error) throw new EdgeError('service_registry_unavailable', 502);

  return {
    ok: true,
    organization_id: ctx.orgId,
    role: ctx.role,
    projects: projectsQ.data || [],
    services: modulesQ.data || [],
    truth: {
      project_authority: 'public.projects',
      service_authority: 'public.atlas_module_registry',
      duplicated_registry_created: false
    }
  };
}

async function projectDetail(ctx: Awaited<ReturnType<typeof context>>, id: string) {
  if (!isUuid(id)) throw new EdgeError('invalid_project_id', 400);

  const [projectQ, tasksQ, milestonesQ] = await Promise.all([
    ctx.client
      .from('projects')
      .select('id,name,description,status,priority,owner_user_id,start_date,due_date,completed_at,updated_at')
      .eq('org_id', ctx.orgId)
      .eq('id', id)
      .maybeSingle(),
    ctx.client
      .from('project_tasks')
      .select('id,title,description,status,priority,assigned_user_id,due_date,completed_at,updated_at')
      .eq('org_id', ctx.orgId)
      .eq('project_id', id)
      .order('updated_at', { ascending: false }),
    ctx.client
      .from('project_milestones')
      .select('id,name,status,due_date,completed_at,updated_at')
      .eq('org_id', ctx.orgId)
      .eq('project_id', id)
      .order('due_date', { ascending: true })
  ]);

  if (projectQ.error) throw new EdgeError('project_unavailable', 502);
  if (!projectQ.data) throw new EdgeError('project_not_found', 404);
  if (tasksQ.error || milestonesQ.error) throw new EdgeError('project_children_unavailable', 502);

  return {
    ok: true,
    project: projectQ.data,
    tasks: tasksQ.data || [],
    milestones: milestonesQ.data || []
  };
}

async function createProject(ctx: Awaited<ReturnType<typeof context>>, req: Request) {
  const length = Number(req.headers.get('content-length') || '0');
  if (length > MAX_BODY_BYTES) throw new EdgeError('payload_too_large', 413);

  const body = await req.json().catch(() => {
    throw new EdgeError('invalid_json', 400);
  });

  const name = cleanText(body?.name, 160, true);
  const description = cleanText(body?.description, 2000);
  const priority = cleanText(body?.priority || 'medium', 20);
  if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
    throw new EdgeError('invalid_priority', 422);
  }

  const startDate = cleanText(body?.start_date, 10) || null;
  const dueDate = cleanText(body?.due_date, 10) || null;

  const { data, error } = await ctx.client
    .from('projects')
    .insert({
      org_id: ctx.orgId,
      name,
      description: description || null,
      status: 'planned',
      priority,
      start_date: startDate,
      due_date: dueDate,
      created_by: ctx.userId
    })
    .select('id,name,description,status,priority,start_date,due_date,updated_at')
    .single();

  if (error) {
    const code = error.code === '42501' ? 'project_write_permission_required' : 'project_create_failed';
    throw new EdgeError(code, error.code === '42501' ? 403 : 422);
  }

  return data;
}

async function observability(ctx: Awaited<ReturnType<typeof context>>) {
  const response = await fetch(
    `${SUPABASE_URL}/functions/v1/atlas-observability?api=summary`,
    {
      method: 'GET',
      headers: {
        Authorization: ctx.auth,
        apikey: PUBLISHABLE_KEY,
        'x-atlas-org-id': ctx.orgId
      },
      cache: 'no-store'
    }
  );
  const data = await response.json().catch(() => ({ ok: false, error: 'observability_invalid_response' }));
  if (!response.ok) {
    throw new EdgeError(String(data?.error || 'observability_unavailable'), response.status);
  }
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });

  const url = new URL(req.url);
  const api = url.searchParams.get('api') || '';

  try {
    const ctx = await context(req);

    if (req.method === 'GET' && api === 'openapi') {
      return json(req, openApiSpec());
    }
    if (req.method === 'GET' && api === 'resources') {
      return json(req, await resources(ctx));
    }
    if (req.method === 'GET' && api === 'project') {
      return json(req, await projectDetail(ctx, String(url.searchParams.get('id') || '')));
    }
    if (req.method === 'GET' && api === 'observability') {
      return json(req, { ok: true, observability: await observability(ctx) });
    }
    if (req.method === 'POST' && api === 'project-create') {
      return json(req, { ok: true, project: await createProject(ctx, req) }, 201);
    }

    return json(req, { ok: false, error: 'not_found' }, 404);
  } catch (error) {
    const code = error instanceof EdgeError ? error.code : 'internal_error';
    const status = error instanceof EdgeError ? error.status : 500;
    return json(req, { ok: false, error: code }, status);
  }
});
