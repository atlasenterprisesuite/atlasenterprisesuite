type SupabaseLike = any;

type BioScanDeps = {
  actor: (req: Request) => Promise<{ sb: SupabaseLike; user: { id: string } }>;
  permitted: (sb: SupabaseLike, orgId: string, permission: string) => Promise<boolean>;
  audit: (
    orgId: string | null,
    userId: string | null,
    action: string,
    table: string,
    recordId: string | null,
    payload?: Record<string, unknown>
  ) => Promise<void>;
  adminClient: () => SupabaseLike;
};

type BioScanContext = {
  sb: SupabaseLike;
  userId: string;
  orgId: string;
  role: string;
};

const BIOSCAN_ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

const BIOSCAN_TRANSITIONS: Record<string, readonly string[]> = {
  preparing: ['capturing', 'failed', 'cancelled'],
  capturing: ['processing', 'partial', 'failed', 'cancelled'],
  processing: ['complete', 'partial', 'failed', 'cancelled'],
  complete: [],
  partial: [],
  failed: [],
  cancelled: []
};

const BIOSCAN_ACTIVE_TRANSITION_STATES = ['capturing','processing','complete','partial'] as const;
const BIOSCAN_FINAL_STATES = ['complete', 'partial'] as const;
const BIOSCAN_MAX_JSON_BYTES = 32_768;

function bioscanCors(req: Request) {
  const origin = req.headers.get('origin');
  if (!origin || !BIOSCAN_ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

function bioscanJson(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
      ...bioscanCors(req)
    }
  });
}

function bioscanFail(req: Request, error: string, status = 400) {
  return bioscanJson(req, { ok: false, error }, status);
}

