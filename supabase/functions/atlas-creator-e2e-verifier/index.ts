import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const URL = Deno.env.get('SUPABASE_URL') || '';
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') || '';
const CREATOR = `${URL}/functions/v1/atlas-creator`;
const EMAIL = 'atlas-creator-e2e@atlas.invalid';
const ORG_NAME = 'ATLAS Creator E2E';
const PURPOSE = 'creator-privileged-production-e2e';
const VERSION = 1;

function headers(extra: Record<string, string> = {}) {
  return {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    ...extra
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: headers({ 'content-type': 'application/json; charset=utf-8' })
  });
}

function fail(code: string, status = 500, detail = '') {
  return Object.assign(new Error(code), { code, status, detail });
}

function randomPassword() {
  const bytes = new Uint8Array(36);
  crypto.getRandomValues(bytes);
  return [...bytes].map(value => value.toString(16).padStart(2, '0')).join('');
}

async function parseJson(response: Response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text.slice(0, 500) };
  }
}

async function request(
  url: string,
  options: { method?: string; headers?: Record<string, string>; payload?: unknown } = {}
) {
  const requestHeaders = new Headers({ accept: 'application/json', ...(options.headers || {}) });
  let body: BodyInit | undefined;
  if (options.payload !== undefined) {
    requestHeaders.set('content-type', 'application/json');
    body = JSON.stringify(options.payload);
  }
  const response = await fetch(url, {
    method: options.method || 'GET',
    headers: requestHeaders,
    body,
    redirect: 'manual',
    cache: 'no-store'
  });
  return { response, payload: await parseJson(response) };
}

if (!URL || !SERVICE_ROLE || !ANON_KEY) throw new Error('creator_e2e_environment_missing');
const admin = createClient(URL, SERVICE_ROLE, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function authorize(req: Request) {
  const runtimeToken = String(req.headers.get('x-atlas-runtime-verifier-token') || '').trim();
  if (!runtimeToken) throw fail('authentication_failed', 401);
  const { data, error } = await admin.rpc('atlas_verify_runtime_invocation', { p_token: runtimeToken });
  if (error) throw fail('verification_unavailable', 503);
  if (data !== true) throw fail('permission_denied', 403);
}

async function prepareIdentity() {
  const password = randomPassword();
  const listed = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (listed.error) throw fail('auth_list_failed', 500);

  let user = listed.data.users.find(item => String(item.email || '').toLowerCase() === EMAIL);
  if (user) {
    const updated = await admin.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      user_metadata: { full_name: 'ATLAS Creator E2E', purpose: PURPOSE }
    });
    if (updated.error || !updated.data.user) throw fail('auth_update_failed', 500);
    user = updated.data.user;
  } else {
    const created = await admin.auth.admin.createUser({
      email: EMAIL,
      password,
      email_confirm: true,
      user_metadata: { full_name: 'ATLAS Creator E2E', purpose: PURPOSE }
    });
    if (created.error || !created.data.user) throw fail('auth_create_failed', 500);
    user = created.data.user;
  }

  const profile = await admin.from('profiles').upsert(
    { id: user.id, full_name: 'ATLAS Creator E2E' },
    { onConflict: 'id' }
  );
  if (profile.error) throw fail('profile_failed', 500);

  const lookup = await admin.from('organizations').select('id,created_by').eq('name', ORG_NAME).limit(1);
  if (lookup.error) throw fail('org_lookup_failed', 500);
  const existingOrg = lookup.data?.[0];
  let orgId = existingOrg?.id as string | undefined;
  if (!orgId) {
    const created = await admin.from('organizations').insert({
      name: ORG_NAME,
      legal_name: 'ATLAS Creator E2E LLC',
      industry: 'Quality Assurance / Creator Verification',
      active: true,
      created_by: user.id
    }).select('id').single();
    if (created.error || !created.data?.id) throw fail('org_create_failed', 500);
    orgId = String(created.data.id);
  } else {
    if (String(existingOrg?.created_by || '') !== user.id) {
      throw fail('synthetic_org_ownership_mismatch', 409);
    }
    const updated = await admin.from('organizations').update({ active: true }).eq('id', orgId);
    if (updated.error) throw fail('org_update_failed', 500);
  }

  const membership = await admin.from('organization_members').upsert(
    { org_id: orgId, user_id: user.id, role:'owner', status: 'active' },
    { onConflict: 'org_id,user_id' }
  );
  if (membership.error) throw fail('membership_failed', 500);

  const settings = await admin.from('organization_settings').upsert(
    { org_id: orgId, settings: { e2e: true, purpose: PURPOSE, external_generation: false } },
    { onConflict: 'org_id' }
  );
  if (settings.error) throw fail('settings_failed', 500);

  const verifiedMembership = await admin.from('organization_members')
    .select('role,status')
    .eq('org_id', orgId)
    .eq('user_id', user.id)
    .single();
  if (verifiedMembership.error || verifiedMembership.data?.role !== 'owner' || verifiedMembership.data?.status !== 'active') {
    throw fail('privileged_membership_failed', 500);
  }

  return { userId: user.id, orgId, password };
}

