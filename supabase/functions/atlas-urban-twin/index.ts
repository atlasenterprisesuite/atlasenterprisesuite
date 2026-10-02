import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

const ENTITY_TYPES = ['district','site','building','floor','space','asset','infrastructure'] as const;
const BINDING_TYPES = ['cleanscan','device','gps','work','sensor','network','facility'] as const;
type EntityType = (typeof ENTITY_TYPES)[number];
type RequestContext = { userId: string; orgId: string; role: string };

const ALLOWED_PARENT_TYPES: Record<EntityType, EntityType[]> = {
  district: [],
  site: ['district'],
  building: ['district','site'],
  floor: ['building'],
  space: ['building','floor'],
  asset: ['site','building','floor','space'],
  infrastructure: ['district','site']
};

class UrbanTwinError extends Error {
  constructor(
    readonly code: string,
    readonly status = 400,
    readonly details: Record<string, unknown> = {}
  ) {
    super(code);
  }
}

function corsHeaders(origin: string | null): Record<string, string> {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...corsHeaders(req.headers.get('origin'))
    }
  });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function evidenceRefs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => clean(item, 1000))
    .filter((item) => item.length > 0)
    .filter((item) => !/(authorization:|bearer\s+|password\s*=|secret\s*=|service[_-]?role|sk-[a-z0-9_-]{8,})/i.test(item))
    .slice(0, 20);
}

