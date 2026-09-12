import { evaluateRoomAccessRequest } from '../../../packages/hospitality/access.ts';
import { requireHospitalityPermission } from '../../../packages/hospitality/permissions.ts';
import { resolveContext } from './_shared/context.ts';
import { errorResponse, hospitalityError, json } from './_shared/errors.ts';
import { providerFor } from './_shared/provider-registry.ts';
import {
  listCredentialReferences,
  listHospitalityAudit,
  listProviderInstances,
  listRoomMappings,
  loadProviderInstance,
  loadRoomMapping,
  writeHospitalityAudit
} from './_shared/repository.ts';

const VERSION = 2;
const OPERATIONS = [
  'readiness',
  'providers',
  'rooms',
  'credentials',
  'issue',
  'revoke',
  'credential-status',
  'audit'
] as const;

type Operation = (typeof OPERATIONS)[number];

const clean = (value: unknown, max = 500) => String(value ?? '').trim().slice(0, max);

function propertyIdFrom(url: URL, body?: Record<string, unknown>) {
  return clean(body?.property_id || url.searchParams.get('property_id'), 120);
}

async function parseJson(req: Request) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    throw hospitalityError('invalid_json', 400);
  }
}

async function readiness(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  const propertyId = propertyIdFrom(url);
  const instances = await listProviderInstances(ctx.orgId, propertyId || undefined);

  const providers = await Promise.all(instances.map(async (instance) => {
    if (instance.state === 'not_configured' || instance.state === 'disabled') {
      return {
        id: instance.id,
        property_id: instance.property_id,
        provider_type: instance.provider_type,
        display_name: instance.display_name,
        state: instance.state,
        blocker: instance.state === 'disabled' ? 'provider_disabled' : 'provider_not_configured',
        capabilities: instance.capabilities,
        checked_at: instance.last_verified_at
      };
    }

    try {
      const adapter = providerFor(instance);
      const result = await adapter.readiness({
        organizationId: ctx.orgId,
        propertyId: instance.property_id,
        userId: ctx.userId,
        providerInstanceId: instance.id,
        providerPropertyId: instance.provider_property_id || ''
      });
      return {
        id: instance.id,
        property_id: instance.property_id,
        provider_type: instance.provider_type,
        display_name: instance.display_name,
        ...result
      };
    } catch (error) {
      return {
        id: instance.id,
        property_id: instance.property_id,
        provider_type: instance.provider_type,
        display_name: instance.display_name,
        state: 'configured_unverified',
        blocker: error instanceof Error ? error.message : 'provider_not_ready',
        capabilities: instance.capabilities,
        checked_at: new Date().toISOString()
      };
    }
  }));

  return json({
    ok: true,
    service: 'atlas-hospitality-access',
    version: VERSION,
    organization_id: ctx.orgId,
    role: ctx.role,
    permissions: ctx.permissions,
    providers,
    issuance_enabled: providers.some((provider: any) => provider.state === 'ready'),
    checked_at: new Date().toISOString()
  });
}

async function providers(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.read');
  const propertyId = propertyIdFrom(url);
  const rows = await listProviderInstances(ctx.orgId, propertyId || undefined);
  return json({ ok: true, providers: rows });
}

async function rooms(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.read');
  const propertyId = propertyIdFrom(url);
  if (!propertyId) throw hospitalityError('property_required', 422);
  return json({ ok: true, rooms: await listRoomMappings(ctx.orgId, propertyId) });
}

async function credentials(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.read');
  const propertyId = propertyIdFrom(url);
  if (!propertyId) throw hospitalityError('property_required', 422);
  return json({ ok: true, credentials: await listCredentialReferences(ctx.orgId, propertyId) });
}

async function issue(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.issue');
  const body = await parseJson(req);
  const propertyId = propertyIdFrom(url, body);
  const roomId = clean(body.room_id, 120);
  const providerInstanceId = clean(body.provider_instance_id, 120);
  if (!propertyId) throw hospitalityError('property_required', 422);
  if (!providerInstanceId) throw hospitalityError('provider_not_configured', 422);

  const instance = await loadProviderInstance(ctx.orgId, propertyId, providerInstanceId);
  const request = {
    propertyId,
    roomId,
    assignmentReference: clean(body.assignment_reference, 160),
    startsAt: clean(body.starts_at, 80),
    expiresAt: clean(body.expires_at, 80),
    reason: clean(body.reason, 40) as 'guest_checkin' | 'replacement' | 'staff_authorized'
  };
  const decision = evaluateRoomAccessRequest(ctx, instance.state as any, request);
  if (!decision.allowed) {
    throw hospitalityError('invalid_room_access_request', 422, { errors: decision.reasons });
  }

  await loadRoomMapping(ctx.orgId, propertyId, roomId, instance.id);
  const adapter = providerFor(instance);
  await writeHospitalityAudit(ctx.orgId, ctx.userId, 'hospitality.room_access.issue_requested', null, {
    property_id: propertyId,
    room_id: roomId,
    provider_instance_id: instance.id,
    assignment_reference: request.assignmentReference,
    starts_at: request.startsAt,
    expires_at: request.expiresAt,
    reason: request.reason
  });

  // Provider-specific issuance is intentionally fail-closed until the adapter
  // for this configured property has passed its own readiness verification.
  await adapter.issueCredential({
    organizationId: ctx.orgId,
    propertyId,
    userId: ctx.userId,
    providerInstanceId: instance.id,
    providerPropertyId: instance.provider_property_id || ''
  }, {
    ...request,
    providerRoomId: roomId,
    credentialType: 'provider_reference'
  } as any);

  throw hospitalityError('provider_response_invalid', 502);
}

async function unavailableMutation(req: Request, operation: 'revoke' | 'credential-status') {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(
    ctx,
    operation === 'revoke' ? 'hospitality.access.revoke' : 'hospitality.access.read'
  );
  throw hospitalityError('provider_not_ready', 503, { operation, blocker: 'credential_lifecycle_orchestration_pending' });
}

async function audit(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.audit');
  const propertyId = propertyIdFrom(url);
  if (!propertyId) throw hospitalityError('property_required', 422);
  return json({ ok: true, audit: await listHospitalityAudit(ctx.orgId, propertyId) });
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const operation = url.searchParams.get('api') as Operation | null;

  try {
    if (!operation || !OPERATIONS.includes(operation)) throw hospitalityError('not_found', 404);
    if (req.method === 'GET' && operation === 'readiness') return await readiness(req, url);
    if (req.method === 'GET' && operation === 'providers') return await providers(req, url);
    if (req.method === 'GET' && operation === 'rooms') return await rooms(req, url);
    if (req.method === 'GET' && operation === 'credentials') return await credentials(req, url);
    if (req.method === 'POST' && operation === 'issue') return await issue(req, url);
    if (req.method === 'POST' && operation === 'revoke') return await unavailableMutation(req, 'revoke');
    if (req.method === 'GET' && operation === 'credential-status') return await unavailableMutation(req, 'credential-status');
    if (req.method === 'GET' && operation === 'audit') return await audit(req, url);
    throw hospitalityError('method_not_allowed', 405);
  } catch (error) {
    return errorResponse(error);
  }
});
