import { createClient } from 'npm:@supabase/supabase-js@2.95.0';
import { createGitHubOidcScope } from '../_shared/github-oidc-scope.ts';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY = Deno.env.get('SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_PUBLISHABLE_KEY') || '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const MAX_REQUEST_BYTES = 64 * 1024;
const SESSION_MINUTES = 60;
const ROTATE_BEFORE_MINUTES = 15;
const REMOTE_SESSION_MINUTES = 30;
const REMOTE_VIEWER_TICKET_SECONDS = 90;
const MTLS_FINGERPRINT = /^[a-f0-9]{64}$/;
const GITHUB_SCOPE = createGitHubOidcScope(['local-agent-mtls.yml']);
const GITHUB_REPO = GITHUB_SCOPE.canonicalRepository;
const MTLS_PROVISION_AUDIENCE = 'atlas-local-agent-mtls-provision';
const MTLS_PROVISION_WORKFLOWS = GITHUB_SCOPE.workflowRefs;
const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);
const SENSITIVE_KEY = /token|secret|password|cookie|authorization|credential|private.?key|enrollment/i;

type JsonObject = Record<string, unknown>;
type UserContext = { userId: string; orgId: string; role: string; permissions: string[] };
type AgentContext = { agent: any; session: any };

class EdgeError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
  }
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-request-id, x-atlas-agent-token',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function requiredText(value: unknown, code: string, max = 500) {
  const result = clean(value, max);
  if (!result) throw new EdgeError(code, 422);
  return result;
}

function record(value: unknown): JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as JsonObject : {};
}

function stringArray(value: unknown, maxItems = 50, maxLength = 120) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => clean(item, maxLength)).filter(Boolean))].slice(0, maxItems);
}

