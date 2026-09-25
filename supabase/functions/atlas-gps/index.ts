import { createClient } from 'npm:@supabase/supabase-js@2.95.0';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || '';
const PUBLISHABLE_KEY =
  Deno.env.get('SUPABASE_ANON_KEY') ||
  Deno.env.get('SUPABASE_PUBLISHABLE_KEY') ||
  '';
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
const OSRM_BASE_URL = (Deno.env.get('ATLAS_GPS_OSRM_BASE_URL') || 'https://router.project-osrm.org').replace(/\/$/, '');
const NOMINATIM_BASE_URL = (Deno.env.get('ATLAS_GPS_NOMINATIM_BASE_URL') || 'https://nominatim.openstreetmap.org').replace(/\/$/, '');
const OVERPASS_BASE_URL = (Deno.env.get('ATLAS_GPS_OVERPASS_BASE_URL') || 'https://overpass-api.de/api/interpreter').replace(/\/$/, '');
const MAX_REQUEST_BYTES = 32 * 1024;

const ALLOWED_ORIGINS = new Set([
  'https://atlasenterprisesuite.com',
  'https://www.atlasenterprisesuite.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173'
]);

type Json = Record<string, unknown>;
type Context = { userId: string; orgId: string; role: string };

class EdgeError extends Error {
  constructor(readonly code: string, readonly status: number) {
    super(code);
    this.name = 'EdgeError';
  }
}

function corsHeaders(req: Request) {
  const origin = req.headers.get('origin') || '';
  return {
    'access-control-allow-origin': ALLOWED_ORIGINS.has(origin)
      ? origin
      : 'https://www.atlasenterprisesuite.com',
    'access-control-allow-headers': 'authorization, apikey, content-type, x-atlas-org-id',
    'access-control-allow-methods': 'POST, OPTIONS',
    'cache-control': 'no-store',
    'content-type': 'application/json; charset=utf-8',
    'vary': 'Origin',
    'x-content-type-options': 'nosniff'
  };
}

function json(req: Request, data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders(req) });
}

function clean(value: unknown, max = 500) {
  return String(value ?? '').trim().slice(0, max);
}

function finiteNumber(value: unknown, code: string) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new EdgeError(code, 422);
  return number;
}

function adminClient() {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) throw new EdgeError('server_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
}

function userClient(req: Request) {
  if (!SUPABASE_URL || !PUBLISHABLE_KEY) throw new EdgeError('supabase_runtime_not_configured', 503);
  return createClient(SUPABASE_URL, PUBLISHABLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: req.headers.get('authorization') || '' } }
  });
}

async function resolveContext(req: Request, requestedOrgId: string): Promise<Context> {
  const token = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!token) throw new EdgeError('authentication_required', 401);

  const sb = userClient(req);
  const { data: authData, error: authError } = await sb.auth.getUser(token);
  if (authError || !authData.user) throw new EdgeError('invalid_session', 401);

  let query = sb
    .from('organization_members')
    .select('org_id,role,status')
    .eq('user_id', authData.user.id)
    .eq('status', 'active');

  if (requestedOrgId) query = query.eq('org_id', requestedOrgId);
  const { data, error } = await query.limit(1);
  const membership = data?.[0];
  if (error || !membership?.org_id) throw new EdgeError('membership_required', 403);

  return {
    userId: authData.user.id,
    orgId: String(membership.org_id),
    role: String(membership.role || 'member')
  };
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

type GpsProvider = 'nominatim' | 'osrm' | 'overpass';

async function readCache(provider: GpsProvider, keyMaterial: string) {
  const admin = adminClient();
  const cacheKey = await sha256(provider + ':' + keyMaterial);
  const { data } = await admin
    .from('atlas_gps_provider_cache')
    .select('payload,expires_at')
    .eq('cache_key', cacheKey)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  return { cacheKey, payload: data?.payload || null };
}

async function writeCache(cacheKey: string, provider: GpsProvider, payload: unknown, ttlSeconds: number) {
  const admin = adminClient();
  const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();
  await admin.from('atlas_gps_provider_cache').upsert({
    cache_key: cacheKey,
    provider,
    payload,
    expires_at: expiresAt
  });
}