function userClient(req: Request) {
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new UrbanTwinError('service_role_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

async function resolveContext(req: Request): Promise<RequestContext> {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new UrbanTwinError('supabase_runtime_not_configured', 503);
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw new UrbanTwinError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new UrbanTwinError('invalid_session', 401);

  const requestedOrg = clean(req.headers.get('x-atlas-org-id'), 80);
  if (requestedOrg && !isUuid(requestedOrg)) throw new UrbanTwinError('invalid_organization', 400);

  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrg) query = query.eq('org_id', requestedOrg);
  const { data, error } = await query.limit(1);
  if (error || !data?.[0]?.org_id) throw new UrbanTwinError('active_organization_required', 403);

  return {
    userId: authData.user.id,
    orgId: String(data[0].org_id),
    role: String(data[0].role || 'member')
  };
}

async function hasPermission(req: Request, ctx: RequestContext, permission: string) {
  const sb = userClient(req);
  const { data, error } = await sb.rpc('has_identity_permission', { o: ctx.orgId, p: permission });
  return !error && data === true;
}

async function requirePermission(req: Request, ctx: RequestContext, permission: string) {
  if (!(await hasPermission(req, ctx, permission))) throw new UrbanTwinError('authorization_denied', 403);
}

async function audit(
  ctx: RequestContext,
  action: string,
  tableName: string,
  recordId: string | null,
  newData: Record<string, unknown>
) {
  try {
    await adminClient().from('audit_logs').insert({
      org_id: ctx.orgId,
      user_id: ctx.userId,
      action,
      table_name: tableName,
      record_id: recordId,
      new_data: newData
    });
  } catch {
    // An audit failure never promotes verification state.
  }
}

async function ensureParent(admin: ReturnType<typeof createClient>, ctx: RequestContext, entityType: EntityType, parentId: string | null) {
  const allowedParents = ALLOWED_PARENT_TYPES[entityType];
  if (!parentId) {
    if (entityType !== 'district') return null;
    return null;
  }
  if (!isUuid(parentId)) throw new UrbanTwinError('invalid_parent_id', 422);
  if (!allowedParents.length) throw new UrbanTwinError('parent_not_allowed', 422);

  const { data, error } = await admin
    .from('atlas_urban_twin_entities')
    .select('id,entity_type,verification_state')
    .eq('id', parentId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();

  if (error || !data) throw new UrbanTwinError('parent_not_found', 404);
  if (!allowedParents.includes(String(data.entity_type) as EntityType)) {
    throw new UrbanTwinError('invalid_parent_type', 422, {
      entity_type: entityType,
      parent_type: data.entity_type
    });
  }
  return data;
}

async function capabilities(req: Request, ctx: RequestContext) {
  const [canManage, canVerify] = await Promise.all([
    hasPermission(req, ctx, 'city.twin.manage'),
    hasPermission(req, ctx, 'city.twin.verify')
  ]);
  return { can_manage: canManage, can_verify: canVerify, role: ctx.role };
}

async function createEntity(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'city.twin.manage');

  const entityType = clean(body.entity_type, 40) as EntityType;
  const name = clean(body.name, 180);
  const externalRef = clean(body.external_ref, 240) || null;
  const parentId = clean(body.parent_id, 80) || null;
  const latitudeRaw = body.latitude;
  const longitudeRaw = body.longitude;
  const latitude = latitudeRaw === null || latitudeRaw === undefined || latitudeRaw === '' ? null : Number(latitudeRaw);
  const longitude = longitudeRaw === null || longitudeRaw === undefined || longitudeRaw === '' ? null : Number(longitudeRaw);

  if (!ENTITY_TYPES.includes(entityType)) throw new UrbanTwinError('invalid_entity_type', 422);
  if (!name) throw new UrbanTwinError('entity_name_required', 422);
  if ((latitude === null) !== (longitude === null)) throw new UrbanTwinError('coordinate_pair_required', 422);
  if (latitude !== null && (!Number.isFinite(latitude) || latitude < -90 || latitude > 90)) {
    throw new UrbanTwinError('invalid_latitude', 422);
  }
  if (longitude !== null && (!Number.isFinite(longitude) || longitude < -180 || longitude > 180)) {
    throw new UrbanTwinError('invalid_longitude', 422);
  }

  const admin = adminClient();
  await ensureParent(admin, ctx, entityType, parentId);

  const { data, error } = await admin
    .from('atlas_urban_twin_entities')
    .insert({
      tenant_id: ctx.orgId,
      org_id: ctx.orgId,
      parent_id: parentId,
      entity_type: entityType,
      name,
      external_ref: externalRef,
      source_kind: 'manual',
      lifecycle_state: 'planned',
      verification_state: 'unverified',
      latitude,
      longitude,
      created_by: ctx.userId
    })
    .select('id,parent_id,entity_type,name,external_ref,source_kind,lifecycle_state,verification_state,latitude,longitude,created_at,updated_at')
    .single();

  if (error || !data) throw new UrbanTwinError('entity_create_failed', 503);

  await audit(ctx, 'city.twin.entity.registered', 'atlas_urban_twin_entities', data.id, {
    entity_type: entityType,
    parent_id: parentId,
    coordinates_supplied: latitude !== null
  });

  return data;
}

async function createBinding(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'city.twin.manage');

  const entityId = clean(body.entity_id, 80);
  const bindingType = clean(body.binding_type, 40);
  const adapter = clean(body.adapter, 120);
  const externalRef = clean(body.external_ref, 240);

  if (!isUuid(entityId)) throw new UrbanTwinError('invalid_entity_id', 422);
  if (!BINDING_TYPES.includes(bindingType as typeof BINDING_TYPES[number])) throw new UrbanTwinError('invalid_binding_type', 422);
  if (!adapter || !externalRef) throw new UrbanTwinError('adapter_and_external_ref_required', 422);

  const admin = adminClient();
  const { data: entity } = await admin
    .from('atlas_urban_twin_entities')
    .select('id')
    .eq('id', entityId)
    .eq('org_id', ctx.orgId)
    .maybeSingle();
  if (!entity) throw new UrbanTwinError('entity_not_found', 404);

  const { data, error } = await admin
    .from('atlas_urban_twin_bindings')
    .insert({
      tenant_id: ctx.orgId,
      org_id: ctx.orgId,
      entity_id: entityId,
      binding_type: bindingType,
      adapter,
      external_ref: externalRef,
      verification_state: 'unverified',
      created_by: ctx.userId
    })
    .select('id,entity_id,binding_type,adapter,external_ref,verification_state,evidence_refs,created_at,updated_at')
    .single();

  if (error || !data) {
    if (String(error?.code || '') === '23505') throw new UrbanTwinError('binding_already_exists', 409);
    throw new UrbanTwinError('binding_create_failed', 503);
  }

  await audit(ctx, 'city.twin.binding.registered', 'atlas_urban_twin_bindings', data.id, {
    entity_id: entityId,
    binding_type: bindingType,
    adapter
  });

  return data;
}