function containsSensitiveKey(value: unknown, depth = 0): boolean {
  if (depth > 6 || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => containsSensitiveKey(item, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value as JsonObject).some(([key, nested]) =>
    SENSITIVE_KEY.test(key) || containsSensitiveKey(nested, depth + 1)
  );
}

function safeActionPayload(value: unknown) {
  const payload = record(value);
  if (containsSensitiveKey(payload)) throw new EdgeError('sensitive_command_payload_rejected', 422);
  if (new TextEncoder().encode(JSON.stringify(payload)).byteLength > 8192) {
    throw new EdgeError('command_payload_too_large', 422);
  }
  return payload;
}

const DEVICE_DNA_FORBIDDEN_KEY = /^(serial(_number)?|product_uuid|uuid|mac(_address)?|ip(_address)?|hostname|username|mountpoint|mount_path)$/i;

function containsDeviceDnaIdentityKey(value: unknown, depth = 0): boolean {
  if (depth > 8 || value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.some((item) => containsDeviceDnaIdentityKey(item, depth + 1));
  if (typeof value !== 'object') return false;
  return Object.entries(value as JsonObject).some(([key, nested]) =>
    DEVICE_DNA_FORBIDDEN_KEY.test(key) || containsDeviceDnaIdentityKey(nested, depth + 1)
  );
}

async function validateDeviceDnaMetadata(metadata: JsonObject, agentPlatform: string, capabilities: string[]) {
  if (!agentPlatform.toLowerCase().startsWith('linux')) {
    throw new EdgeError('device_dna_linux_agent_required', 422);
  }
  if (!capabilities.includes('device.dna.read')) {
    throw new EdgeError('device_dna_capability_required', 422);
  }
  if (containsDeviceDnaIdentityKey(metadata)) {
    throw new EdgeError('device_dna_identity_metadata_rejected', 422);
  }

  const report = record(metadata.device_dna);
  if (report.schema_version !== 'atlas.device-dna.v1') {
    throw new EdgeError('device_dna_schema_invalid', 422);
  }
  if (report.evidence_level !== 'agent-observed') {
    throw new EdgeError('device_dna_evidence_level_invalid', 422);
  }

  const integrity = record(report.integrity);
  if (integrity.hardware_attested !== false) {
    throw new EdgeError('device_dna_hardware_attestation_not_supported', 422);
  }
  const digest = clean(integrity.content_digest_sha256, 64).toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(digest)) {
    throw new EdgeError('device_dna_digest_invalid', 422);
  }

  const unsigned = { ...report };
  delete unsigned.integrity;
  const expectedDigest = await sha256(JSON.stringify(sortApprovalValue(unsigned)));
  if (digest !== expectedDigest) {
    throw new EdgeError('device_dna_digest_mismatch', 422);
  }

  const compute = record(report.compute);
  const memoryGb = Number(compute.memory_gb);
  const logicalCores = Number(compute.logical_cores);
  if (!Number.isFinite(memoryGb) || memoryGb <= 0 || memoryGb > 4096) {
    throw new EdgeError('device_dna_memory_invalid', 422);
  }
  if (!Number.isInteger(logicalCores) || logicalCores < 1 || logicalCores > 1024) {
    throw new EdgeError('device_dna_cpu_invalid', 422);
  }

  const firmware = record(report.firmware);
  if (!['uefi', 'legacy-or-unknown'].includes(clean(firmware.boot_mode, 40))) {
    throw new EdgeError('device_dna_boot_mode_invalid', 422);
  }
  if (!['enabled', 'disabled', 'unknown'].includes(clean(firmware.secure_boot, 40))) {
    throw new EdgeError('device_dna_secure_boot_invalid', 422);
  }

  const storage = record(report.storage);
  if (!Array.isArray(storage.disks) || storage.disks.length > 16) {
    throw new EdgeError('device_dna_storage_invalid', 422);
  }
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new EdgeError('server_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}

function userClient(req: Request) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new EdgeError('supabase_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

function permissionsForRole(role: string) {
  return ['owner', 'admin'].includes(role)
    ? ['device.agent.read', 'device.agent.use', 'device.agent.admin']
    : [];
}

async function resolveUser(req: Request, requestedOrgId: string): Promise<UserContext> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new EdgeError('authentication_required', 401);
  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new EdgeError('invalid_session', 401);
  const { data: membership, error } = await sb.from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('org_id', requestedOrgId)
    .eq('status', 'active')
    .maybeSingle();
  if (error || !membership?.org_id) throw new EdgeError('membership_required', 403);
  const role = String(membership.role || 'member');
  return { userId: authData.user.id, orgId: String(membership.org_id), role, permissions: permissionsForRole(role) };
}

function requirePermission(context: UserContext, permission: string) {
  if (!context.permissions.includes(permission) && !context.permissions.includes('device.agent.admin')) {
    throw new EdgeError('permission_required', 403);
  }
}

function b64u(input: string) {
  let value = input.replace(/-/g, '+').replace(/_/g, '/');
  while (value.length % 4) value += '=';
  return Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
}

function decodeJwtPart(input: string) {
  return JSON.parse(new TextDecoder().decode(b64u(input))) as Record<string, unknown>;
}

let githubJwksCache: { until: number; keys: Array<JsonWebKey & { kid?: string }> } | null = null;

async function githubJwks() {
  if (githubJwksCache && githubJwksCache.until > Date.now()) return githubJwksCache.keys;
  const config = await fetch(
    'https://token.actions.githubusercontent.com/.well-known/openid-configuration',
    { cache: 'no-store' }
  ).then((response) => response.json());
  const data = await fetch(config.jwks_uri, { cache: 'no-store' }).then((response) => response.json());
  const keys = Array.isArray(data?.keys) ? data.keys : [];
  githubJwksCache = { until: Date.now() + 10 * 60 * 1000, keys };
  return keys;
}

async function verifyMtlsProvisionOidc(req: Request) {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const parts = token.split('.');
  if (parts.length !== 3) throw new EdgeError('github_oidc_required', 401);

  let header: Record<string, unknown>;
  let payload: Record<string, unknown>;
  try {
    header = decodeJwtPart(parts[0]);
    payload = decodeJwtPart(parts[1]);
  } catch {
    throw new EdgeError('invalid_github_oidc', 401);
  }

  if (header.alg !== 'RS256' || !header.kid) throw new EdgeError('unsupported_github_oidc', 401);
  const jwk = (await githubJwks()).find((candidate) => candidate.kid === header.kid);
  if (!jwk) throw new EdgeError('github_oidc_key_not_found', 401);

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
  const workflowRef = String(payload.workflow_ref || '');
  const jobWorkflowRef = String(payload.job_workflow_ref || '');
  if (
    !signatureOk ||
    payload.iss !== 'https://token.actions.githubusercontent.com' ||
    !audiences.includes(MTLS_PROVISION_AUDIENCE) ||
    Number(payload.exp || 0) <= now ||
    Number(payload.nbf || 0) > now + 30
  ) throw new EdgeError('github_oidc_verification_failed', 401);

  if (
    !GITHUB_SCOPE.allowsRepository(payload.repository, payload.repository_owner) ||
    payload.ref !== 'refs/heads/main' ||
    (!MTLS_PROVISION_WORKFLOWS.has(workflowRef) && !MTLS_PROVISION_WORKFLOWS.has(jobWorkflowRef))
  ) throw new EdgeError('github_oidc_scope_denied', 403);

  return { sha: String(payload.sha || ''), runId: String(payload.run_id || '') };
}

async function mtlsProvisionCallback(req: Request) {
  const github = await verifyMtlsProvisionOidc(req);
  const body = record(await req.json());
  const action = requiredText(body.action, 'mtls_action_required', 20);
  const orgId = requiredText(body.organization_id, 'organization_id_required', 80);
  const agentId = requiredText(body.agent_id, 'agent_id_required', 80);
  const admin = adminClient();
  const now = new Date().toISOString();

  if (action === 'issue') {
    const fingerprint = requiredText(body.fingerprint_sha256, 'mtls_fingerprint_required', 64).toLowerCase();
    const serial = requiredText(body.serial, 'mtls_serial_required', 160);
    const certificateId = requiredText(body.certificate_id, 'mtls_certificate_id_required', 80);
    const expiresAt = new Date(requiredText(body.expires_at, 'mtls_expiry_required', 80));
    if (!MTLS_FINGERPRINT.test(fingerprint)) throw new EdgeError('invalid_mtls_fingerprint', 422);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) throw new EdgeError('invalid_mtls_expiry', 422);

    const { data: agent, error } = await admin.from('atlas_local_agents').update({
      mtls_status: 'active',
      mtls_cert_fingerprint_sha256: fingerprint,
      mtls_cert_serial: serial,
      mtls_cloudflare_cert_id: certificateId,
      mtls_cert_expires_at: expiresAt.toISOString(),
      updated_at: now
    }).eq('id', agentId).eq('org_id', orgId).neq('status', 'revoked')
      .select('id,org_id,mtls_status,mtls_cert_fingerprint_sha256,mtls_cert_serial,mtls_cloudflare_cert_id,mtls_cert_expires_at').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!agent) throw new EdgeError('agent_not_found', 404);
    await appendEvent(admin, {
      orgId, agentId, eventType: 'agent.mtls.provider_issued', success: true,
      safeDetail: { certificate_id: certificateId, fingerprint_sha256: fingerprint, serial, expires_at: expiresAt.toISOString(), github_run_id: github.runId }
    });
    return json(req, { ok: true, agent });
  }

  if (action === 'revoke') {
    const certificateId = requiredText(body.certificate_id, 'mtls_certificate_id_required', 80);
    const { data: agent, error } = await admin.from('atlas_local_agents').update({
      mtls_status: 'revoked',
      realtime_last_connected_at: null,
      updated_at: now
    }).eq('id', agentId).eq('org_id', orgId).eq('mtls_cloudflare_cert_id', certificateId)
      .select('id,org_id,mtls_status').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!agent) throw new EdgeError('agent_certificate_binding_not_found', 404);
    await appendEvent(admin, {
      orgId, agentId, eventType: 'agent.mtls.provider_revoked', severity: 'warning', success: true,
      safeDetail: { certificate_id: certificateId, github_run_id: github.runId }
    });
    return json(req, { ok: true, agent });
  }

  throw new EdgeError('unsupported_mtls_action', 422);
}

function bytesToBase64Url(bytes: Uint8Array) {
  let raw = '';
  for (const byte of bytes) raw += String.fromCharCode(byte);
  return btoa(raw).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function randomSecret(bytes = 32) {
  const buffer = new Uint8Array(bytes);
  crypto.getRandomValues(buffer);
  return bytesToBase64Url(buffer);
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}


function sortApprovalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortApprovalValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([a],[b]) => a.localeCompare(b))
        .map(([key,item]) => [key, sortApprovalValue(item)])
    );
  }
  return value;
}

async function digestApprovalPayload(value: unknown) {
  return sha256(JSON.stringify(sortApprovalValue(value)));
}