function emptyProduction(id: string, orgId: string, userId: string, now: string) {
  return {
    id,
    organizationId: orgId,
    createdByUserId: userId,
    title: `ATLAS Creator privileged E2E ${id.slice(0, 8)}`,
    brief: 'Non-generative production persistence verification.',
    status: 'draft',
    durationSeconds: 0,
    aspectRatio: 'adaptive',
    resolutionPreference: 'adaptive',
    audioEnabled: true,
    subjects: [],
    environment: {
      locationDescription: '', timeOfDay: '', lightingEnvironment: '', weatherOrAtmosphere: '',
      backgroundConstraints: [], referenceAssetIds: []
    },
    scenes: [],
    continuityRules: [],
    visualStyle: {
      photorealismLevel: '', cinematicStyle: '', textureStyle: '', colorPalette: '', contrastStyle: '',
      filmLook: '', grain: '', halation: '', surfaceDetail: '', lightingStyle: ''
    },
    cameraDefaults: {
      framing: '', angle: '', position: '', lens: '', focalLengthMm: null, depthOfField: '',
      movement: '', movementSpeed: '', focusTarget: '', orientationRule: ''
    },
    motionRules: [],
    audioPlan: {
      musicDescription: '', ambientSound: '', soundEffects: [], dialogue: [], voiceReferenceAssetIds: [], syncRules: []
    },
    negativeConstraints: [],
    providerPreference: null,
    providerOverrides: {},
    createdAt: now,
    updatedAt: now,
    version: 1
  };
}

