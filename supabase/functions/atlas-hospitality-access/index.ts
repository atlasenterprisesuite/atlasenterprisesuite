import { evaluateRoomAccessRequest } from '../../../packages/hospitality/access.ts';
import { requireHospitalityPermission } from '../../../packages/hospitality/permissions.ts';
import type { HospitalityCapability, RoomAccessReason } from '../../../packages/hospitality/types.ts';
import { resolveContext } from './_shared/context.ts';
import { errorResponse, hospitalityError, json, optionsResponse, withCors } from './_shared/errors.ts';
import { providerFor } from './_shared/provider-registry.ts';
import {
  insertCredentialReference,
  listCredentialReferences,
  listHospitalityAudit,
  listProviderInstances,
  listRoomMappings,
  loadCredentialReference,
  loadProviderInstance,
  loadRoomMapping,
  updateCredentialReferenceStatus,
  writeHospitalityAudit
} from './_shared/repository.ts';

const VERSION = 3;
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

function credentialIdFrom(url: URL, body?: Record<string, unknown>) {
  return clean(body?.credential_id || url.searchParams.get('credential_id'), 120);
}

function parseReason(value: unknown): RoomAccessReason {
  const reason = clean(value, 40);
  if (!['guest_checkin', 'replacement', 'staff_authorized'].includes(reason)) {
    throw hospitalityError('invalid_reason', 422);
  }
  return reason as RoomAccessReason;
}

async function parseJson(req: Request) {
  try {
    const body = await req.json();
    return body && typeof body === 'object' ? body as Record<string, unknown> : {};
  } catch {
    throw hospitalityError('invalid_json', 400);
  }
}

function providerContext(ctx: Awaited<ReturnType<typeof resolveContext>>, instance: any) {
  return {
    organizationId: ctx.orgId,
    propertyId: String(instance.property_id),
    userId: ctx.userId,
    providerInstanceId: String(instance.id),
    providerPropertyId: String(instance.provider_property_id || '')
  };
}

function requireProviderCapability(
  readiness: { state: string; capabilities: readonly string[]; blocker?: string | null },
  capability: HospitalityCapability
) {
  if (readiness.state !== 'ready') {
    throw hospitalityError('provider_not_ready', 503, {
      blocker: readiness.blocker || 'provider_readiness_not_verified',
      state: readiness.state
    });
  }
  if (!readiness.capabilities.includes(capability)) {
    throw hospitalityError('provider_capability_not_supported', 409, { state: readiness.state });
  }
}

async function readiness(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.read');
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
      const result = await adapter.readiness(providerContext(ctx, instance));
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
    issuance_enabled: providers.some((provider: any) =>
      provider.state === 'ready' && Array.isArray(provider.capabilities) && provider.capabilities.includes('credential.issue')
    ),
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
  const adapter = providerFor(instance);
  const pctx = providerContext(ctx, instance);
  const providerReadiness = await adapter.readiness(pctx);
  requireProviderCapability(providerReadiness, 'credential.issue');

  const request = {
    propertyId,
    roomId,
    assignmentReference: clean(body.assignment_reference, 160),
    startsAt: clean(body.starts_at, 80),
    expiresAt: clean(body.expires_at, 80),
    reason: parseReason(body.reason)
  };
  const decision = evaluateRoomAccessRequest(ctx, 'ready', request);
  if (!decision.allowed) {
    throw hospitalityError('invalid_room_access_request', 422, { errors: decision.reasons });
  }

  const mapping = await loadRoomMapping(ctx.orgId, propertyId, roomId, instance.id);
  const credentialType = providerReadiness.capabilities.includes('mobile_key.issue')
    ? 'mobile_key'
    : providerReadiness.capabilities.includes('rfid_reference.issue')
      ? 'rfid_reference'
      : null;
  if (!credentialType) throw hospitalityError('provider_capability_not_supported', 409);

  await writeHospitalityAudit(ctx.orgId, ctx.userId, 'hospitality.room_access.issue_requested', null, {
    property_id: propertyId,
    room_id: roomId,
    provider_instance_id: instance.id,
    assignment_reference: request.assignmentReference,
    starts_at: request.startsAt,
    expires_at: request.expiresAt,
    reason: request.reason,
    credential_type: credentialType
  });

  const providerResult = await adapter.issueCredential(pctx, {
    ...request,
    providerRoomId: String(mapping.provider_room_id),
    credentialType
  });
  if (!providerResult?.providerCredentialId) {
    throw hospitalityError('provider_response_invalid', 502);
  }

  let reference: any;
  try {
    reference = await insertCredentialReference({
      org_id: ctx.orgId,
      property_id: propertyId,
      room_id: roomId,
      provider_instance_id: instance.id,
      provider_credential_id: providerResult.providerCredentialId,
      assignment_reference: request.assignmentReference,
      credential_type: credentialType,
      starts_at: request.startsAt,
      expires_at: request.expiresAt,
      status: 'issued',
      issued_by: ctx.userId,
      provider_status_code: providerResult.providerStatusCode ?? null
    });
  } catch {
    try {
      await writeHospitalityAudit(ctx.orgId, ctx.userId, 'hospitality.room_access.reconciliation_required', null, {
        property_id: propertyId,
        room_id: roomId,
        provider_instance_id: instance.id,
        provider_credential_id: providerResult.providerCredentialId,
        blocker: 'persistence_failed'
      });
    } catch {
      // Preserve the primary persistence failure without leaking provider data.
    }
    throw hospitalityError('persistence_failed', 500);
  }

  await writeHospitalityAudit(ctx.orgId, ctx.userId, 'hospitality.room_access.issued', String(reference.id), {
    property_id: propertyId,
    room_id: roomId,
    provider_instance_id: instance.id,
    provider_credential_id: providerResult.providerCredentialId,
    assignment_reference: request.assignmentReference,
    starts_at: request.startsAt,
    expires_at: request.expiresAt,
    credential_type: credentialType
  });

  return json({
    ok: true,
    credential: {
      id: reference.id,
      provider_credential_id: providerResult.providerCredentialId,
      status: 'issued',
      provider_status_code: providerResult.providerStatusCode ?? null
    }
  }, 201);
}