async function verifyTarget(req: Request, ctx: RequestContext, body: Record<string, unknown>) {
  await requirePermission(req, ctx, 'city.twin.verify');

  const targetType = clean(body.target_type, 20);
  const targetId = clean(body.target_id, 80);
  const evidence = evidenceRefs(body.evidence_refs);

  if (!['entity','binding'].includes(targetType)) throw new UrbanTwinError('invalid_target_type', 422);
  if (!isUuid(targetId)) throw new UrbanTwinError('invalid_target_id', 422);
  if (!evidence.length) throw new UrbanTwinError('verification_evidence_required', 422);

  const now = new Date().toISOString();
  const admin = adminClient();

  if (targetType === 'entity') {
    const { data, error } = await admin
      .from('atlas_urban_twin_entities')
      .update({
        verification_state: 'verified',
        verification_evidence_refs: evidence,
        verified_by: ctx.userId,
        verified_at: now,
        last_verified_at: now
      })
      .eq('id', targetId)
      .eq('org_id', ctx.orgId)
      .neq('verification_state', 'revoked')
      .select('id,name,entity_type,verification_state,verified_at,last_verified_at')
      .maybeSingle();

    if (error || !data) throw new UrbanTwinError('entity_verify_failed', 409);
    await audit(ctx, 'city.twin.entity.verified', 'atlas_urban_twin_entities', targetId, {
      evidence_count: evidence.length,
      verification_method: 'manual_evidence_review'
    });
    return data;
  }

  const { data, error } = await admin
    .from('atlas_urban_twin_bindings')
    .update({
      verification_state: 'verified',
      evidence_refs: evidence,
      verified_by: ctx.userId,
      verified_at: now,
      last_verified_at: now
    })
    .eq('id', targetId)
    .eq('org_id', ctx.orgId)
    .neq('verification_state', 'revoked')
    .select('id,entity_id,binding_type,adapter,external_ref,verification_state,verified_at,last_verified_at')
    .maybeSingle();

  if (error || !data) throw new UrbanTwinError('binding_verify_failed', 409);
  await audit(ctx, 'city.twin.binding.verified', 'atlas_urban_twin_bindings', targetId, {
    evidence_count: evidence.length,
    verification_method: 'manual_evidence_review'
  });
  return data;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders(req.headers.get('origin')) });
  }

  try {
    const ctx = await resolveContext(req);
    const operation = new URL(req.url).searchParams.get('api') || 'capabilities';

    if (req.method === 'GET' && operation === 'capabilities') {
      return json(req, { ok: true, service: 'atlas-urban-twin', ...(await capabilities(req, ctx)) });
    }

    if (req.method !== 'POST') throw new UrbanTwinError('method_not_allowed', 405);
    const body = await req.json().catch(() => ({})) as Record<string, unknown>;

    if (operation === 'entity') return json(req, { ok: true, entity: await createEntity(req, ctx, body) }, 201);
    if (operation === 'binding') return json(req, { ok: true, binding: await createBinding(req, ctx, body) }, 201);
    if (operation === 'verify') return json(req, { ok: true, target: await verifyTarget(req, ctx, body) });

    throw new UrbanTwinError('not_found', 404);
  } catch (error) {
    if (error instanceof UrbanTwinError) {
      return json(req, { ok: false, error: error.code, ...error.details }, error.status);
    }
    return json(req, { ok: false, error: 'internal_error' }, 500);
  }
});