async function acquireProviderSlot(provider: 'nominatim' | 'overpass', minIntervalMs: number) {
  const admin = adminClient();
  const { data, error } = await admin.rpc('atlas_gps_acquire_provider_slot', {
    p_provider: provider,
    p_min_interval_ms: minIntervalMs
  });
  if (error) throw new EdgeError('provider_throttle_unavailable', 503);
  return data === true;
}

async function acquireNominatimSlot() {
  return acquireProviderSlot('nominatim', 1000);
}

async function acquireOverpassSlot() {
  return acquireProviderSlot('overpass', 2000);
}

function capabilities() {
  return {
    renderer: {
      maplibre: { state: 'external_public', cost_policy: '$0', verified_sla: false },
      street: { state: 'external_public', provider: 'OpenFreeMap/OpenStreetMap', verified_sla: false },
      satellite_us: { state: 'public_data', provider: 'USGS The National Map', coverage: 'United States', verified_sla: false },
      terrain_3d: { state: 'external_public', provider: 'Mapterhorn', verified_sla: false }
    },
    navigation: {
      gps: { state: 'browser_permission' },
      routing: { state: 'external_gated', provider: 'OSRM demo/default unless ATLAS_GPS_OSRM_BASE_URL is configured', verified_sla: false },
      geocoding: { state: 'external_gated', provider: 'Nominatim default unless ATLAS_GPS_NOMINATIM_BASE_URL is configured', verified_sla: false, throttle: '1 request/second app-wide' },
      turn_by_turn: { state: 'available_from_route_steps' },
      lane_guidance: { state: 'available_when_upstream_route_intersections_include_lanes' },
      rerouting: { state: 'client_navigation_logic' },
      voice_guidance: { state: 'browser_speech_synthesis' },
      indoor_osm: {
        state: 'external_gated',
        provider: 'OpenStreetMap Simple Indoor Tagging via public Overpass default unless ATLAS_GPS_OVERPASS_BASE_URL is configured',
        verified_sla: false,
        cache: '6 hours',
        scope: 'bounded building-area lookup only'
      }
    },
    gated: {
      realtime_traffic: { state: 'blocked', reason: 'authorized_live_traffic_provider_required' },
      live_incidents: { state: 'blocked', reason: 'authoritative_incident_provider_required' },
      street_level_imagery: { state: 'blocked', reason: 'authorized_street_level_provider_required' },
      transit_realtime: { state: 'blocked', reason: 'gtfs_realtime_or_otp_adapter_required' },
      offline_world_tiles: { state: 'blocked', reason: 'self_hosted_pmtiles_or_licensed_offline_source_required' }
    }
  };
}