async function appendEvent(admin: ReturnType<typeof createClient>, input: {
  orgId: string; agentId?: string | null; deviceId?: string | null; commandId?: string | null;
  eventType: string; severity?: string; success?: boolean | null; safeDetail?: JsonObject;
}) {
  const safeDetail = record(input.safeDetail);
  if (containsSensitiveKey(safeDetail)) throw new EdgeError('sensitive_event_detail_rejected', 422);
  const { error } = await admin.from('atlas_local_device_events').insert({
    org_id: input.orgId,
    agent_id: input.agentId || null,
    device_id: input.deviceId || null,
    command_id: input.commandId || null,
    event_type: requiredText(input.eventType, 'event_type_required', 120),
    severity: ['info', 'warning', 'error', 'critical'].includes(String(input.severity)) ? input.severity : 'info',
    success: input.success ?? null,
    safe_detail: safeDetail
  });
  if (error) throw new EdgeError('event_persistence_failed', 500);
}

async function issueAgentSession(admin: ReturnType<typeof createClient>, orgId: string, agentId: string) {
  const sessionToken = randomSecret(32);
  const tokenHash = await sha256(sessionToken);
  const expiresAt = new Date(Date.now() + SESSION_MINUTES * 60_000).toISOString();
  const { data, error } = await admin.from('atlas_local_agent_sessions').insert({
    org_id: orgId, agent_id: agentId, token_hash: tokenHash, expires_at: expiresAt
  }).select('id,expires_at').single();
  if (error || !data) throw new EdgeError('session_issue_failed', 500);
  return { sessionToken, sessionId: String(data.id), expiresAt: String(data.expires_at) };
}

async function resolveAgent(req: Request): Promise<AgentContext> {
  const token = clean(req.headers.get('x-atlas-agent-token'), 500);
  if (!token) throw new EdgeError('agent_authentication_required', 401);
  const tokenHash = await sha256(token);
  const admin = adminClient();
  const { data: session, error } = await admin.from('atlas_local_agent_sessions')
    .select('id,org_id,agent_id,expires_at,revoked_at,last_seen_at')
    .eq('token_hash', tokenHash)
    .is('revoked_at', null)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (error) throw new EdgeError('agent_session_lookup_failed', 500);
  if (!session) throw new EdgeError('invalid_or_expired_agent_session', 401);
  const { data: agent, error: agentError } = await admin.from('atlas_local_agents')
    .select('*').eq('id', session.agent_id).eq('org_id', session.org_id).maybeSingle();
  if (agentError) throw new EdgeError('agent_lookup_failed', 500);
  if (!agent || agent.status === 'revoked') throw new EdgeError('agent_revoked', 403);
  await admin.from('atlas_local_agent_sessions').update({ last_seen_at: new Date().toISOString() }).eq('id', session.id);
  return { agent, session };
}

async function validateApproval(admin: ReturnType<typeof createClient>, orgId: string, approvalId: string, command: {
  deviceId: string; capability: string; action: string; actionPayload: JsonObject;
}) {
  const { data: approval, error } = await admin.from('execution_approvals')
    .select('*').eq('id', approvalId).eq('org_id', orgId).eq('status', 'approved').maybeSingle();
  if (error) throw new EdgeError('approval_lookup_failed', 500);
  if (!approval) throw new EdgeError('approved_execution_approval_required', 409);
  if (
    String(approval.required_permission) !== 'execution.approve' ||
    !['high', 'critical'].includes(String(approval.risk_level))
  ) {
    throw new EdgeError('approval_binding_mismatch', 409);
  }

  const { data: task, error: taskError } = await admin.from('execution_tasks')
    .select('*').eq('id', approval.task_id).eq('org_id', orgId).maybeSingle();
  if (taskError || !task) throw new EdgeError('approval_task_not_found', 409);
  if (!task.current_step_id) throw new EdgeError('approval_binding_mismatch', 409);

  const { data: step, error: stepError } = await admin.from('execution_steps')
    .select('*').eq('id', task.current_step_id).eq('task_id', task.id).eq('org_id', orgId).maybeSingle();
  if (stepError || !step) throw new EdgeError('approval_step_not_found', 409);
  if (String(step.module) !== 'device-os' || String(step.action_type) !== 'local_device_command') {
    throw new EdgeError('approval_binding_mismatch', 409);
  }
  const payload = record(step.action_payload);
  if (
    clean(payload.device_id, 80) !== command.deviceId ||
    clean(payload.capability, 120) !== command.capability ||
    clean(payload.action, 120) !== command.action ||
    JSON.stringify(sortApprovalValue(record(payload.action_payload))) !== JSON.stringify(sortApprovalValue(command.actionPayload))
  ) throw new EdgeError('approval_binding_mismatch', 409);

  const reviewed = {
    taskId: String(task.id), workflowId: String(task.workflow_id), module: String(step.module),
    stepId: String(step.id), actionType: String(step.action_type), actionPayload: payload
  };
  const digest = await digestApprovalPayload({ payloadVersion: Number(task.version), payload: reviewed });
  if (Number(approval.payload_version) !== Number(task.version) || String(approval.payload_digest) !== digest) {
    throw new EdgeError('approval_binding_mismatch', 409);
  }
}