async function revoke(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.revoke');
  const body = await parseJson(req);
  const propertyId = propertyIdFrom(url, body);
  const credentialId = credentialIdFrom(url, body);
  if (!propertyId) throw hospitalityError('property_required', 422);
  if (!credentialId) throw hospitalityError('credential_required', 422);

  const reference: any = await loadCredentialReference(ctx.orgId, propertyId, credentialId);
  if (String(reference.status) === 'revoked') throw hospitalityError('credential_already_revoked', 409);

  const instance = await loadProviderInstance(
    ctx.orgId,
    propertyId,
    String(reference.provider_instance_id)
  );
  const adapter = providerFor(instance);
  const pctx = providerContext(ctx, instance);
  const providerReadiness = await adapter.readiness(pctx);
  requireProviderCapability(providerReadiness, 'credential.revoke');

  const providerResult = await adapter.revokeCredential(pctx, {
    providerCredentialId: String(reference.provider_credential_id),
    propertyId,
    roomId: String(reference.room_id),
    reason: clean(body.reason, 160) || 'authorized_revoke'
  });

  const updated = await updateCredentialReferenceStatus(
    ctx.orgId,
    propertyId,
    credentialId,
    'revoked',
    {
      revoked_at: new Date().toISOString(),
      provider_status_code: providerResult.providerStatusCode ?? null
    }
  );

  await writeHospitalityAudit(ctx.orgId, ctx.userId, 'hospitality.room_access.revoked', credentialId, {
    property_id: propertyId,
    room_id: reference.room_id,
    provider_instance_id: reference.provider_instance_id,
    provider_credential_id: reference.provider_credential_id,
    reason: clean(body.reason, 160) || 'authorized_revoke'
  });

  return json({ ok: true, credential: updated });
}

async function credentialStatus(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.read');
  const propertyId = propertyIdFrom(url);
  const credentialId = credentialIdFrom(url);
  if (!propertyId) throw hospitalityError('property_required', 422);
  if (!credentialId) throw hospitalityError('credential_required', 422);

  const reference: any = await loadCredentialReference(ctx.orgId, propertyId, credentialId);
  const derivedState = String(reference.status) === 'issued' && Date.parse(String(reference.expires_at)) <= Date.now()
    ? 'expired'
    : String(reference.status || 'unknown');

  const instance = await loadProviderInstance(
    ctx.orgId,
    propertyId,
    String(reference.provider_instance_id)
  );
  const adapter = providerFor(instance);
  const pctx = providerContext(ctx, instance);
  const providerReadiness = await adapter.readiness(pctx);

  if (
    providerReadiness.state === 'ready' &&
    providerReadiness.capabilities.includes('credential.status') &&
    adapter.credentialStatus
  ) {
    const result = await adapter.credentialStatus(pctx, String(reference.provider_credential_id));
    return json({ ok: true, credential: { id: credentialId, ...result }, source: 'provider' });
  }

  return json({
    ok: true,
    credential: {
      id: credentialId,
      provider_credential_id: reference.provider_credential_id,
      state: derivedState,
      provider_status_code: reference.provider_status_code ?? null
    },
    source: 'atlas_reference'
  });
}

async function audit(req: Request, url: URL) {
  const ctx = await resolveContext(req);
  requireHospitalityPermission(ctx, 'hospitality.access.audit');
  const propertyId = propertyIdFrom(url);
  if (!propertyId) throw hospitalityError('property_required', 422);
  return json({ ok: true, audit: await listHospitalityAudit(ctx.orgId, propertyId) });
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  if (req.method === 'OPTIONS') return optionsResponse(origin);

  const url = new URL(req.url);
  const operation = url.searchParams.get('api') as Operation | null;

  try {
    if (!operation || !OPERATIONS.includes(operation)) throw hospitalityError('not_found', 404);
    if (req.method === 'GET' && operation === 'readiness') return withCors(await readiness(req, url), origin);
    if (req.method === 'GET' && operation === 'providers') return withCors(await providers(req, url), origin);
    if (req.method === 'GET' && operation === 'rooms') return withCors(await rooms(req, url), origin);
    if (req.method === 'GET' && operation === 'credentials') return withCors(await credentials(req, url), origin);
    if (req.method === 'POST' && operation === 'issue') return withCors(await issue(req, url), origin);
    if (req.method === 'POST' && operation === 'revoke') return withCors(await revoke(req, url), origin);
    if (req.method === 'GET' && operation === 'credential-status') return withCors(await credentialStatus(req, url), origin);
    if (req.method === 'GET' && operation === 'audit') return withCors(await audit(req, url), origin);
    throw hospitalityError('method_not_allowed', 405);
  } catch (error) {
    return withCors(errorResponse(error), origin);
  }
});