function bioscanClean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function bioscanUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function bioscanObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function bioscanPayloadSize(value: unknown) {
  try {
    return new TextEncoder().encode(JSON.stringify(value ?? {})).byteLength;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export function bioscanRejectRawCapturePayload(value: unknown): boolean {
  if (bioscanPayloadSize(value) > BIOSCAN_MAX_JSON_BYTES) return true;
  const forbiddenKey = /(raw[_-]?frame|frame[_-]?bytes|base64|photo|image|video|media[_-]?blob)/i;
  const forbiddenValue = /(data:image|data:video|video\/|image\/|base64,)/i;
  const visit = (candidate: unknown, depth: number): boolean => {
    if (depth > 8) return true;
    if (typeof candidate === 'string') {
      return candidate.length > 16_384 || forbiddenValue.test(candidate);
    }
    if (Array.isArray(candidate)) return candidate.some((item) => visit(item, depth + 1));
    if (!candidate || typeof candidate !== 'object') return false;
    return Object.entries(candidate as Record<string, unknown>).some(([key, item]) =>
      forbiddenKey.test(key) || visit(item, depth + 1)
    );
  };
  return visit(value, 0);
}

async function bioscanContext(req: Request, deps: BioScanDeps): Promise<BioScanContext> {
  const { sb, user } = await deps.actor(req);
  const requestedOrg = bioscanClean(req.headers.get('x-atlas-org-id'), 80);
  if (!requestedOrg || !bioscanUuid(requestedOrg)) throw new Error('invalid_organization');
  const { data, error } = await sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('org_id', requestedOrg)
    .eq('user_id', user.id)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !data) throw new Error('organization_membership_required');
  return { sb, userId: user.id, orgId: requestedOrg, role: String(data.role || 'member') };
}

async function bioscanPermission(ctx: BioScanContext, permission: string, deps: BioScanDeps) {
  if (!await deps.permitted(ctx.sb, ctx.orgId, permission)) throw new Error('permission_denied');
}

async function bioscanSubject(
  ctx: BioScanContext,
  requested: unknown,
  selfPermission: 'health.bioscan.read' | 'health.bioscan.capture',
  deps: BioScanDeps
) {
  const subject = bioscanClean(requested, 80) || ctx.userId;
  if (!bioscanUuid(subject)) throw new Error('invalid_subject_user_id');
  if (subject !== ctx.userId) {
    if (!await deps.permitted(ctx.sb, ctx.orgId, 'health.bioscan.manage')) {
      throw new Error('cross_subject_permission_required');
    }
    return subject;
  }
  await bioscanPermission(ctx, selfPermission, deps);
  return subject;
}

async function bioscanAudit(
  ctx: BioScanContext,
  deps: BioScanDeps,
  action: string,
  table: string,
  recordId: string | null,
  payload: Record<string, unknown> = {}
) {
  await deps.audit(ctx.orgId, ctx.userId, action, table, recordId, payload);
}

async function bioscanActiveConsent(ctx: BioScanContext, subjectUserId: string, deps: BioScanDeps) {
  const { data, error } = await deps.adminClient()
    .from('bioscan_consents')
    .select('id,status,scope,granted_at,expires_at')
    .eq('org_id', ctx.orgId)
    .eq('subject_user_id', subjectUserId)
    .eq('scope', 'body_scan')
    .eq('status', 'granted')
    .order('granted_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error('bioscan_consent_read_failed');
  if (!data) return null;
  if (data.expires_at && Date.parse(String(data.expires_at)) <= Date.now()) return null;
  return data;
}

async function bioscanRequireActiveConsent(ctx: BioScanContext, subjectUserId: string, deps: BioScanDeps) {
  const consent = await bioscanActiveConsent(ctx, subjectUserId, deps);
  if (!consent) throw new Error('bioscan_active_consent_required');
  return consent;
}

async function bioscanCapabilities(req: Request, ctx: BioScanContext, deps: BioScanDeps) {
  const [canRead, canCapture, canManage, canAudit] = await Promise.all([
    deps.permitted(ctx.sb, ctx.orgId, 'health.bioscan.read'),
    deps.permitted(ctx.sb, ctx.orgId, 'health.bioscan.capture'),
    deps.permitted(ctx.sb, ctx.orgId, 'health.bioscan.manage'),
    deps.permitted(ctx.sb, ctx.orgId, 'health.bioscan.audit')
  ]);
  return bioscanJson(req, {
    ok: true,
    api_version: 1,
    domain: 'bioscan',
    role: ctx.role,
    permissions: { read: canRead, capture: canCapture, manage: canManage, audit: canAudit },
    capture_modes: { camera: true, camera_depth: false, lidar: false },
    raw_frame_persistence: false,
    truth_rule: 'NO DATA -> NO CLAIM'
  });
}

async function bioscanConsentGrant(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  const subjectUserId = await bioscanSubject(ctx, body.subject_user_id, 'health.bioscan.capture', deps);
  const current = await bioscanActiveConsent(ctx, subjectUserId, deps);
  if (current) return bioscanJson(req, { ok: true, consent: current, idempotent: true });
  const now = new Date().toISOString();
  const expiresAt = body.expires_at ? new Date(String(body.expires_at)).toISOString() : null;
  const { data, error } = await deps.adminClient()
    .from('bioscan_consents')
    .insert({
      tenant_id: ctx.orgId,
      org_id: ctx.orgId,
      subject_user_id: subjectUserId,
      scope: 'body_scan',
      status: 'granted',
      granted_at: now,
      expires_at: expiresAt,
      policy_version: bioscanClean(body.policy_version, 120) || 'bioscan-consent-v1',
      created_by: ctx.userId
    })
    .select('id,subject_user_id,scope,status,granted_at,expires_at,policy_version')
    .single();
  if (error || !data) throw new Error('bioscan_consent_create_failed');
  await bioscanAudit(ctx, deps, 'bioscan.consent.granted', 'bioscan_consents', data.id, {
    subject_user_id: subjectUserId,
    scope: 'body_scan',
    policy_version: data.policy_version
  });
  return bioscanJson(req, { ok: true, consent: data, idempotent: false }, 201);
}

async function bioscanConsentRevoke(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  const subjectUserId = await bioscanSubject(ctx, body.subject_user_id, 'health.bioscan.capture', deps);
  const current = await bioscanActiveConsent(ctx, subjectUserId, deps);
  if (!current) return bioscanJson(req, { ok: true, consent: null, idempotent: true });
  const revokedAt = new Date().toISOString();
  const { data, error } = await deps.adminClient()
    .from('bioscan_consents')
    .update({ status: 'revoked', revoked_at: revokedAt })
    .eq('id', current.id)
    .eq('org_id', ctx.orgId)
    .eq('subject_user_id', subjectUserId)
    .select('id,subject_user_id,scope,status,granted_at,revoked_at,expires_at,policy_version')
    .single();
  if (error || !data) throw new Error('bioscan_consent_revoke_failed');
  await bioscanAudit(ctx, deps, 'bioscan.consent.revoked', 'bioscan_consents', data.id, {
    subject_user_id: subjectUserId,
    scope: 'body_scan'
  });
  return bioscanJson(req, { ok: true, consent: data, idempotent: false });
}

async function bioscanSessionCreate(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  const subjectUserId = await bioscanSubject(ctx, body.subject_user_id, 'health.bioscan.capture', deps);
  const captureMode = bioscanClean(body.capture_mode, 40) || 'camera';
  if (captureMode !== 'camera') return bioscanFail(req, 'capture_mode_not_available', 409);
  if (bioscanRejectRawCapturePayload(body)) return bioscanFail(req, 'raw_capture_payload_rejected', 413);
  const idempotencyKey = bioscanClean(body.idempotency_key, 160) || null;
  const admin = deps.adminClient();
  if (idempotencyKey) {
    const { data: existing } = await admin.from('bioscan_sessions')
      .select('id,org_id,subject_user_id,consent_record_id,started_at,completed_at,status,capture_mode,device_id,quality_score,coverage_score,failure_reason')
      .eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId).eq('idempotency_key', idempotencyKey).maybeSingle();
    if (existing) return bioscanJson(req, { ok: true, session: existing, idempotent: true });
  }
  const consent = await bioscanRequireActiveConsent(ctx, subjectUserId, deps);
  const { data, error } = await admin.from('bioscan_sessions')
    .insert({
      tenant_id: ctx.orgId,
      org_id: ctx.orgId,
      subject_user_id: subjectUserId,
      consent_record_id: consent.id,
      status: 'preparing',
      capture_mode: 'camera',
      device_id: bioscanClean(body.device_id, 240) || null,
      idempotency_key: idempotencyKey,
      created_by: ctx.userId
    })
    .select('id,org_id,subject_user_id,consent_record_id,started_at,completed_at,status,capture_mode,device_id,quality_score,coverage_score,failure_reason')
    .single();
  if (error || !data) throw new Error('bioscan_session_create_failed');
  await bioscanAudit(ctx, deps, 'bioscan.session.started', 'bioscan_sessions', data.id, {
    subject_user_id: subjectUserId,
    capture_mode: 'camera'
  });
  return bioscanJson(req, { ok: true, session: data, idempotent: false }, 201);
}

async function bioscanSessionTransition(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  await bioscanPermission(ctx, 'health.bioscan.capture', deps);
  const sessionId = bioscanClean(body.session_id, 80);
  const target = bioscanClean(body.status, 40);
  if (!bioscanUuid(sessionId)) return bioscanFail(req, 'invalid_session_id', 422);
  const admin = deps.adminClient();
  const { data: current, error: currentError } = await admin.from('bioscan_sessions')
    .select('id,org_id,subject_user_id,consent_record_id,started_at,completed_at,status,capture_mode,device_id,quality_score,coverage_score,failure_reason')
    .eq('id', sessionId).eq('org_id', ctx.orgId).maybeSingle();
  if (currentError || !current) return bioscanFail(req, 'bioscan_session_not_found', 404);
  await bioscanSubject(ctx, current.subject_user_id, 'health.bioscan.capture', deps);
  if (current.status === target) {
    return bioscanJson(req, { ok: true, session: current, idempotent: true });
  }
  const allowed = BIOSCAN_TRANSITIONS[String(current.status)] || [];
  if (!allowed.includes(target)) return bioscanFail(req, 'bioscan_invalid_transition', 409);
  if (BIOSCAN_ACTIVE_TRANSITION_STATES.includes(target as typeof BIOSCAN_ACTIVE_TRANSITION_STATES[number])) {
    await bioscanRequireActiveConsent(ctx, current.subject_user_id, deps);
  }
  const patch: Record<string, unknown> = { status: target };
  if (['complete', 'partial', 'failed', 'cancelled'].includes(target)) patch.completed_at = new Date().toISOString();
  if (target === 'failed') patch.failure_reason = bioscanClean(body.failure_reason, 500) || 'capture_failed';
  const { data, error } = await admin.from('bioscan_sessions')
    .update(patch).eq('id', current.id).eq('org_id', ctx.orgId)
    .select('id,org_id,subject_user_id,consent_record_id,started_at,completed_at,status,capture_mode,device_id,quality_score,coverage_score,failure_reason')
    .single();
  if (error || !data) throw new Error('bioscan_session_transition_failed');
  if (target === 'complete' || target === 'partial') {
    await bioscanAudit(ctx, deps, 'bioscan.session.completed', 'bioscan_sessions', data.id, {
      subject_user_id: data.subject_user_id,
      result: target
    });
  } else if (target === 'failed') {
    await bioscanAudit(ctx, deps, 'bioscan.session.failed', 'bioscan_sessions', data.id, {
      subject_user_id: data.subject_user_id,
      failure_reason: data.failure_reason
    });
  }
  return bioscanJson(req, { ok: true, session: data, idempotent: false });
}

async function bioscanSnapshotCreate(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  await bioscanPermission(ctx, 'health.bioscan.capture', deps);
  if (bioscanRejectRawCapturePayload(body)) return bioscanFail(req, 'raw_capture_payload_rejected', 413);
  const sessionId = bioscanClean(body.session_id, 80);
  const idempotencyKey = bioscanClean(body.idempotency_key, 160);
  if (!bioscanUuid(sessionId)) return bioscanFail(req, 'invalid_session_id', 422);
  if (!idempotencyKey) return bioscanFail(req, 'idempotency_key_required', 422);
  if (body.mesh_ref) return bioscanFail(req, 'mesh_ref_not_supported_phase1', 409);
  const admin = deps.adminClient();
  const { data: session } = await admin.from('bioscan_sessions')
    .select('id,subject_user_id,status,capture_mode,started_at,completed_at')
    .eq('id', sessionId).eq('org_id', ctx.orgId).maybeSingle();
  if (!session) return bioscanFail(req, 'bioscan_session_not_found', 404);
  await bioscanSubject(ctx, session.subject_user_id, 'health.bioscan.capture', deps);
  if (!['complete','partial'].includes(session.status)) return bioscanFail(req, 'bioscan_snapshot_session_not_final', 409);
  const { data: existing } = await admin.from('human_twin_snapshots')
    .select('id,org_id,subject_user_id,bioscan_session_id,captured_at,geometry_version,coordinate_system,mesh_ref,confidence_summary,source_summary')
    .eq('org_id', ctx.orgId)
    .or(`bioscan_session_id.eq.${sessionId},idempotency_key.eq.${idempotencyKey}`)
    .limit(1)
    .maybeSingle();
  if (existing) return bioscanJson(req, { ok: true, snapshot: existing, idempotent: true });
  const geometryVersion = bioscanClean(body.geometry_version, 120) || 'camera-metadata-v1';
  const coordinateSystem = bioscanClean(body.coordinate_system, 120) || 'screen-normalized';
  const confidenceSummary = bioscanObject(body.confidence_summary);
  const sourceSummary = {
    ...bioscanObject(body.source_summary),
    capture_mode: session.capture_mode,
    raw_frame_persisted: false
  };
  const { data, error } = await admin.from('human_twin_snapshots')
    .insert({
      tenant_id: ctx.orgId,
      org_id: ctx.orgId,
      subject_user_id: session.subject_user_id,
      bioscan_session_id: sessionId,
      captured_at: session.completed_at || new Date().toISOString(),
      geometry_version: geometryVersion,
      coordinate_system: coordinateSystem,
      mesh_ref: null,
      confidence_summary: confidenceSummary,
      source_summary: sourceSummary,
      idempotency_key: idempotencyKey
    })
    .select('id,org_id,subject_user_id,bioscan_session_id,captured_at,geometry_version,coordinate_system,mesh_ref,confidence_summary,source_summary')
    .single();
  if (error || !data) throw new Error('bioscan_snapshot_create_failed');
  await bioscanAudit(ctx, deps, 'bioscan.snapshot.created', 'human_twin_snapshots', data.id, {
    subject_user_id: data.subject_user_id,
    bioscan_session_id: sessionId,
    capture_mode: session.capture_mode
  });
  return bioscanJson(req, { ok: true, snapshot: data, idempotent: false }, 201);
}

async function bioscanSnapshotRead(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  await bioscanPermission(ctx, 'health.bioscan.read', deps);
  const snapshotId = bioscanClean(body.snapshot_id, 80);
  if (!bioscanUuid(snapshotId)) return bioscanFail(req, 'invalid_snapshot_id', 422);
  const { data, error } = await deps.adminClient().from('human_twin_snapshots')
    .select('id,org_id,subject_user_id,bioscan_session_id,captured_at,geometry_version,coordinate_system,mesh_ref,confidence_summary,source_summary')
    .eq('id', snapshotId).eq('org_id', ctx.orgId).maybeSingle();
  if (error || !data) return bioscanFail(req, 'bioscan_snapshot_not_found', 404);
  await bioscanSubject(ctx, data.subject_user_id, 'health.bioscan.read', deps);
  await bioscanAudit(ctx, deps, 'bioscan.snapshot.viewed', 'human_twin_snapshots', data.id, {
    subject_user_id: data.subject_user_id
  });
  return bioscanJson(req, { ok: true, snapshot: data });
}

async function bioscanTimeline(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  const subjectUserId = await bioscanSubject(ctx, body.subject_user_id, 'health.bioscan.read', deps);
  const requestedLimit = Number(body.limit || 50);
  const limit = Number.isFinite(requestedLimit) ? Math.max(1, Math.min(100, Math.floor(requestedLimit))) : 50;
  const { data, error } = await deps.adminClient().from('human_twin_snapshots')
    .select('id,org_id,subject_user_id,bioscan_session_id,captured_at,geometry_version,coordinate_system,mesh_ref,confidence_summary,source_summary')
    .eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId)
    .order('captured_at', { ascending: false }).limit(limit);
  if (error) throw new Error('bioscan_timeline_read_failed');
  return bioscanJson(req, { ok: true, snapshots: data || [] });
}

