import { resolveSecurityContext } from './_shared/context.ts';
import { SecurityProtectionError, securityErrorResponse } from './_shared/errors.ts';
import {
  authorizeProtectedAction,
  cancelSecurityDelay,
  getRecoveryStatus,
  getSecurityDevice,
  getSecuritySummary,
  hasValidStepUpGrant,
  listSecurityDelays,
  listSecurityDevices,
  recordRiskEvaluation,
  revokeSecurityDevice,
  trustSecurityDevice
} from './_shared/repository.ts';
import { evaluateProtectedActionRisk } from './_shared/risk.ts';
import { revokeOtherSecuritySessions } from './_shared/sessions.ts';
import {
  authenticationOptions,
  registrationOptions,
  verifyAuthentication,
  verifyRegistration
} from './_shared/webauthn.ts';

const ALLOWED_ORIGINS = new Set([
  'https://www.atlasenterprisesuite.com',
  'https://atlasenterprisesuite.com',
  'http://localhost:5173'
]);

const OPERATIONS = new Set([
  'passkeys.registration.options',
  'passkeys.registration.verify',
  'passkeys.authentication.options',
  'passkeys.authentication.verify',
  'summary',
  'devices.list',
  'devices.trust',
  'devices.revoke',
  'sessions.revoke',
  'risk.evaluate',
  'protected_action.authorize',
  'delays.list',
  'delays.cancel',
  'recovery.status'
]);

const PROTECTED_ACTIONS = new Set([
  'account.password.change',
  'account.recovery.change',
  'account.passkey.remove',
  'account.protection.disable',
  'account.delete',
  'admin.role.grant',
  'admin.role.revoke',
  'payout.destination.change',
  'api_key.create_privileged',
  'api_key.revoke_privileged',
  'session.revoke_others',
  'device.trust',
  'device.revoke'
]);

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin) ? origin : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, content-type, apikey, x-client-info',
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-max-age': '600',
    vary: 'Origin'
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(req),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer'
    }
  });
}

function stringField(body: Record<string, unknown>, key: string, required = true): string {
  const value = typeof body[key] === 'string' ? String(body[key]).trim() : '';
  if (required && !value) throw new SecurityProtectionError('invalid_request', 400);
  return value;
}

function protectedAction(body: Record<string, unknown>): string {
  const actionCode = stringField(body, 'actionCode');
  if (!PROTECTED_ACTIONS.has(actionCode)) throw new SecurityProtectionError('invalid_request', 400);
  return actionCode;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'invalid_request' }, 405);

  try {
    const context = await resolveSecurityContext(req);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.operation !== 'string') throw new SecurityProtectionError('invalid_request', 400);
    const operation = body.operation;
    if (!OPERATIONS.has(operation)) throw new SecurityProtectionError('invalid_operation', 400);

    let data: unknown;
    switch (operation) {
      case 'passkeys.registration.options':
        data = await registrationOptions(context);
        break;
      case 'passkeys.registration.verify':
        data = await verifyRegistration(context, {
          challengeId: stringField(body, 'challengeId'),
          response: body.response as never
        });
        break;
      case 'passkeys.authentication.options':
        data = await authenticationOptions(context, {
          actionCode: protectedAction(body),
          deviceId: stringField(body, 'deviceId', false) || null
        });
        break;
      case 'passkeys.authentication.verify':
        data = await verifyAuthentication(context, {
          challengeId: stringField(body, 'challengeId'),
          response: body.response as never
        });
        break;
      case 'summary':
        data = await getSecuritySummary(context);
        break;
      case 'devices.list':
        data = await listSecurityDevices(context);
        break;
      case 'devices.trust':
        data = await trustSecurityDevice(
          context,
          stringField(body, 'deviceId'),
          stringField(body, 'reason'),
          stringField(body, 'grantId')
        );
        break;
      case 'devices.revoke':
        data = await revokeSecurityDevice(
          context,
          stringField(body, 'deviceId'),
          stringField(body, 'reason'),
          stringField(body, 'grantId')
        );
        break;
      case 'sessions.revoke':
        data = await revokeOtherSecuritySessions(context, {
          reason: stringField(body, 'reason'),
          grantId: stringField(body, 'grantId')
        });
        break;
      case 'risk.evaluate': {
        const actionCode = protectedAction(body);
        const deviceId = stringField(body, 'deviceId');
        const grantId = stringField(body, 'grantId', false) || null;
        const device = await getSecurityDevice(context, deviceId);
        const recovery = await getRecoveryStatus(context);
        const passkeyVerified = await hasValidStepUpGrant(context, grantId, actionCode, deviceId);
        const evaluation = evaluateProtectedActionRisk({
          actionCode: actionCode as never,
          device,
          passkeyVerified,
          evidence: {
            recoveryHold: recovery.holdActive,
            networkReputation: 'unknown',
            locationConsistency: 'unknown',
            simEvidence: 'unknown'
          }
        });
        const riskEventId = await recordRiskEvaluation(context, actionCode, deviceId, evaluation);
        data = { ...evaluation, riskEventId };
        break;
      }
      case 'protected_action.authorize':
        data = await authorizeProtectedAction(context, {
          actionCode: protectedAction(body),
          deviceId: stringField(body, 'deviceId'),
          grantId: stringField(body, 'grantId', false) || null,
          riskEventId: stringField(body, 'riskEventId'),
          targetReference: stringField(body, 'targetReference', false) || null,
          configuredDelaySeconds: typeof body.configuredDelaySeconds === 'number' ? body.configuredDelaySeconds : null
        });
        break;
      case 'delays.list':
        data = await listSecurityDelays(context);
        break;
      case 'delays.cancel':
        data = await cancelSecurityDelay(context, stringField(body, 'delayId'), stringField(body, 'reason'));
        break;
      case 'recovery.status':
        data = await getRecoveryStatus(context);
        break;
      default:
        throw new SecurityProtectionError('invalid_operation', 400);
    }

    return json(req, { ok: true, data });
  } catch (error) {
    const response = securityErrorResponse(error);
    const headers = new Headers(response.headers);
    for (const [key, value] of Object.entries(corsHeaders(req))) headers.set(key, value);
    return new Response(response.body, { status: response.status, headers });
  }
});
