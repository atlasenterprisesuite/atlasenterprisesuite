import worker, { AtlasChatRealtimeBus, AtlasLocalRealtimeBus } from './index';
import { weatherGateway } from './weatherGateway';

export { AtlasChatRealtimeBus, AtlasLocalRealtimeBus };

type VersionMetadata = {
  id?: string;
  tag?: string;
};

type Env = {
  CF_VERSION_METADATA?: VersionMetadata;
  [key: string]: unknown;
};

async function machineHealth(request: Request, env: Env): Promise<Response> {
  const statusUrl = new URL('/status', request.url);
  const statusRequest = new Request(statusUrl, {
    method: 'GET',
    headers: {
      accept: 'application/json',
      'cache-control': 'no-store'
    }
  });

  const statusResponse = await worker.fetch(statusRequest, env as never);
  const statusPayload = await statusResponse.json().catch(() => null) as {
    status?: string;
    service?: string;
    environment?: string;
    release?: unknown;
  } | null;
  const healthy = statusResponse.ok && statusPayload?.status === 'ok';
  const headers = new Headers(statusResponse.headers);
  headers.set('content-type', 'application/json; charset=utf-8');
  headers.set('cache-control', 'no-store');

  return new Response(JSON.stringify({
    status: healthy ? 'healthy' : 'unhealthy',
    service: statusPayload?.service || 'atlas-enterprise-suite-web',
    environment: statusPayload?.environment || 'production',
    release: statusPayload?.release || null,
    checked_at: new Date().toISOString()
  }), {
    status: healthy ? 200 : 503,
    headers
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/v1/weather/')) {
      return (await weatherGateway(request)) || new Response(null, { status: 404 });
    }
    if (request.method === 'GET' && url.pathname === '/api/v1/health') {
      return machineHealth(request, env);
    }
    return worker.fetch(request, env as never);
  }
};