async function bioscanExport(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  const subjectUserId = await bioscanSubject(ctx, body.subject_user_id, 'health.bioscan.read', deps);
  const admin = deps.adminClient();
  const [sessions, snapshots, measurements, posture, sensors] = await Promise.all([
    admin.from('bioscan_sessions').select('id,subject_user_id,started_at,completed_at,status,capture_mode,device_id,quality_score,coverage_score,failure_reason').eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId).order('started_at', { ascending: false }),
    admin.from('human_twin_snapshots').select('id,bioscan_session_id,captured_at,geometry_version,coordinate_system,mesh_ref,confidence_summary,source_summary').eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId).order('captured_at', { ascending: false }),
    admin.from('body_measurements').select('id,snapshot_id,metric_key,value,unit,source_type,source_ref,confidence,measured_at,is_estimate,method_version').eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId),
    admin.from('posture_observations').select('id,snapshot_id,observation_key,value,unit,source_type,source_ref,confidence,measured_at,is_estimate,method_version').eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId),
    admin.from('sensor_observations').select('id,metric_key,value,unit,source_type,source_ref,confidence,measured_at,is_estimate,method_version').eq('org_id', ctx.orgId).eq('subject_user_id', subjectUserId)
  ]);
  const failure = [sessions, snapshots, measurements, posture, sensors].find((result) => result.error);
  if (failure?.error) throw new Error('bioscan_export_failed');
  await bioscanAudit(ctx, deps, 'bioscan.data.exported', 'bioscan_sessions', null, {
    subject_user_id: subjectUserId,
    session_count: sessions.data?.length || 0,
    snapshot_count: snapshots.data?.length || 0
  });
  return bioscanJson(req, {
    ok: true,
    exported_at: new Date().toISOString(),
    subject_user_id: subjectUserId,
    sessions: sessions.data || [],
    snapshots: snapshots.data || [],
    measurements: measurements.data || [],
    posture_observations: posture.data || [],
    sensor_observations: sensors.data || []
  });
}

