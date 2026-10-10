/**
 * Public weather read gateway on the existing ATLAS Cloudflare Worker.
 * No tenant data, arbitrary upstream URLs, credentials or provider claims.
 */
const MET = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const NWS = 'https://api.weather.gov';
const UA = 'ATLAS-Enterprise-Suite-Weather/1.0 (+https://www.atlasenterprisesuite.com)';
const CACHE_BASE = '/api/v1/weather';

type CacheEdge = {
  match(request: Request): Promise<Response | undefined>;
  put(request: Request, response: Response): Promise<void>;
};

function edgeCache(): CacheEdge | undefined {
  return (globalThis as typeof globalThis & { caches?: { default?: CacheEdge } }).caches?.default;
}

function responseJson(payload: unknown, status = 200, ttl = 0): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': ttl ? `public, max-age=${ttl}` : 'no-store',
      'x-content-type-options': 'nosniff'
    }
  });
}

function safeParams(url: URL): { lat: string; lon: string } | null {
  const a = url.searchParams.get('lat');
  const b = url.searchParams.get('lon');
  if (!a || !b || !/^-?\d{1,3}(?:\.\d{1,4})?$/.test(a) || !/^-?\d{1,3}(?:\.\d{1,4})?$/.test(b)) return null;
  const lat = Number(a);
  const lon = Number(b);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  return { lat: lat.toFixed(2), lon: lon.toFixed(2) };
}

function nwsCoverage(lat: number, lon: number): boolean {
  return (
    (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) ||
    (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129) ||
    (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) ||
    (lat >= 17 && lat <= 19 && lon >= -68 && lon <= -65)
  );
}

function upstreamHeaders() {
  return { 'User-Agent': UA, Accept: 'application/json' };
}

async function upstreamJson(url: string): Promise<{ payload: unknown; expires: string | null }> {
  const response = await fetch(url, { headers: upstreamHeaders(), redirect: 'follow' });
  if (!response.ok) throw new Error(`provider_status_${response.status}`);
  return { payload: await response.json(), expires: response.headers.get('Expires') };
}

async function cached(request: Request, ttl: number, producer: () => Promise<Response>): Promise<Response> {
  const cache = edgeCache();
  if (cache) {
    const hit = await cache.match(request);
    if (hit) return hit;
  }
  const fresh = await producer();
  if (fresh.ok && cache && ttl > 0) {
    await cache.put(request, fresh.clone()).catch(() => undefined);
  }
  return fresh;
}

function expireTtl(value: string | null): number {
  const expiry = Date.parse(value || '');
  return Number.isFinite(expiry) && expiry > Date.now()
    ? Math.max(1, Math.ceil((expiry - Date.now()) / 1000))
    : 1800;
}

async function forecast(request: Request, coords: { lat: string; lon: string }): Promise<Response> {
  const key = new URL(request.url);
  key.search = new URLSearchParams(coords).toString();
  const cacheRequest = new Request(key.toString(), { method: 'GET' });
  // The origin's Expires is honoured on every successful response.
  const cache = edgeCache();
  const hit = await cache?.match(cacheRequest);
  if (hit) return hit;
  const url = new URL(MET);
  url.searchParams.set('lat', coords.lat);
  url.searchParams.set('lon', coords.lon);
  const result = await upstreamJson(url.toString());
  const ttl = expireTtl(result.expires);
  const response = responseJson(result.payload, 200, ttl);
  response.headers.set('Expires', new Date(Date.now() + ttl * 1000).toUTCString());
  response.headers.set('x-atlas-data-provider', 'met-norway-forecast');
  if (cache) await cache.put(cacheRequest, response.clone()).catch(() => undefined);
  return response;
}

async function alerts(request: Request, coords: { lat: string; lon: string }): Promise<Response> {
  if (!nwsCoverage(Number(coords.lat), Number(coords.lon))) return responseJson({ features: [] });
  const url = new URL(`${NWS}/alerts/active`);
  url.searchParams.set('point', `${coords.lat},${coords.lon}`);
  const key = new URL(request.url);
  key.search = new URLSearchParams(coords).toString();
  return cached(new Request(key.toString()), 180, async () => {
    const { payload } = await upstreamJson(url.toString());
    return responseJson(payload, 200, 180);
  });
}

function getRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

async function observation(request: Request, coords: { lat: string; lon: string }): Promise<Response> {
  if (!nwsCoverage(Number(coords.lat), Number(coords.lon))) return responseJson(null);
  const key = new URL(request.url);
  key.search = new URLSearchParams(coords).toString();
  return cached(new Request(key.toString()), 300, async () => {
    const location = await upstreamJson(`${NWS}/points/${coords.lat},${coords.lon}`);
    const source = getRecord(location.payload);
    const stationsLink = getRecord(source.properties).observationStations;
    if (typeof stationsLink !== 'string' || !stationsLink.startsWith(`${NWS}/gridpoints/`)) return responseJson(null, 200, 300);
    const stations = getRecord((await upstreamJson(stationsLink)).payload).features;
    if (!Array.isArray(stations) || !stations.length) return responseJson(null, 200, 300);
    const station = getRecord(getRecord(stations[0]).properties).stationIdentifier;
    if (typeof station !== 'string' || !/^[A-Z0-9]{3,6}$/.test(station)) return responseJson(null, 200, 300);
    const sourceUrl = `${NWS}/stations/${station}/observations/latest`;
    const latest = await upstreamJson(sourceUrl);
    return responseJson({ station, properties: getRecord(getRecord(latest.payload).properties), sourceUrl }, 200, 300);
  });
}

/** Returns null for non-weather paths; the existing ATLAS Worker owns everything else. */
export async function weatherGateway(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  if (!url.pathname.startsWith(`${CACHE_BASE}/`)) return null;
  if (request.method !== 'GET') return responseJson({ error: 'method_not_allowed' }, 405);
  if (!['/forecast', '/alerts', '/observations'].some(path => url.pathname === CACHE_BASE + path)) {
    return responseJson({ error: 'not_found' }, 404);
  }
  const coords = safeParams(url);
  if (!coords) return responseJson({ error: 'invalid_coordinates' }, 400);
  try {
    if (url.pathname === `${CACHE_BASE}/forecast`) return await forecast(request, coords);
    if (url.pathname === `${CACHE_BASE}/alerts`) return await alerts(request, coords);
    return await observation(request, coords);
  } catch {
    // Do not leak internal network/service details or represent failure as a clear sky.
    return responseJson({ error: 'official_weather_provider_unavailable' }, 503);
  }
}
