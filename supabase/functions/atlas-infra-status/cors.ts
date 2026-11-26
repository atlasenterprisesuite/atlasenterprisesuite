/**
 * Browser-facing CORS boundary for ATLAS Manager infrastructure status.
 * Response may contain organization-scoped operational details, so do not
 * use wildcard origins or allow credentials. Auth remains required on GET.
 */
const ALLOWED_INFRA_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'https://ggmanzcgtlrvqfoccgsh.supabase.co'
]);

export function atlasInfraCorsHeaders(origin: string | null): Record<string, string> {
  const headers: Record<string, string> = { vary: 'Origin' };
  if (!origin || !ALLOWED_INFRA_ORIGINS.has(origin)) return headers;
  return {
    ...headers,
    'access-control-allow-origin': origin,
    'access-control-allow-methods': 'GET, OPTIONS',
    'access-control-allow-headers': 'authorization,apikey,content-type,x-atlas-org-id,x-client-info',
    'access-control-max-age': '600'
  };
}

export function atlasInfraPreflightResponse(request: Request): Response {
  const origin = request.headers.get('origin');
  return new Response(null, {
    status: origin && ALLOWED_INFRA_ORIGINS.has(origin) ? 204 : 403,
    headers: atlasInfraCorsHeaders(origin)
  });
}
