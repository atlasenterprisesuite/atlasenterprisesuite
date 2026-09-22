import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const VERSION = '2026-09-22.1';
const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173'
]);
const KINDS = new Set(['decision','requirement','workflow','configuration','evidence','note']);
const SOURCES = new Set(['atlas','chat_import','document','user_entry','system_event']);
const ADMIN_ROLES = new Set(['owner','admin','platform_admin']);

type MemoryContext = {
  userId: string;
  orgId: string;
  role: string;
};

function cors(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.has(origin) ? origin : null;
  return {
    ...(allowed ? { 'access-control-allow-origin': allowed } : {}),
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin'
  };
}

function json(body: unknown, status = 200, origin: string | null = null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors(origin),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function fail(code: string, status = 400) {
  return Object.assign(new Error(code), { code, status });
}

function adminClient() {
  if (!URL || !SERVICE_ROLE) throw fail('server_runtime_not_configured', 503);
  return createClient(URL, SERVICE_ROLE, { auth: { persistSession: false, autoRefreshToken: false } });
}

function uuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function context(req: Request): Promise<MemoryContext> {
  if (!URL || !PUBLISHABLE) throw fail('supabase_runtime_not_configured', 503);
  const auth = req.headers.get('authorization') || '';
  const token = auth.replace(/^Bearer\s+/i, '');
  if (!token) throw fail('authentication_required', 401);
  const sb = createClient(URL, PUBLISHABLE, {
    global: { headers: { Authorization: auth } },
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data, error } = await sb.auth.getUser(token);
  if (error || !data.user) throw fail('invalid_session', 401);

  const requested = String(req.headers.get('x-atlas-org-id') || '').trim();
  if (requested && !uuid(requested)) throw fail('invalid_organization', 400);
  const { data: memberships, error: membershipError } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', data.user.id)
    .eq('status', 'active');
  if (membershipError || !memberships?.length) throw fail('active_organization_required', 403);
  const membership = requested
    ? memberships.find(row => String(row.org_id) === requested)
    : memberships[0];
  if (!membership) throw fail('organization_membership_required', 403);
  return { userId: data.user.id, orgId: String(membership.org_id), role: String(membership.role || 'member') };
}

async function body(req: Request) {
  try {
    const parsed = await req.json();
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
    return parsed as Record<string, any>;
  } catch {
    throw fail('invalid_json', 400);
  }
}

function strings(value: unknown, max = 40) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(item => String(item).trim()).filter(Boolean))].slice(0, max);
}

function safeText(value: unknown, max: number) {
  return String(value ?? '').trim().slice(0, max);
}

function normalizeDraft(input: Record<string, any>) {
  const kind = safeText(input.kind, 40);
  const sourceType = safeText(input.source_type ?? input.sourceType, 40);
  const title = safeText(input.title, 240);
  if (!KINDS.has(kind)) throw fail('memory_kind_invalid', 422);
  if (!SOURCES.has(sourceType)) throw fail('memory_source_invalid', 422);
  if (!title) throw fail('memory_title_required', 422);
  const sourceRef = safeText(input.source_ref ?? input.sourceRef, 1000) || null;
  if (sourceType === 'chat_import' && !sourceRef) throw fail('chat_source_ref_required', 422);
  const content = input.content_json ?? input.contentJson ?? {};
  if (!content || typeof content !== 'object' || Array.isArray(content)) throw fail('memory_content_invalid', 422);
  const sensitivity = safeText(input.sensitivity || 'organization', 40);
  if (!['organization','restricted'].includes(sensitivity)) throw fail('memory_sensitivity_invalid', 422);
  return {
    kind,
    status: 'draft',
    title,
    summary: safeText(input.summary, 4000),
    content_json: content,
    source_type: sourceType,
    source_ref: sourceRef,
    source_hash: safeText(input.source_hash ?? input.sourceHash, 128) || null,
    module_ids: strings(input.module_ids ?? input.moduleIds),
    tags: strings(input.tags),
    sensitivity,
    supersedes_id: input.supersedes_id && uuid(String(input.supersedes_id)) ? String(input.supersedes_id) : null
  };
}

async function audit(ctx: MemoryContext, action: string, recordId: string | null, metadata: Record<string, unknown>) {
  const { error } = await adminClient().from('audit_logs').insert({
    org_id: ctx.orgId,
    user_id: ctx.userId,
    action,
    table_name: 'atlas_memory_records',
    record_id: recordId,
    new_data: metadata
  });
  if (error) throw fail('audit_write_failed', 500);
}

async function listRecords(ctx: MemoryContext, url: URL) {
  const sb = adminClient();
  let query = sb
    .from('atlas_memory_records')
    .select('id,organization_id,created_by,approved_by,kind,status,title,summary,content_json,source_type,source_ref,module_ids,tags,sensitivity,version,supersedes_id,approved_at,created_at,updated_at')
    .eq('organization_id', ctx.orgId)
    .order('updated_at', { ascending: false })
    .limit(250);

  const kind = safeText(url.searchParams.get('kind'), 40);
  const status = safeText(url.searchParams.get('status'), 40);
  if (kind && KINDS.has(kind)) query = query.eq('kind', kind);
  if (status && ['draft','approved','superseded'].includes(status)) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) throw fail('memory_read_failed', 500);
  const q = safeText(url.searchParams.get('q'), 200).toLowerCase();
  const moduleId = safeText(url.searchParams.get('module'), 100);
  const records = (data || []).filter((row: any) => {
    const searchable = [row.title, row.summary, ...(row.tags || []), ...(row.module_ids || [])].join(' ').toLowerCase();
    const qMatches = !q || searchable.includes(q);
    const moduleMatches = !moduleId || (Array.isArray(row.module_ids) && row.module_ids.includes(moduleId));
    return qMatches && moduleMatches;
  });
  return json({ ok: true, organization_id: ctx.orgId, role: ctx.role, records }, 200, url.origin === 'null' ? null : null);
}