async function bioscanDeleteSubject(req: Request, ctx: BioScanContext, body: any, deps: BioScanDeps) {
  const subjectUserId = await bioscanSubject(ctx, body.subject_user_id, 'health.bioscan.capture', deps);
  if (body.confirmation !== 'DELETE_BIOSCAN_DATA') return bioscanFail(req, 'delete_confirmation_required', 422);
  const { data: deletedCounts, error } = await deps.adminClient()
    .rpc('atlas_bioscan_delete_subject_data', { p_org_id: ctx.orgId, p_subject_user_id: subjectUserId });
  if (error) throw new Error('bioscan_delete_failed');
  await bioscanAudit(ctx, deps, 'bioscan.data.deleted', 'bioscan_sessions', null, {
    subject_user_id: subjectUserId,
    deleted_counts: deletedCounts || {}
  });
  return bioscanJson(req, { ok: true, subject_user_id: subjectUserId, deleted_counts: deletedCounts || {} });
}

export async function handleBioScan(req: Request, api: string, deps: BioScanDeps) {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: bioscanCors(req) });
  try {
    const ctx = await bioscanContext(req, deps);
    if (req.method === 'GET' && api === 'bioscan-v1-capabilities') return await bioscanCapabilities(req, ctx, deps);
    if (req.method !== 'POST') return bioscanFail(req, 'method_not_allowed', 405);
    let body: any = {};
    try { body = await req.json(); } catch { return bioscanFail(req, 'invalid_json', 400); }
    if (bioscanRejectRawCapturePayload(body)) return bioscanFail(req, 'raw_capture_payload_rejected', 413);
    if (api === 'bioscan-v1-consent-grant') return await bioscanConsentGrant(req, ctx, body, deps);
    if (api === 'bioscan-v1-consent-revoke') return await bioscanConsentRevoke(req, ctx, body, deps);
    if (api === 'bioscan-v1-session-create') return await bioscanSessionCreate(req, ctx, body, deps);
    if (api === 'bioscan-v1-session-transition') return await bioscanSessionTransition(req, ctx, body, deps);
    if (api === 'bioscan-v1-snapshot-create') return await bioscanSnapshotCreate(req, ctx, body, deps);
    if (api === 'bioscan-v1-snapshot-read') return await bioscanSnapshotRead(req, ctx, body, deps);
    if (api === 'bioscan-v1-timeline') return await bioscanTimeline(req, ctx, body, deps);
    if (api === 'bioscan-v1-export') return await bioscanExport(req, ctx, body, deps);
    if (api === 'bioscan-v1-delete-subject') return await bioscanDeleteSubject(req, ctx, body, deps);
    return bioscanFail(req, 'not_found', 404);
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'internal_error';
    const status = message.includes('auth') || message.includes('session') ? 401
      : message.includes('permission') || message.includes('membership') || message.includes('cross_subject') ? 403
      : message.endsWith('_not_found') ? 404
      : message.includes('consent') || message.includes('transition') || message.includes('not_final') ? 409
      : message.startsWith('invalid_') || message.endsWith('_required') ? 422
      : 500;
    return bioscanFail(req, message, status);
  }
}