async function userOperation(req: Request, body: JsonObject, operation: string) {
  const orgId = requiredText(body.organization_id, 'organization_id_required', 80);
  const context = await resolveUser(req, orgId);
  const admin = adminClient();

  if (operation === 'agents.list') {
    requirePermission(context, 'device.agent.read');
    const { data, error } = await admin.from('atlas_local_agents').select('id,org_id,name,status,platform,agent_version,capabilities,modules,public_key_fingerprint,mtls_status,mtls_cert_fingerprint_sha256,mtls_cert_serial,mtls_cloudflare_cert_id,mtls_cert_expires_at,realtime_last_connected_at,installer_version,last_seen_at,created_at,updated_at')
      .eq('org_id', context.orgId).order('created_at');
    if (error) throw new EdgeError('persistence_error', 500);
    return json(req, { ok: true, agents: data || [] });
  }

  if (operation === 'devices.list') {
    requirePermission(context, 'device.agent.read');
    const { data, error } = await admin.from('atlas_local_devices').select('id,org_id,agent_id,external_id,label,device_type,adapter,capabilities,health_status,last_seen_at,metadata,created_at,updated_at')
      .eq('org_id', context.orgId).order('label');
    if (error) throw new EdgeError('persistence_error', 500);
    return json(req, { ok: true, devices: data || [] });
  }

  if (operation === 'commands.list') {
    requirePermission(context, 'device.agent.read');
    const { data, error } = await admin.from('atlas_local_device_commands').select('id,org_id,device_id,capability,action,action_payload,risk_level,approval_id,status,claimed_by_agent_id,claimed_at,finished_at,error_code,correlation_id,created_at')
      .eq('org_id', context.orgId).order('created_at', { ascending: false }).limit(100);
    if (error) throw new EdgeError('persistence_error', 500);
    return json(req, { ok: true, commands: data || [] });
  }

  if (operation === 'agents.mtls.bind') {
    requirePermission(context, 'device.agent.admin');
    const agentId = requiredText(body.agent_id, 'agent_id_required', 80);
    const fingerprint = requiredText(body.fingerprint_sha256, 'mtls_fingerprint_required', 64).toLowerCase();
    if (!MTLS_FINGERPRINT.test(fingerprint)) throw new EdgeError('invalid_mtls_fingerprint', 422);
    const serial = requiredText(body.serial, 'mtls_serial_required', 160);
    const expiresAt = new Date(requiredText(body.expires_at, 'mtls_expiry_required', 80));
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      throw new EdgeError('invalid_mtls_expiry', 422);
    }
    const { data: agent, error } = await admin.from('atlas_local_agents').update({
      mtls_status: 'active',
      mtls_cert_fingerprint_sha256: fingerprint,
      mtls_cert_serial: serial,
      mtls_cert_expires_at: expiresAt.toISOString(),
      updated_at: new Date().toISOString()
    }).eq('id', agentId).eq('org_id', context.orgId).neq('status', 'revoked')
      .select('id,mtls_status,mtls_cert_fingerprint_sha256,mtls_cert_serial,mtls_cert_expires_at').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!agent) throw new EdgeError('agent_not_found', 404);
    await appendEvent(admin, { orgId: context.orgId, agentId, eventType: 'agent.mtls.bound', success: true, safeDetail: { fingerprint_sha256: fingerprint, serial, expires_at: expiresAt.toISOString() } });
    return json(req, { ok: true, agent });
  }

  if (operation === 'agents.mtls.revoke') {
    requirePermission(context, 'device.agent.admin');
    const agentId = requiredText(body.agent_id, 'agent_id_required', 80);
    const { data: agent, error } = await admin.from('atlas_local_agents').update({
      mtls_status: 'revoked',
      realtime_last_connected_at: null,
      updated_at: new Date().toISOString()
    }).eq('id', agentId).eq('org_id', context.orgId)
      .select('id,mtls_status').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!agent) throw new EdgeError('agent_not_found', 404);
    await appendEvent(admin, { orgId: context.orgId, agentId, eventType: 'agent.mtls.revoked', severity: 'warning', success: true });
    return json(req, { ok: true, agent });
  }

  if (operation === 'bus.publish.authorize') {
    requirePermission(context, 'device.agent.use');
    const commandId = requiredText(body.command_id, 'command_id_required', 80);
    const requestedAgentId = requiredText(body.agent_id, 'agent_id_required', 80);
    const { data: command, error: commandError } = await admin.from('atlas_local_device_commands')
      .select('id,device_id,status,capability,action,risk_level')
      .eq('id', commandId).eq('org_id', context.orgId).maybeSingle();
    if (commandError) throw new EdgeError('persistence_error', 500);
    if (!command) throw new EdgeError('command_not_found', 404);
    if (!['queued','claimed'].includes(String(command.status))) throw new EdgeError('command_not_realtime_eligible', 409);
    const { data: device, error: deviceError } = await admin.from('atlas_local_devices')
      .select('id,agent_id').eq('id', command.device_id).eq('org_id', context.orgId).maybeSingle();
    if (deviceError) throw new EdgeError('persistence_error', 500);
    if (!device || String(device.agent_id) !== requestedAgentId) throw new EdgeError('bus_target_mismatch', 403);
    return json(req, {
      ok: true,
      bus: {
        org_id: context.orgId,
        agent_id: requestedAgentId,
        event: 'command.ready',
        command_id: String(command.id)
      }
    });
  }

  if (operation === 'remote.sessions.create') {
    requirePermission(context, 'device.agent.use');
    const deviceId = requiredText(body.device_id, 'device_id_required', 80);
    const mode = clean(body.mode, 20) || 'view';
    if (mode !== 'view') throw new EdgeError('remote_view_only_required', 422);

    const { data: device, error: deviceError } = await admin.from('atlas_local_devices')
      .select('id,agent_id,adapter,capabilities')
      .eq('id', deviceId).eq('org_id', context.orgId).maybeSingle();
    if (deviceError) throw new EdgeError('persistence_error', 500);
    if (!device) throw new EdgeError('device_not_found', 404);
    if (
      String(device.adapter) !== 'remote-desktop-windows' ||
      !(device.capabilities || []).includes('remote.session')
    ) throw new EdgeError('remote_device_not_capable', 409);

    const expiresAt = new Date(Date.now() + REMOTE_SESSION_MINUTES * 60_000).toISOString();
    const { data: remoteSession, error } = await admin.from('atlas_remote_sessions').insert({
      org_id: context.orgId,
      device_id: deviceId,
      agent_id: String(device.agent_id),
      requested_by: context.userId,
      mode,
      status: 'pending',
      expires_at: expiresAt
    }).select('id,org_id,device_id,agent_id,mode,status,consented_at,expires_at,ended_at,created_at').single();
    if (error || !remoteSession) throw new EdgeError('remote_session_create_failed', 500);

    await appendEvent(admin, {
      orgId: context.orgId,
      agentId: String(device.agent_id),
      deviceId,
      eventType: 'remote.session.created',
      success: null,
      safeDetail: { remote_session_id: String(remoteSession.id), mode }
    });
    return json(req, { ok: true, session: remoteSession }, 201);
  }

  if (operation === 'remote.sessions.status') {
    requirePermission(context, 'device.agent.read');
    const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
    const { data, error } = await admin.from('atlas_remote_sessions')
      .select('id,org_id,device_id,agent_id,mode,status,consented_at,expires_at,ended_at,created_at')
      .eq('id', sessionId).eq('org_id', context.orgId).eq('requested_by', context.userId).maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!data) throw new EdgeError('remote_session_not_found', 404);
    const expired = !['ended','denied','expired'].includes(String(data.status)) &&
      new Date(String(data.expires_at)).getTime() <= Date.now();
    if (expired) {
      await admin.from('atlas_remote_sessions').update({
        status: 'expired', ended_at: new Date().toISOString(), updated_at: new Date().toISOString()
      }).eq('id', sessionId).eq('org_id', context.orgId).neq('status', 'ended');
      return json(req, { ok: true, session: { ...data, status: 'expired' } });
    }
    return json(req, { ok: true, session: data });
  }

  if (operation === 'remote.sessions.viewer-ticket') {
    requirePermission(context, 'device.agent.use');
    const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
    const now = new Date();
    const { data: remoteSession, error: lookupError } = await admin.from('atlas_remote_sessions')
      .select('id,status,expires_at')
      .eq('id', sessionId).eq('org_id', context.orgId).eq('requested_by', context.userId).maybeSingle();
    if (lookupError) throw new EdgeError('persistence_error', 500);
    if (!remoteSession) throw new EdgeError('remote_session_not_found', 404);
    if (String(remoteSession.status) !== 'active' || new Date(String(remoteSession.expires_at)).getTime() <= Date.now()) {
      throw new EdgeError('remote_session_not_active', 409);
    }
    const ticket = randomSecret(32);
    const ticketHash = await sha256(ticket);
    const ticketExpiresAt = new Date(now.getTime() + REMOTE_VIEWER_TICKET_SECONDS * 1000).toISOString();
    const { data: updated, error } = await admin.from('atlas_remote_sessions').update({
      viewer_ticket_hash: ticketHash,
      viewer_ticket_expires_at: ticketExpiresAt,
      viewer_ticket_used_at: null,
      updated_at: now.toISOString()
    }).eq('id', sessionId).eq('org_id', context.orgId).eq('requested_by', context.userId)
      .eq('status', 'active').select('id').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!updated) throw new EdgeError('remote_session_not_active', 409);
    return json(req, { ok: true, viewer_ticket: ticket, expires_at: ticketExpiresAt });
  }

  if (operation === 'remote.sessions.end') {
    requirePermission(context, 'device.agent.use');
    const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
    const now = new Date().toISOString();
    const { data: ended, error } = await admin.from('atlas_remote_sessions').update({
      status: 'ended', ended_at: now, updated_at: now,
      viewer_ticket_hash: null, viewer_ticket_expires_at: null
    }).eq('id', sessionId).eq('org_id', context.orgId).eq('requested_by', context.userId)
      .in('status', ['pending','active']).select('id,agent_id,device_id').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!ended) throw new EdgeError('remote_session_not_active', 409);
    await appendEvent(admin, {
      orgId: context.orgId,
      agentId: String(ended.agent_id),
      deviceId: String(ended.device_id),
      eventType: 'remote.session.ended',
      success: true,
      safeDetail: { remote_session_id: sessionId, ended_by: 'requester' }
    });
    return json(req, { ok: true });
  }

  if (operation === 'enrollment.create') {
    requirePermission(context, 'device.agent.admin');
    const agentName = requiredText(body.agent_name, 'agent_name_required', 120);
    const code = randomSecret(24);
    const hash = await sha256(code);
    const expiresAt = new Date(Date.now() + 10 * 60_000).toISOString();
    const { data, error } = await admin.from('atlas_local_agent_enrollments').insert({
      org_id: context.orgId, agent_name: agentName, enrollment_code_hash: hash,
      expires_at: expiresAt, created_by: context.userId
    }).select('id,agent_name,expires_at').single();
    if (error || !data) throw new EdgeError('enrollment_create_failed', 500);
    return json(req, { ok: true, enrollment: data, enrollment_code: code }, 201);
  }

  if (operation === 'agents.revoke') {
    requirePermission(context, 'device.agent.admin');
    const agentId = requiredText(body.agent_id, 'agent_id_required', 80);
    const { data: agent, error } = await admin.from('atlas_local_agents').update({
      status: 'revoked', mtls_status: 'revoked', realtime_last_connected_at: null, updated_at: new Date().toISOString()
    }).eq('id', agentId).eq('org_id', context.orgId).select('id').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!agent) throw new EdgeError('agent_not_found', 404);
    await admin.from('atlas_local_agent_sessions').update({ revoked_at: new Date().toISOString() })
      .eq('agent_id', agentId).eq('org_id', context.orgId).is('revoked_at', null);
    await appendEvent(admin, { orgId: context.orgId, agentId, eventType: 'agent.revoked', severity: 'warning', success: true });
    return json(req, { ok: true });
  }

  if (operation === 'commands.enqueue') {
    requirePermission(context, 'device.agent.use');
    const deviceId = requiredText(body.device_id, 'device_id_required', 80);
    const capability = requiredText(body.capability, 'capability_required', 120);
    const action = requiredText(body.action, 'action_required', 120);
    const risk = clean(body.risk_level, 20) || 'low';
    if (!['low', 'medium', 'high', 'critical'].includes(risk)) throw new EdgeError('invalid_risk_level', 422);
    const { data: device, error: deviceError } = await admin.from('atlas_local_devices')
      .select('id,agent_id,capabilities').eq('id', deviceId).eq('org_id', context.orgId).maybeSingle();
    if (deviceError) throw new EdgeError('persistence_error', 500);
    if (!device) throw new EdgeError('device_not_found', 404);
    if (!(device.capabilities || []).includes(capability)) throw new EdgeError('capability_not_declared', 409);
    const actionPayload = safeActionPayload(body.action_payload);
    const approvalId = clean(body.approval_id, 80) || null;
    if (capability === 'browser.control' && action === 'oauth_consent' && !['high', 'critical'].includes(risk)) {
      throw new EdgeError('oauth_consent_high_risk_required', 409);
    }
    if (['high', 'critical'].includes(risk)) {
      if (!approvalId) throw new EdgeError('approved_execution_approval_required', 409);
      await validateApproval(admin, context.orgId, approvalId, { deviceId, capability, action, actionPayload });
    }
    const { data: command, error } = await admin.from('atlas_local_device_commands').insert({
      org_id: context.orgId, device_id: deviceId, requested_by: context.userId,
      capability, action, action_payload: actionPayload, risk_level: risk, approval_id: approvalId,
      correlation_id: clean(req.headers.get('x-request-id'), 120) || crypto.randomUUID()
    }).select('*').single();
    if (error || !command) throw new EdgeError('command_enqueue_failed', 500);
    await appendEvent(admin, { orgId: context.orgId, deviceId, commandId: String(command.id), eventType: 'command.queued', success: null, safeDetail: { capability, action, risk_level: risk } });
    return json(req, { ok: true, command }, 201);
  }

  throw new EdgeError('unsupported_operation', 404);
}