async function getRecord(ctx: MemoryContext, url: URL) {
  const id = safeText(url.searchParams.get('id'), 80);
  if (!uuid(id)) throw fail('memory_id_required', 422);
  const { data, error } = await adminClient()
    .from('atlas_memory_records')
    .select('*')
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw fail('memory_read_failed', 500);
  if (!data) throw fail('memory_not_found', 404);
  return data;
}

async function saveDraft(ctx: MemoryContext, input: Record<string, any>) {
  const normalized = normalizeDraft(input);
  const now = new Date().toISOString();
  const { data, error } = await adminClient()
    .from('atlas_memory_records')
    .insert({
      ...normalized,
      organization_id: ctx.orgId,
      created_by: ctx.userId,
      version: 1,
      created_at: now,
      updated_at: now
    })
    .select('*')
    .single();
  if (error) {
    if (String(error.code || '') === '23505') throw fail('memory_duplicate_source', 409);
    throw fail('memory_write_failed', 500);
  }
  await audit(ctx, 'knowledge.memory.created', String(data.id), {
    kind: data.kind,
    status: data.status,
    source_type: data.source_type,
    module_ids: data.module_ids,
    sensitivity: data.sensitivity
  });
  return data;
}

async function approve(ctx: MemoryContext, input: Record<string, any>) {
  if (!ADMIN_ROLES.has(ctx.role)) throw fail('memory_approval_role_required', 403);
  const id = safeText(input.id, 80);
  if (!uuid(id)) throw fail('memory_id_required', 422);
  const sb = adminClient();
  const { data: existing, error: existingError } = await sb
    .from('atlas_memory_records')
    .select('id,status,version,supersedes_id')
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .maybeSingle();
  if (existingError) throw fail('memory_read_failed', 500);
  if (!existing) throw fail('memory_not_found', 404);
  if (existing.status === 'approved') return existing;
  if (existing.status !== 'draft') throw fail('memory_not_approvable', 409);

  const now = new Date().toISOString();
  const { data, error } = await sb
    .from('atlas_memory_records')
    .update({
      status: 'approved',
      approved_by: ctx.userId,
      approved_at: now,
      updated_at: now,
      version: Number(existing.version || 1) + 1
    })
    .eq('organization_id', ctx.orgId)
    .eq('id', id)
    .eq('status', 'draft')
    .select('*')
    .single();
  if (error || !data) throw fail('memory_approval_failed', 500);

  if (data.supersedes_id) {
    await sb.from('atlas_memory_records')
      .update({ status: 'superseded', updated_at: now })
      .eq('organization_id', ctx.orgId)
      .eq('id', data.supersedes_id)
      .eq('status', 'approved');
  }

  await audit(ctx, 'knowledge.memory.approved', id, {
    kind: data.kind,
    source_type: data.source_type,
    supersedes_id: data.supersedes_id || null
  });
  return data;
}

async function importRecords(ctx: MemoryContext, input: Record<string, any>) {
  if (!ADMIN_ROLES.has(ctx.role)) throw fail('memory_import_role_required', 403);
  const rows = Array.isArray(input.records) ? input.records.slice(0, 50) : [];
  if (!rows.length) throw fail('memory_import_records_required', 422);
  const approveImported = input.approve === true;
  const results = [];
  for (const item of rows) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) throw fail('memory_import_record_invalid', 422);
    const created = await saveDraft(ctx, item as Record<string, any>);
    results.push(approveImported ? await approve(ctx, { id: created.id }) : created);
  }
  await audit(ctx, 'knowledge.memory.imported', null, {
    count: results.length,
    approved: approveImported
  });
  return results;
}

async function route(req: Request, origin: string | null) {
  const ctx = await context(req);
  const url = new URL(req.url);
  const api = safeText(url.searchParams.get('api') || 'list', 40);

  if (api === 'list' && req.method === 'GET') {
    const response = await listRecords(ctx, url);
    const payload = await response.json();
    return json(payload, response.status, origin);
  }
  if (api === 'record' && req.method === 'GET') return json({ ok: true, record: await getRecord(ctx, url) }, 200, origin);
  if (api === 'save' && req.method === 'POST') return json({ ok: true, record: await saveDraft(ctx, await body(req)) }, 201, origin);
  if (api === 'approve' && req.method === 'POST') return json({ ok: true, record: await approve(ctx, await body(req)) }, 200, origin);
  if (api === 'import' && req.method === 'POST') return json({ ok: true, records: await importRecords(ctx, await body(req)) }, 201, origin);
  if (api === 'readiness' && req.method === 'GET') {
    return json({
      ok: true,
      service: 'atlas-memory',
      version: VERSION,
      organization_id: ctx.orgId,
      role: ctx.role,
      durable: true,
      automatic_chat_ingestion: false,
      approval_required_for_truth: true,
      checked_at: new Date().toISOString()
    }, 200, origin);
  }
  throw fail('not_found', 404);
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(origin) });
  try {
    return await route(req, origin);
  } catch (error) {
    const e = error as { code?: string; status?: number; message?: string };
    return json({ ok: false, error: e.code || e.message || 'internal_error' }, e.status || 500, origin);
  }
});
