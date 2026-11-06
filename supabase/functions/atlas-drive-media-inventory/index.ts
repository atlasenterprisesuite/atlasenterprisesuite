import { registerDriveMedia } from '../../../packages/core/src/driveMediaInventory';

const DEFAULT_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_BODY_BYTES = 16_384;

export type DriveMediaEdgeDependencies = {
  fetchImpl?: typeof fetch;
  env?: (name: string) => string | undefined;
};

function serverEnv(name: string, deps: DriveMediaEdgeDependencies): string {
  const deno = (globalThis as { Deno?: { env?: { get(name: string): string | undefined } } }).Deno;
  return (deps.env?.(name) ?? deno?.env?.get(name) ?? '').trim();
}

function json(status: number, payload: unknown, cors: Record<string, string>): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors }
  });
}

function corsFor(req: Request): Record<string, string> | null {
  const origin = req.headers.get('Origin');
  if (!origin) return {};
  if (!DEFAULT_ORIGINS.has(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    Vary: 'Origin'
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

/**
 * Authenticated validation-only boundary. It stores no records, fetches no Drive media,
 * and publishes nothing. Uses the canonical Supabase identity-permission RPC.
 * Only server-verified permission grants can create an AuthorizationContext.
 */
export async function handleDriveMediaInventoryRequest(
  req: Request,
  deps: DriveMediaEdgeDependencies = {}
): Promise<Response> {
  const cors = corsFor(req);
  if (cors === null) return json(403, { error: 'ORIGIN_DENIED' }, {});
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
  if (req.method !== 'POST') return json(405, { error: 'METHOD_NOT_ALLOWED' }, cors);

  const bearer = req.headers.get('Authorization') ?? '';
  const token = /^Bearer\s+(.+)$/i.exec(bearer)?.[1]?.trim();
  if (!token) return json(401, { error: 'AUTHENTICATION_REQUIRED' }, cors);

  const url = serverEnv('SUPABASE_URL', deps).replace(/\/$/, '');
  const key = serverEnv('SUPABASE_ANON_KEY', deps);
  if (!/^https:\/\//.test(url) || !key) {
    return json(503, { error: 'IDENTITY_BACKEND_UNAVAILABLE' }, cors);
  }

  if (Number(req.headers.get('Content-Length') ?? 0) > MAX_BODY_BYTES) {
    return json(413, { error: 'REQUEST_TOO_LARGE' }, cors);
  }
  let input: Record<string, unknown> | null;
  try {
    const raw = await req.text();
    if (raw.length > MAX_BODY_BYTES) return json(413, { error: 'REQUEST_TOO_LARGE' }, cors);
    input = record(JSON.parse(raw));
  } catch {
    return json(400, { error: 'INVALID_JSON' }, cors);
  }
  if (!input) return json(400, { error: 'INVALID_BODY' }, cors);
  // Never trust an actor, permission, or tenant scope supplied by the caller.
  if (['scope', 'tenantId', 'actor', 'permissions'].some((field) => field in input)) {
    return json(400, { error: 'CLIENT_IDENTITY_CLAIM_DENIED' }, cors);
  }
  const orgId = input.organizationId;
  if (typeof orgId !== 'string' || !UUID.test(orgId)) {
    return json(400, { error: 'INVALID_ORGANIZATION_ID' }, cors);
  }

  const authHeaders = { apikey: key, Authorization: 'Bearer ' + token };
  const fetcher = deps.fetchImpl ?? fetch;
  try {
    const sessionResponse = await fetcher(url + '/auth/v1/user', {
      headers: authHeaders, method: 'GET'
    });
    if (!sessionResponse.ok) return json(401, { error: 'INVALID_SESSION' }, cors);
    const session = record(await sessionResponse.json());
    if (typeof session?.id !== 'string' || !UUID.test(session.id)) {
      return json(401, { error: 'INVALID_SESSION' }, cors);
    }

    const grantResponse = await fetcher(url + '/rest/v1/rpc/has_identity_permission', {
      method: 'POST',
      headers: { ...authHeaders, 'Content-Type': 'application/json' },
      body: JSON.stringify({ o: orgId, p: 'integrations.write' })
    });
    if (!grantResponse.ok) return json(503, { error: 'PERMISSION_CHECK_UNAVAILABLE' }, cors);
    const grant = await grantResponse.json();
    if (grant !== true) {
      return json(403, { error: 'MEDIA_ACCESS_DENIED' }, cors);
    }

    // Current ATLAS persistence models use organization ID for both tenant and org scope.
    // This mapping must be reverified before future support for distinct tenant IDs.
    const scope = { tenantId: orgId, organizationId: orgId };
    const asset = registerDriveMedia({
      scope,
      driveFileId: String(input.driveFileId ?? ''),
      name: String(input.name ?? ''),
      mimeType: String(input.mimeType ?? ''),
      sha256: String(input.sha256 ?? ''),
      collection: input.collection === 'chatgpt-library' ? 'chatgpt-library' : 'production-covers'
    }, { scope, permissions: ['integrations.write'] });

    // No persisted record, Drive identifier, source image, or rights claim in the response.
    return json(200, {
      status: 'validated_only',
      moduleId: asset.moduleId,
      sensitivity: asset.sensitivity,
      publishable: false,
      reviewStatus: 'pending',
      rightsStatus: 'unverified'
    }, cors);
  } catch (error) {
    if (error instanceof Error && [
      'INVALID_DRIVE_ID', 'INVALID_SHA256', 'UNSUPPORTED_MEDIA_TYPE', 'INVALID_MEDIA_NAME'
    ].includes(error.message)) {
      return json(400, { error: error.message }, cors);
    }
    return json(503, { error: 'IDENTITY_VERIFICATION_UNAVAILABLE' }, cors);
  }
}

const denoRuntime = (globalThis as {
  Deno?: { serve?: (handler: (req: Request) => Promise<Response>) => unknown }
}).Deno;
if (denoRuntime?.serve) denoRuntime.serve((req) => handleDriveMediaInventoryRequest(req));