async function enrollAgent(req: Request, body: JsonObject) {
  const code = requiredText(body.enrollment_code, 'enrollment_code_required', 500);
  const hash = await sha256(code);
  const admin = adminClient();
  const now = new Date().toISOString();
  const { data: enrollment, error } = await admin.from('atlas_local_agent_enrollments')
    .select('*').eq('enrollment_code_hash', hash).is('used_at', null).gt('expires_at', now).maybeSingle();
  if (error) throw new EdgeError('enrollment_lookup_failed', 500);
  if (!enrollment) throw new EdgeError('invalid_or_expired_enrollment', 401);

  const { data: consumed, error: consumeError } = await admin.from('atlas_local_agent_enrollments')
    .update({ used_at: now }).eq('id', enrollment.id).is('used_at', null).select('id').maybeSingle();
  if (consumeError || !consumed) throw new EdgeError('enrollment_already_used', 409);

  const fingerprint = clean(body.public_key_fingerprint, 191) || null;
  if (fingerprint && !/^[A-Fa-f0-9:]{16,191}$/.test(fingerprint)) throw new EdgeError('invalid_public_key_fingerprint', 422);
  const row = {
    org_id: String(enrollment.org_id), name: String(enrollment.agent_name), status: 'online',
    platform: clean(body.platform, 120) || 'unknown',
    agent_version: clean(body.agent_version, 80) || 'unknown',
    capabilities: stringArray(body.capabilities), modules: stringArray(body.modules),
    public_key_fingerprint: fingerprint, installer_version: clean(body.installer_version, 80) || null, last_seen_at: now, created_by: String(enrollment.created_by), updated_at: now
  };
  const { data: agent, error: agentError } = await admin.from('atlas_local_agents')
    .upsert(row, { onConflict: 'org_id,name' }).select('*').single();
  if (agentError || !agent) throw new EdgeError('agent_enrollment_failed', 500);

  const session = await issueAgentSession(admin, String(agent.org_id), String(agent.id));
  await appendEvent(admin, { orgId: String(agent.org_id), agentId: String(agent.id), eventType: 'agent.enrolled', success: true, safeDetail: { platform: row.platform, agent_version: row.agent_version } });
  return json(req, {
    ok: true,
    agent: { id: agent.id, org_id: agent.org_id, name: agent.name, status: agent.status },
    session_token: session.sessionToken,
    session_expires_at: session.expiresAt
  }, 201);
}

