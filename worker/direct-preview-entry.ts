interface Env {
  ASSETS: Fetcher;
}

const noStoreHeaders = {
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; media-src 'self' blob:; base-uri 'none'; object-src 'none'; frame-ancestors 'none'"
};

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: noStoreHeaders });
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const isDirect = path === '/' || path === '/connect/direct' || path === '/connect/direct/';
    const allowedAsset = /^\/(?:assets\/[^/]+|source-sha\.txt|direct-preview\.html)$/.test(path);
    if (!isDirect && !allowedAsset) {
      return new Response('ATLAS Direct preview: unavailable route', { status: 404, headers: noStoreHeaders });
    }
    const assetUrl = new URL(isDirect ? '/direct-preview.html' : path, request.url);
    const response = await env.ASSETS.fetch(new Request(assetUrl, request));
    const headers = new Headers(response.headers);
    for (const [name, value] of Object.entries(noStoreHeaders)) headers.set(name, value);
    if (isDirect && response.ok) headers.set('content-type', 'text/html; charset=utf-8');
    return new Response(response.body, { status: response.status, headers });
  }
} satisfies ExportedHandler<Env>;