async function searchPlaces(queryText: string, language: string) {
  const q = clean(queryText, 160);
  if (q.length < 2) throw new EdgeError('search_query_required', 422);
  const lang = clean(language || 'es', 16).replace(/[^a-zA-Z,-]/g, '') || 'es';
  const keyMaterial = JSON.stringify({ q: q.toLowerCase(), lang });
  const cached = await readCache('nominatim', keyMaterial);
  if (cached.payload) return { source: 'cache', results: cached.payload };

  if (!await acquireNominatimSlot()) throw new EdgeError('nominatim_rate_limited', 429);

  const url = new URL('/search', NOMINATIM_BASE_URL);
  url.searchParams.set('format', 'jsonv2');
  url.searchParams.set('limit', '8');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('q', q);

  const response = await fetch(url, {
    headers: {
      'accept-language': lang,
      'user-agent': 'ATLAS-GPS-4D/1.0 (https://www.atlasenterprisesuite.com/gps)'
    },
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new EdgeError('geocoder_unavailable', 502);

  const rows = await response.json().catch(() => []) as any[];
  const results = Array.isArray(rows) ? rows.slice(0, 8).map((row) => ({
    id: String(row.place_id || row.osm_id || ''),
    lat: Number(row.lat),
    lon: Number(row.lon),
    label: clean(row.display_name, 320),
    category: clean(row.category || row.type, 80),
    type: clean(row.type, 80),
    importance: Number(row.importance || 0),
    boundingbox: Array.isArray(row.boundingbox) ? row.boundingbox.map(Number) : null
  })).filter((row) => Number.isFinite(row.lat) && Number.isFinite(row.lon)) : [];

  await writeCache(cached.cacheKey, 'nominatim', results, 24 * 60 * 60);
  return { source: 'nominatim', results };
}


function normalizeIndoorTags(tags: Record<string, unknown> | undefined) {
  if (!tags) return {};
  const allowed = [
    'indoor',
    'level',
    'level:ref',
    'name',
    'ref',
    'room',
    'highway',
    'entrance',
    'door',
    'wheelchair',
    'access',
    'conveying',
    'repeat_on',
    'building',
    'building:part'
  ];
  return Object.fromEntries(
    allowed
      .filter((key) => tags[key] !== undefined)
      .map((key) => [key, clean(tags[key], 160)])
  );
}

function splitIndoorLevels(value: unknown) {
  const raw = clean(value, 160);
  if (!raw) return [];
  const levels = new Set<string>();
  for (const token of raw.split(';').map((item) => item.trim()).filter(Boolean)) {
    const range = token.match(/^(-?\d+)-(-?\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      if (Number.isInteger(start) && Number.isInteger(end) && Math.abs(end - start) <= 30) {
        const step = start <= end ? 1 : -1;
        for (let value = start; value !== end + step; value += step) levels.add(String(value));
        continue;
      }
    }
    levels.add(token);
  }
  return [...levels].slice(0, 64);
}

async function lookupIndoor(input: Json) {
  const latitude = finiteNumber(input.latitude, 'latitude_invalid');
  const longitude = finiteNumber(input.longitude, 'longitude_invalid');
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) {
    throw new EdgeError('coordinates_out_of_range', 422);
  }

  const requestedRadius = Number(input.radius_m ?? 90);
  const radiusM = Number.isFinite(requestedRadius)
    ? Math.min(180, Math.max(20, Math.round(requestedRadius)))
    : 90;

  const keyMaterial = [latitude.toFixed(5), longitude.toFixed(5), String(radiusM)].join(',');
  const cached = await readCache('overpass', keyMaterial);
  if (cached.payload) return { source: 'cache', ...(cached.payload as Json) };

  if (!await acquireOverpassSlot()) throw new EdgeError('overpass_rate_limited', 429);

  const query = [
    '[out:json][timeout:10];',
    '(',
    `nwr(around:${radiusM},${latitude},${longitude})["indoor"];`,
    `nwr(around:${radiusM},${latitude},${longitude})["entrance"];`,
    `nwr(around:${radiusM},${latitude},${longitude})["highway"="elevator"];`,
    `nwr(around:${radiusM},${latitude},${longitude})["highway"="steps"];`,
    ');',
    'out center tags;'
  ].join('');

  const response = await fetch(OVERPASS_BASE_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded;charset=UTF-8',
      'user-agent': 'ATLAS-GPS-4D/1.0 (https://www.atlasenterprisesuite.com/gps)'
    },
    body: new URLSearchParams({ data: query }),
    signal: AbortSignal.timeout(12_000)
  });

  if (response.status === 429) throw new EdgeError('overpass_rate_limited', 429);
  if (!response.ok) throw new EdgeError('overpass_unavailable', 502);

  const payload = await response.json().catch(() => null) as any;
  const rawElements = Array.isArray(payload?.elements) ? payload.elements.slice(0, 600) : [];
  const features = rawElements.map((element: any) => {
    const tags = normalizeIndoorTags(element.tags);
    const lat = Number(element.lat ?? element.center?.lat);
    const lon = Number(element.lon ?? element.center?.lon);
    return {
      id: `${clean(element.type, 16)}/${String(element.id ?? '')}`,
      osm_type: clean(element.type, 16),
      lat: Number.isFinite(lat) ? lat : null,
      lon: Number.isFinite(lon) ? lon : null,
      tags
    };
  });

  const levelSet = new Set<string>();
  for (const feature of features) {
    for (const level of splitIndoorLevels((feature.tags as Record<string, unknown>).level)) {
      levelSet.add(level);
    }
  }

  const coverage = {
    available: features.some((feature: any) => Boolean(feature.tags.indoor)),
    feature_count: features.length,
    levels: [...levelSet].sort((a, b) => Number(a) - Number(b)),
    rooms: features.filter((feature: any) => feature.tags.indoor === 'room').length,
    corridors: features.filter((feature: any) => feature.tags.indoor === 'corridor').length,
    entrances: features.filter((feature: any) => Boolean(feature.tags.entrance)).length,
    vertical_connections: features.filter((feature: any) =>
      feature.tags.highway === 'elevator' || feature.tags.highway === 'steps'
    ).length
  };

  const normalized = {
    provider: 'openstreetmap-overpass',
    provider_state: 'external_gated',
    verified_sla: false,
    center: { lat: latitude, lon: longitude },
    radius_m: radiusM,
    coverage,
    features
  };

  await writeCache(cached.cacheKey, 'overpass', normalized, 6 * 60 * 60);
  return { source: 'overpass', ...normalized };
}

