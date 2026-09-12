const BASE_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer'
};

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com'
]);

export function creatorError(code: string, status = 400, details: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { code, status, ...details });
}

export function corsHeaders(origin: string | null) {
  if (!origin || !ALLOWED_ORIGINS.has(origin)) return {};
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'GET, POST, OPTIONS',
    'access-control-max-age': '86400',
    vary: 'Origin'
  };
}

export function optionsResponse(origin: string | null) {
  return new Response(null, {
    status: 204,
    headers: { ...BASE_HEADERS, ...corsHeaders(origin) }
  });
}

export function withCors(response: Response, origin: string | null) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(origin))) headers.set(key, value);
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export function creatorErrorResponse(error: unknown) {
  const value = error as { code?: string; status?: number };
  return new Response(JSON.stringify({ ok: false, error: value.code || 'internal_error' }), {
    status: value.status || 500,
    headers: BASE_HEADERS
  });
}
