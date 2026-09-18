const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "connect-src 'self' https://ggmanzcgtlrvqfoccgsh.supabase.co wss://ggmanzcgtlrvqfoccgsh.supabase.co",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self'",
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join('; ');

interface AssetsBinding {
  fetch(request: Request): Promise<Response> | Response;
}

interface WorkerVersionMetadata {
  id: string;
  tag?: string;
  timestamp: string;
}

interface Env {
  ASSETS: AssetsBinding;
  CF_VERSION_METADATA?: WorkerVersionMetadata;
}

function withSecurityHeaders(response: Response, version?: WorkerVersionMetadata): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=()');
  headers.set('X-Frame-Options', 'DENY');
  if (version?.id) headers.set('X-Atlas-Version-Id', version.id);
  if (version?.tag) headers.set('X-Atlas-Version-Tag', version.tag);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return withSecurityHeaders(await env.ASSETS.fetch(request), env.CF_VERSION_METADATA);
  }
};