async function runVerification() {
  let userId = '';
  let orgId = '';
  let accessToken = '';
  let productionId = '';
  let result: Record<string, unknown> = { ok: false, error: 'verification_not_started' };
  const cleanup = { production_deleted: false, membership_demoted: false, session_revoked: false };

  try {
    const identity = await prepareIdentity();
    userId = identity.userId;
    orgId = identity.orgId;

    const auth = await request(`${URL}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: ANON_KEY },
      payload: { email: EMAIL, password: identity.password }
    });
    accessToken = String(auth.payload?.access_token || '');
    if (auth.response.status !== 200 || accessToken.length < 40) throw fail('password_authentication_failed', 500);

    const authHeaders = {
      apikey: ANON_KEY,
      authorization: `Bearer ${accessToken}`,
      'x-atlas-org-id': orgId,
      'x-atlas-session-id': `creator-e2e-${crypto.randomUUID()}`
    };

    const readiness = await request(`${CREATOR}?api=readiness`, { headers: authHeaders });
    if (readiness.response.status !== 200 || readiness.payload?.ok !== true) throw fail('readiness_failed', 500);
    if (readiness.payload?.role !== 'owner') throw fail('owner_role_not_effective', 500);
    if (!Array.isArray(readiness.payload?.permissions) || !readiness.payload.permissions.includes('creator.write')) {
      throw fail('creator_write_not_effective', 500);
    }
    if (!(readiness.payload?.generation_enabled===false)) throw fail('generation_must_remain_disabled', 500);

    productionId = crypto.randomUUID();
    const now = new Date().toISOString();
    const spec = emptyProduction(productionId, orgId, userId, now);
    const saved = await request(`${CREATOR}?api=save`, {
      method: 'POST',
      headers: authHeaders,
      payload: { spec }
    });
    if (saved.response.status !== 200 || saved.payload?.production?.id !== productionId) {
      throw fail('save_failed', saved.response.status || 500);
    }
    if (saved.payload?.production?.organization_id !== orgId || saved.payload?.production?.created_by !== userId) {
      throw fail('server_identity_mismatch', 500);
    }

    const readBack = await request(`${CREATOR}?api=production&id=${encodeURIComponent(productionId)}`, {
      headers: authHeaders
    });
    if (readBack.response.status !== 200 || readBack.payload?.production?.id !== productionId) {
      throw fail('read_back_failed', readBack.response.status || 500);
    }

    const audit = await admin.from('audit_logs')
      .select('id')
      .eq('org_id', orgId)
      .eq('user_id', userId)
      .eq('action', 'creator.director.saved')
      .eq('record_id', productionId)
      .limit(1);
    if (audit.error || !audit.data?.length) throw fail('creator_audit_missing', 500);

    result = {
      ok: true,
      service: 'atlas-creator-e2e-verifier',
      version: VERSION,
      organization_id: orgId,
      role: readiness.payload.role,
      creator_write: true,
      generation_enabled: false,
      save_status: saved.response.status,
      read_status: readBack.response.status,
      audit_verified: true,
      production_id: productionId
    };
  } catch (error: any) {
    result = {
      ok: false,
      service: 'atlas-creator-e2e-verifier',
      version: VERSION,
      error: String(error?.code || 'verification_failed'),
      organization_id: orgId || null,
      production_id: productionId || null
    };
  } finally {
    if (orgId && productionId) {
      const deleted = await admin.from('creator_productions').delete()
        .eq('organization_id', orgId)
        .eq('id', productionId);
      cleanup.production_deleted = !deleted.error;
    } else {
      cleanup.production_deleted = true;
    }

    if (orgId && userId) {
      const demoted = await admin.from('organization_members').update({ role:'staff', status: 'active' })
        .eq('org_id', orgId)
        .eq('user_id', userId);
      cleanup.membership_demoted = !demoted.error;
    } else {
      cleanup.membership_demoted = true;
    }

    if (accessToken) {
      const logout = await request(`${URL}/auth/v1/logout?scope=global`, {
        method: 'POST',
        headers: { apikey: ANON_KEY, authorization: `Bearer ${accessToken}` }
      });
      cleanup.session_revoked = logout.response.status === 204 || logout.response.status === 200;
    } else {
      cleanup.session_revoked = true;
    }
  }

  const ok = result.ok === true
    && cleanup.production_deleted
    && cleanup.membership_demoted
    && cleanup.session_revoked;
  return { ...result, ok, cleanup };
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const api = String(url.searchParams.get('api') || '').trim();
  if (req.method === 'GET' && api === 'readiness') {
    return json({
      ok: true,
      service: 'atlas-creator-e2e-verifier',
      version: VERSION,
      auth: 'vault-backed-custom-token',
      target: 'atlas-creator',
      provider_calls: false
    });
  }
  if (req.method === 'POST' && api === 'verify') {
    try {
      await authorize(req);
      const verification = await runVerification();
      return json(verification, verification.ok ? 200 : 500);
    } catch (error: any) {
      return json({ ok: false, error: String(error?.code || 'verification_failed') }, Number(error?.status) || 500);
    }
  }
  return json({ ok: false, error: 'not_found' }, 404);
});
