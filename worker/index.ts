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

interface Env {
  ASSETS: AssetsBinding;
}

function withSecurityHeaders(response: Response, commitSha: string | null): Response {
  const headers = new Headers(response.headers);
  headers.set('Content-Security-Policy', CONTENT_SECURITY_POLICY);
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('Permissions-Policy', 'camera=(), geolocation=(), payment=(), usb=()');
  headers.set('X-Frame-Options', 'DENY');
  if (commitSha) headers.set('X-Atlas-Commit-Sha', commitSha);

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}

async function readCommitSha(request: Request, env: Env): Promise<string | null> {
  try {
    const manifestUrl = new URL('/deployment.json', request.url);
    const manifestResponse = await env.ASSETS.fetch(new Request(manifestUrl, {
      method: 'GET',
      headers: { accept: 'application/json', 'cache-control': 'no-cache, no-store' }
    }));
    if (!manifestResponse.ok) return null;
    const manifest = await manifestResponse.json() as { commit_sha?: unknown };
    const commitSha = typeof manifest.commit_sha === 'string' ? manifest.commit_sha.trim() : '';
    return /^[A-Za-z0-9._-]{7,128}$/.test(commitSha) ? commitSha : null;
  } catch {
    return null;
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const [response, commitSha] = await Promise.all([
      env.ASSETS.fetch(request),
      readCommitSha(request, env)
    ]);
    return withSecurityHeaders(response, commitSha);
  }
};