async function calculateRoute(input: Json) {
  const fromLat = finiteNumber(input.from_lat, 'from_lat_invalid');
  const fromLon = finiteNumber(input.from_lon, 'from_lon_invalid');
  const toLat = finiteNumber(input.to_lat, 'to_lat_invalid');
  const toLon = finiteNumber(input.to_lon, 'to_lon_invalid');
  if (Math.abs(fromLat) > 90 || Math.abs(toLat) > 90 || Math.abs(fromLon) > 180 || Math.abs(toLon) > 180) {
    throw new EdgeError('coordinates_out_of_range', 422);
  }

  const keyMaterial = [fromLat, fromLon, toLat, toLon].map((value) => value.toFixed(5)).join(',');
  const cached = await readCache('osrm', keyMaterial);
  if (cached.payload) return { source: 'cache', ...cached.payload as Json };

  const url = new URL(`/route/v1/driving/${fromLon},${fromLat};${toLon},${toLat}`, OSRM_BASE_URL);
  url.searchParams.set('overview', 'full');
  url.searchParams.set('geometries', 'geojson');
  url.searchParams.set('steps', 'true');
  url.searchParams.set('alternatives', 'true');
  url.searchParams.set('annotations', 'false');

  const response = await fetch(url, {
    headers: { 'user-agent': 'ATLAS-GPS-4D/1.0 (https://www.atlasenterprisesuite.com/gps)' },
    signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new EdgeError('routing_provider_unavailable', 502);
  const payload = await response.json().catch(() => null) as any;
  if (!payload || payload.code !== 'Ok' || !Array.isArray(payload.routes)) {
    throw new EdgeError('route_not_found', 404);
  }

  const routes = payload.routes.slice(0, 3).map((route: any, routeIndex: number) => ({
    id: `route-${routeIndex + 1}`,
    distance_m: Number(route.distance || 0),
    duration_s: Number(route.duration || 0),
    geometry: route.geometry,
    waypoints: Array.isArray(route.geometry?.coordinates)
      ? route.geometry.coordinates.map((coordinate: unknown) => {
          const pair = Array.isArray(coordinate) ? coordinate : [];
          return {
            lat: Number(pair[1]),
            lon: Number(pair[0])
          };
        }).filter((point: { lat: number; lon: number }) => Number.isFinite(point.lat) && Number.isFinite(point.lon))
      : [],
    steps: Array.isArray(route.legs)
      ? route.legs.flatMap((leg: any) => Array.isArray(leg.steps) ? leg.steps : []).map((step: any, stepIndex: number) => ({
          id: `${routeIndex + 1}-${stepIndex + 1}`,
          distance_m: Number(step.distance || 0),
          duration_s: Number(step.duration || 0),
          name: clean(step.name, 160),
          instruction_type: clean(step.maneuver?.type, 80),
          modifier: clean(step.maneuver?.modifier, 80),
          location: Array.isArray(step.maneuver?.location) ? step.maneuver.location.map(Number) : null,
          exit: Number.isFinite(Number(step.maneuver?.exit)) ? Number(step.maneuver.exit) : null,
          lanes: Array.isArray(step.intersections)
            ? step.intersections.flatMap((intersection: any) => Array.isArray(intersection.lanes) ? intersection.lanes : []).map((lane: any) => ({
                valid: lane.valid === true,
                active: lane.active === true,
                indications: Array.isArray(lane.indications) ? lane.indications.map((item: unknown) => clean(item, 32)) : []
              }))
            : []
        }))
      : []
  }));

  const normalized = { profile: 'driving', routes };
  await writeCache(cached.cacheKey, 'osrm', normalized, 10 * 60);
  return { source: 'osrm', ...normalized };
}

async function listSaved(context: Context) {
  const admin = adminClient();
  const { data, error } = await admin
    .from('atlas_gps_saved_places')
    .select('id,label,category,latitude,longitude,metadata,created_at,updated_at')
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw new EdgeError('saved_places_unavailable', 503);
  return data || [];
}

async function savePlace(context: Context, input: Json) {
  const label = clean(input.label, 240);
  if (!label) throw new EdgeError('label_required', 422);
  const latitude = finiteNumber(input.latitude, 'latitude_invalid');
  const longitude = finiteNumber(input.longitude, 'longitude_invalid');
  if (Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new EdgeError('coordinates_out_of_range', 422);

  const admin = adminClient();
  const { data, error } = await admin
    .from('atlas_gps_saved_places')
    .insert({
      org_id: context.orgId,
      user_id: context.userId,
      label,
      category: clean(input.category, 80) || null,
      latitude,
      longitude,
      metadata: {}
    })
    .select('id,label,category,latitude,longitude,metadata,created_at,updated_at')
    .single();
  if (error || !data) throw new EdgeError('save_place_failed', 503);
  return data;
}

async function deletePlace(context: Context, id: string) {
  const placeId = clean(id, 80);
  if (!/^[0-9a-f-]{36}$/i.test(placeId)) throw new EdgeError('saved_place_id_invalid', 422);
  const admin = adminClient();
  const { error } = await admin
    .from('atlas_gps_saved_places')
    .delete()
    .eq('id', placeId)
    .eq('org_id', context.orgId)
    .eq('user_id', context.userId);
  if (error) throw new EdgeError('delete_place_failed', 503);
  return { deleted: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(req) });
  if (req.method !== 'POST') return json(req, { ok: false, error: 'method_not_allowed' }, 405);

  try {
    const contentLength = Number(req.headers.get('content-length') || 0);
    if (contentLength > MAX_REQUEST_BYTES) throw new EdgeError('request_too_large', 413);
    const body = await req.json().catch(() => ({})) as Json;
    const operation = clean(body.operation, 80);
    const orgId = clean(body.organization_id || req.headers.get('x-atlas-org-id'), 80);
    const context = await resolveContext(req, orgId);

    if (operation === 'capabilities') {
      return json(req, { ok: true, organization_id: context.orgId, capabilities: capabilities() });
    }
    if (operation === 'search') {
      const result = await searchPlaces(clean(body.query, 160), clean(body.language, 16) || 'es');
      return json(req, { ok: true, organization_id: context.orgId, ...result });
    }
    if (operation === 'route') {
      const result = await calculateRoute(body);
      return json(req, { ok: true, organization_id: context.orgId, ...result });
    }
    if (operation === 'indoor.lookup') {
      const result = await lookupIndoor(body);
      return json(req, { ok: true, organization_id: context.orgId, ...result });
    }
    if (operation === 'saved.list') {
      return json(req, { ok: true, organization_id: context.orgId, places: await listSaved(context) });
    }
    if (operation === 'saved.save') {
      return json(req, { ok: true, organization_id: context.orgId, place: await savePlace(context, body) }, 201);
    }
    if (operation === 'saved.delete') {
      return json(req, { ok: true, organization_id: context.orgId, ...(await deletePlace(context, clean(body.id, 80))) });
    }
    throw new EdgeError('unsupported_operation', 404);
  } catch (error) {
    const edgeError = error instanceof EdgeError ? error : new EdgeError('internal_error', 500);
    if (edgeError.status >= 500) console.error('atlas_gps_error', { code: edgeError.code });
    return json(req, { ok: false, error: edgeError.code }, edgeError.status);
  }
});
