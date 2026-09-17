import { resolveSecurityContext } from './_shared/context.ts';
import { SecurityProtectionError, securityErrorResponse } from './_shared/errors.ts';
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

const WEBAUTHN_OPERATIONS = new Set([
  'passkeys.registration.options',
  'passkeys.registration.verify',
  'passkeys.authentication.options',
  'passkeys.authentication.verify'
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'invalid_request' }, 405);

  try {
    const context = await resolveSecurityContext(req);
    const body = await req.json().catch(() => null) as Record<string, unknown> | null;
    if (!body || typeof body.operation !== 'string') throw new SecurityProtectionError('invalid_request', 400);
    const operation = body.operation;
    if (!WEBAUTHN_OPERATIONS.has(operation)) throw new SecurityProtectionError('invalid_operation', 400);

    let data: unknown;
    switch (operation) {
      case 'passkeys.registration.options':
        data = await registrationOptions(context);
        break;
      case 'passkeys.registration.verify':
        data = await verifyRegistration(context, {
          challengeId: String(body.challengeId || ''),
          response: body.response as never
        });
        break;
      case 'passkeys.authentication.options':
        data = await authenticationOptions(context, {
          actionCode: String(body.actionCode || ''),
          deviceId: body.deviceId ? String(body.deviceId) : null
        });
        break;
      case 'passkeys.authentication.verify':
        data = await verifyAuthentication(context, {
          challengeId: String(body.challengeId || ''),
          response: body.response as never
        });
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