async function agentOperation(req: Request, body: JsonObject, operation: string) {
  const context = await resolveAgent(req);
  const admin = adminClient();
  const agentId = String(context.agent.id);
  const orgId = String(context.agent.org_id);
  const now = new Date().toISOString();

  if (operation === 'agent.bus.verify') {
    const fingerprint = requiredText(body.mtls_cert_fingerprint_sha256, 'mtls_fingerprint_required', 64).toLowerCase();
    const serial = requiredText(body.mtls_cert_serial, 'mtls_serial_required', 160);
    if (body.mtls_cert_verified !== true || !MTLS_FINGERPRINT.test(fingerprint)) {
      throw new EdgeError('mtls_required', 401);
    }
    if (String(context.agent.mtls_status) !== 'active') throw new EdgeError('mtls_not_active', 403);
    if (String(context.agent.mtls_cert_fingerprint_sha256 || '').toLowerCase() !== fingerprint) {
      throw new EdgeError('mtls_fingerprint_mismatch', 403);
    }
    if (String(context.agent.mtls_cert_serial || '') !== serial) throw new EdgeError('mtls_serial_mismatch', 403);
    const expiresAt = new Date(String(context.agent.mtls_cert_expires_at || ''));
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt.getTime() <= Date.now()) {
      await admin.from('atlas_local_agents').update({ mtls_status: 'expired', realtime_last_connected_at: null, updated_at: now })
        .eq('id', agentId).eq('org_id', orgId);
      throw new EdgeError('mtls_certificate_expired', 403);
    }
    await admin.from('atlas_local_agents').update({ realtime_last_connected_at: now, updated_at: now })
      .eq('id', agentId).eq('org_id', orgId);
    await appendEvent(admin, { orgId, agentId, eventType: 'agent.realtime.authorized', success: true, safeDetail: { fingerprint_sha256: fingerprint, serial } });
    return json(req, { ok: true, bus: { org_id: orgId, agent_id: agentId } });
  }

  if (operation === 'agent.remote.consent') {
    const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
    const granted = body.granted === true;
    const { data: remoteSession, error: lookupError } = await admin.from('atlas_remote_sessions')
      .select('id,device_id,mode,status,expires_at')
      .eq('id', sessionId).eq('org_id', orgId).eq('agent_id', agentId).maybeSingle();
    if (lookupError) throw new EdgeError('persistence_error', 500);
    if (!remoteSession) throw new EdgeError('remote_session_not_found', 404);
    if (String(remoteSession.status) !== 'pending') throw new EdgeError('remote_session_not_pending', 409);
    if (new Date(String(remoteSession.expires_at)).getTime() <= Date.now()) {
      await admin.from('atlas_remote_sessions').update({ status: 'expired', ended_at: now, updated_at: now })
        .eq('id', sessionId).eq('org_id', orgId).eq('agent_id', agentId);
      throw new EdgeError('remote_session_expired', 409);
    }

    if (!granted) {
      await admin.from('atlas_remote_sessions').update({
        status: 'denied', ended_at: now, updated_at: now
      }).eq('id', sessionId).eq('org_id', orgId).eq('agent_id', agentId).eq('status', 'pending');
      await appendEvent(admin, {
        orgId, agentId, deviceId: String(remoteSession.device_id),
        eventType: 'remote.session.consent.denied', success: false,
        safeDetail: { remote_session_id: sessionId, mode: String(remoteSession.mode) }
      });
      return json(req, { ok: true, status: 'denied' });
    }

    const expiresAt = new Date(Date.now() + REMOTE_SESSION_MINUTES * 60_000).toISOString();
    const { data: activated, error } = await admin.from('atlas_remote_sessions').update({
      status: 'active', consented_at: now, expires_at: expiresAt, updated_at: now
    }).eq('id', sessionId).eq('org_id', orgId).eq('agent_id', agentId).eq('status', 'pending')
      .select('id,mode,expires_at').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!activated) throw new EdgeError('remote_session_not_pending', 409);
    await appendEvent(admin, {
      orgId, agentId, deviceId: String(remoteSession.device_id),
      eventType: 'remote.session.consent.granted', success: true,
      safeDetail: { remote_session_id: sessionId, mode: String(remoteSession.mode) }
    });
    return json(req, { ok: true, status: 'active', expires_at: expiresAt, mode: activated.mode });
  }

  if (operation === 'agent.remote.verify') {
    const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
    const fingerprint = requiredText(body.mtls_cert_fingerprint_sha256, 'mtls_fingerprint_required', 64).toLowerCase();
    const serial = requiredText(body.mtls_cert_serial, 'mtls_serial_required', 160);
    if (body.mtls_cert_verified !== true || !MTLS_FINGERPRINT.test(fingerprint)) {
      throw new EdgeError('mtls_required', 401);
    }
    if (String(context.agent.mtls_status) !== 'active') throw new EdgeError('mtls_not_active', 403);
    if (String(context.agent.mtls_cert_fingerprint_sha256 || '').toLowerCase() !== fingerprint) {
      throw new EdgeError('mtls_fingerprint_mismatch', 403);
    }
    if (String(context.agent.mtls_cert_serial || '') !== serial) throw new EdgeError('mtls_serial_mismatch', 403);
    const certExpiresAt = new Date(String(context.agent.mtls_cert_expires_at || ''));
    if (!Number.isFinite(certExpiresAt.getTime()) || certExpiresAt.getTime() <= Date.now()) {
      await admin.from('atlas_local_agents').update({
        mtls_status: 'expired', realtime_last_connected_at: null, updated_at: now
      }).eq('id', agentId).eq('org_id', orgId);
      throw new EdgeError('mtls_certificate_expired', 403);
    }

    const { data: remoteSession, error } = await admin.from('atlas_remote_sessions')
      .select('id,org_id,agent_id,device_id,mode,status,expires_at')
      .eq('id', sessionId).eq('org_id', orgId).eq('agent_id', agentId).maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (!remoteSession) throw new EdgeError('remote_session_not_found', 404);
    if (
      String(remoteSession.status) !== 'active' ||
      new Date(String(remoteSession.expires_at)).getTime() <= Date.now()
    ) throw new EdgeError('remote_session_not_active', 409);

    await appendEvent(admin, {
      orgId, agentId, deviceId: String(remoteSession.device_id),
      eventType: 'remote.relay.agent.authorized', success: true,
      safeDetail: { remote_session_id: sessionId, mode: String(remoteSession.mode) }
    });
    return json(req, {
      ok: true,
      bus: {
        org_id: orgId,
        agent_id: agentId,
        session_id: sessionId,
        mode: String(remoteSession.mode),
        expires_at: String(remoteSession.expires_at)
      }
    });
  }

  if (operation === 'agent.remote.end') {
    const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
    const { data: ended, error } = await admin.from('atlas_remote_sessions').update({
      status: 'ended', ended_at: now, updated_at: now,
      viewer_ticket_hash: null, viewer_ticket_expires_at: null
    }).eq('id', sessionId).eq('org_id', orgId).eq('agent_id', agentId)
      .in('status', ['pending','active']).select('id,device_id').maybeSingle();
    if (error) throw new EdgeError('persistence_error', 500);
    if (ended) {
      await appendEvent(admin, {
        orgId, agentId, deviceId: String(ended.device_id),
        eventType: 'remote.session.ended', success: true,
        safeDetail: { remote_session_id: sessionId, ended_by: 'agent' }
      });
    }
    return json(req, { ok: true });
  }

  if (operation === 'agent.heartbeat') {
    const capabilities = body.capabilities === undefined ? context.agent.capabilities : stringArray(body.capabilities);
    const modules = body.modules === undefined ? context.agent.modules : stringArray(body.modules);
    const { error } = await admin.from('atlas_local_agents').update({
      status: 'online', last_seen_at: now, updated_at: now,
      platform: clean(body.platform, 120) || context.agent.platform,
      agent_version: clean(body.agent_version, 80) || context.agent.agent_version,
      capabilities, modules
    }).eq('id', agentId).eq('org_id', orgId);
    if (error) throw new EdgeError('heartbeat_failed', 500);

    const remaining = new Date(String(context.session.expires_at)).getTime() - Date.now();
    let rotation: { sessionToken: string; expiresAt: string } | null = null;
    if (remaining < ROTATE_BEFORE_MINUTES * 60_000) {
      const next = await issueAgentSession(admin, orgId, agentId);
      await admin.from('atlas_local_agent_sessions').update({ revoked_at: now }).eq('id', context.session.id);
      rotation = { sessionToken: next.sessionToken, expiresAt: next.expiresAt };
    }
    return json(req, { ok: true, session_token: rotation?.sessionToken || null, session_expires_at: rotation?.expiresAt || context.session.expires_at });
  }

  if (operation === 'agent.devices.sync') {
    const devices = Array.isArray(body.devices) ? body.devices.slice(0, 100) : [];
    const synced: string[] = [];
    for (const item of devices) {
      const input = record(item);
      const metadata = record(input.metadata);
      if (containsSensitiveKey(metadata)) throw new EdgeError('sensitive_device_metadata_rejected', 422);
      const externalId = requiredText(input.external_id, 'external_id_required', 160);
      const adapter = requiredText(input.adapter, 'adapter_required', 120);
      const deviceType = requiredText(input.device_type, 'device_type_required', 80);
      const capabilities = stringArray(input.capabilities);
      if (adapter === 'device-dna-linux') {
        if (deviceType !== 'computer') throw new EdgeError('device_dna_device_type_invalid', 422);
        await validateDeviceDnaMetadata(metadata, String(context.agent.platform || ''), capabilities);
      }
      if (adapter === 'remote-desktop-windows') {
        if (!String(context.agent.platform || '').toLowerCase().startsWith('win32')) {
          throw new EdgeError('remote_windows_agent_required', 422);
        }
        if (deviceType !== 'computer' || !capabilities.includes('remote.session')) {
          throw new EdgeError('remote_device_capability_invalid', 422);
        }
      }
      const row = {
        org_id: orgId, agent_id: agentId, external_id: externalId,
        label: requiredText(input.label, 'device_label_required', 160),
        device_type: deviceType,
        adapter,
        capabilities,
        health_status: adapter === 'device-dna-linux'
          ? 'unknown'
          : ['unknown','healthy','degraded','offline','error'].includes(clean(input.health_status, 20))
            ? clean(input.health_status, 20) : 'unknown',
        last_seen_at: now, metadata, updated_at: now
      };
      const { data, error } = await admin.from('atlas_local_devices')
        .upsert(row, { onConflict: 'agent_id,external_id' }).select('id').single();
      if (error || !data) throw new EdgeError('device_sync_failed', 500);
      synced.push(String(data.id));
    }
    await appendEvent(admin, { orgId, agentId, eventType: 'devices.synced', success: true, safeDetail: { count: synced.length } });
    return json(req, { ok: true, device_ids: synced });
  }

  if (operation === 'agent.commands.claim') {
    const { data: devices, error: devicesError } = await admin.from('atlas_local_devices')
      .select('id').eq('org_id', orgId).eq('agent_id', agentId);
    if (devicesError) throw new EdgeError('persistence_error', 500);
    const deviceIds = (devices || []).map((item: any) => String(item.id));
    if (!deviceIds.length) return json(req, { ok: true, command: null });
    const { data: candidates, error } = await admin.from('atlas_local_device_commands')
      .select('*').eq('org_id', orgId).eq('status', 'queued').in('device_id', deviceIds)
      .order('created_at').limit(1);
    if (error) throw new EdgeError('persistence_error', 500);
    const candidate = candidates?.[0];
    if (!candidate) return json(req, { ok: true, command: null });
    const { data: claimed, error: claimError } = await admin.from('atlas_local_device_commands')
      .update({ status: 'claimed', claimed_by_agent_id: agentId, claimed_at: now })
      .eq('id', candidate.id).eq('org_id', orgId).eq('status', 'queued')
      .select('id,device_id,capability,action,action_payload,risk_level,status,claimed_at').maybeSingle();
    if (claimError) throw new EdgeError('command_claim_failed', 500);
    if (!claimed) return json(req, { ok: true, command: null });
    await appendEvent(admin, { orgId, agentId, deviceId: String(claimed.device_id), commandId: String(claimed.id), eventType: 'command.claimed', success: null });
    return json(req, { ok: true, command: claimed });
  }

  if (operation === 'agent.commands.complete') {
    const commandId = requiredText(body.command_id, 'command_id_required', 80);
    const success = body.success === true;
    const errorCode = success ? null : requiredText(body.error_code, 'error_code_required', 120);
    const { data: command, error } = await admin.from('atlas_local_device_commands').update({
      status: success ? 'succeeded' : 'failed', finished_at: now, error_code: errorCode
    }).eq('id', commandId).eq('org_id', orgId).eq('claimed_by_agent_id', agentId).eq('status', 'claimed')
      .select('id,device_id').maybeSingle();
    if (error) throw new EdgeError('command_complete_failed', 500);
    if (!command) throw new EdgeError('claimed_command_not_found', 404);
    await appendEvent(admin, { orgId, agentId, deviceId: String(command.device_id), commandId, eventType: success ? 'command.succeeded' : 'command.failed', severity: success ? 'info' : 'error', success, safeDetail: errorCode ? { error_code: errorCode } : {} });
    return json(req, { ok: true });
  }

  if (operation === 'agent.events.append') {
    const detail = record(body.safe_detail);
    if (containsSensitiveKey(detail)) throw new EdgeError('sensitive_event_detail_rejected', 422);
    const deviceId = clean(body.device_id, 80) || null;
    if (deviceId) {
      const { data: device } = await admin.from('atlas_local_devices').select('id').eq('id', deviceId).eq('agent_id', agentId).eq('org_id', orgId).maybeSingle();
      if (!device) throw new EdgeError('device_not_owned_by_agent', 403);
    }
    await appendEvent(admin, { orgId, agentId, deviceId, eventType: requiredText(body.event_type, 'event_type_required', 120), severity: clean(body.severity, 20), success: typeof body.success === 'boolean' ? body.success : null, safeDetail: detail });
    return json(req, { ok: true }, 201);
  }

  throw new EdgeError('unsupported_agent_operation', 404);
}


async function verifyRemoteViewer(req: Request, body: JsonObject) {
  const sessionId = requiredText(body.session_id, 'remote_session_id_required', 80);
  const ticket = requiredText(body.viewer_ticket, 'remote_viewer_ticket_required', 500);
  const ticketHash = await sha256(ticket);
  const admin = adminClient();
  const now = new Date().toISOString();

  const { data: remoteSession, error: lookupError } = await admin.from('atlas_remote_sessions')
    .select('id,org_id,agent_id,device_id,mode,status,expires_at,viewer_ticket_hash,viewer_ticket_expires_at,viewer_ticket_used_at')
    .eq('id', sessionId).maybeSingle();
  if (lookupError) throw new EdgeError('persistence_error', 500);
  if (!remoteSession) throw new EdgeError('remote_session_not_found', 404);
  if (
    String(remoteSession.status) !== 'active' ||
    new Date(String(remoteSession.expires_at)).getTime() <= Date.now()
  ) throw new EdgeError('remote_session_not_active', 409);
  if (
    !remoteSession.viewer_ticket_hash ||
    String(remoteSession.viewer_ticket_hash) !== ticketHash ||
    remoteSession.viewer_ticket_used_at ||
    new Date(String(remoteSession.viewer_ticket_expires_at || '')).getTime() <= Date.now()
  ) throw new EdgeError('remote_viewer_ticket_invalid_or_expired', 401);

  const { data: consumed, error } = await admin.from('atlas_remote_sessions').update({
    viewer_ticket_used_at: now,
    viewer_ticket_hash: null,
    updated_at: now
  }).eq('id', sessionId)
    .eq('status', 'active')
    .eq('viewer_ticket_hash', ticketHash)
    .is('viewer_ticket_used_at', null)
    .gt('viewer_ticket_expires_at', now)
    .select('id').maybeSingle();
  if (error) throw new EdgeError('persistence_error', 500);
  if (!consumed) throw new EdgeError('remote_viewer_ticket_invalid_or_expired', 401);

  await appendEvent(admin, {
    orgId: String(remoteSession.org_id),
    agentId: String(remoteSession.agent_id),
    deviceId: String(remoteSession.device_id),
    eventType: 'remote.relay.viewer.authorized',
    success: true,
    safeDetail: { remote_session_id: sessionId, mode: String(remoteSession.mode) }
  });
  return json(req, {
    ok: true,
    bus: {
      org_id: String(remoteSession.org_id),
      session_id: sessionId,
      agent_id: String(remoteSession.agent_id),
      mode: String(remoteSession.mode),
      expires_at: String(remoteSession.expires_at)
    }
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  const url = new URL(req.url);
  if (url.searchParams.get('api') === 'mtls-provision-callback') {
    if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);
    try {
      return await mtlsProvisionCallback(req);
    } catch (error) {
      const status = error instanceof EdgeError ? error.status : 500;
      const code = error instanceof EdgeError ? error.code : 'internal_error';
      if (status >= 500) console.error('atlas_local_mtls_provision_failed', { code });
      return json(req, { ok: false, error: code }, status);
    }
  }
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);
  try {
    const length = Number(req.headers.get('content-length') || '0');
    if (length > MAX_REQUEST_BYTES) throw new EdgeError('request_too_large', 413);
    const body = record(await req.json());
    const operation = requiredText(body.operation, 'operation_required', 80);
    if (operation === 'remote.viewer.verify') return await verifyRemoteViewer(req, body);
    if (operation === 'agent.enroll') return await enrollAgent(req, body);
    if (operation.startsWith('agent.')) return await agentOperation(req, body, operation);
    return await userOperation(req, body, operation);
  } catch (error) {
    const status = error instanceof EdgeError ? error.status : 500;
    const code = error instanceof EdgeError ? error.code : 'internal_error';
    if (status >= 500) console.error('atlas_local_control_failed', { code });
    return json(req, { ok: false, error: code }, status);
  }
});
