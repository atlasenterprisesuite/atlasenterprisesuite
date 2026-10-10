/**
 * ATLAS Weather. Provider-neutral public forecast adapter.
 * MET Norway offers global forecasts under CC BY 4.0 (including commercial usage).
 * A forecast grid point is a model estimate, never a local sensor observation.
 */
export type WeatherKind = 'sun' | 'cloud' | 'rain' | 'snow' | 'storm' | 'fog' | 'unknown';

export type WeatherHour = {
  at: string;
  celsius: number;
  symbol: string;
  kind: WeatherKind;
  windMps: number | null;
  humidity: number | null;
  precipitationMm: number | null;
};

export type WeatherDay = {
  date: string;
  minimumC: number;
  maximumC: number;
  kind: WeatherKind;
};

export type WeatherForecast = {
  provider: 'MET Norway';
  modelUpdatedAt: string;
  fetchedAt: string;
  expiresAt: string;
  hours: WeatherHour[];
  days: WeatherDay[];
};

export type WeatherObservation = {
  station: string;
  observedAt: string;
  celsius: number;
  humidity: number | null;
  windMps: number | null;
  description: string | null;
  sourceUrl: string;
};

/** NWS station observations are real measurements, unlike MET model forecast grid data. */
export async function fetchNwsObservation(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherObservation | null> {
  if (!nwsCoverageEligible(lat, lon)) return null;
  const coords = safeCoordinates(lat, lon);
  const base = 'https://api.weather.gov';
  const points = await fetch(`${base}/points/${coords.lat},${coords.lon}`, { headers: { Accept: 'application/geo+json' }, signal });
  if (!points.ok) throw new Error(`Estaciones NWS no disponibles (HTTP ${points.status}).`);
  const observationStations = text(asRecord(asRecord(await points.json()).properties).observationStations);
  if (!observationStations.startsWith(`${base}/gridpoints/`)) return null;
  const stationsResponse = await fetch(observationStations, { headers: { Accept: 'application/geo+json' }, signal });
  if (!stationsResponse.ok) throw new Error(`Estaciones NWS no disponibles (HTTP ${stationsResponse.status}).`);
  const stations = asRecord(await stationsResponse.json()).features;
  if (!Array.isArray(stations) || !stations.length) return null;
  const station = text(asRecord(asRecord(stations[0]).properties).stationIdentifier);
  if (!/^[A-Z0-9]{3,6}$/.test(station)) return null;
  const sourceUrl = `${base}/stations/${station}/observations/latest`;
  const latest = await fetch(sourceUrl, { headers: { Accept: 'application/geo+json' }, signal });
  if (!latest.ok) throw new Error(`Observación NWS no disponible (HTTP ${latest.status}).`);
  const props = asRecord(asRecord(await latest.json()).properties);
  const observedAt = text(props.timestamp);
  const celsius = finiteNumber(asRecord(props.temperature).value);
  if (celsius === null || !Number.isFinite(Date.parse(observedAt)) || Date.now() - Date.parse(observedAt) > 3 * 60 * 60 * 1000 || Date.parse(observedAt) > Date.now() + 15 * 60 * 1000) return null;
  return {
    station, observedAt, celsius,
    humidity: finiteNumber(asRecord(props.relativeHumidity).value),
    windMps: finiteNumber(asRecord(props.windSpeed).value),
    description: text(props.textDescription) || null,
    sourceUrl
  };
}

export type WeatherAlert = {
  id: string;
  title: string;
  severity: string;
  description: string;
  instruction: string | null;
  expiresAt: string | null;
  sourceUrl: string;
};

const FORECAST_ENDPOINT = 'https://api.met.no/weatherapi/locationforecast/2.0/compact';
const NWS_ENDPOINT = 'https://api.weather.gov/alerts/active';
const DEFAULT_TTL_MS = 60 * 60 * 1000;
const forecastCache = new Map<string, { expiresAt: number; payload: WeatherForecast }>();

function finiteNumber(input: unknown): number | null {
  return typeof input === 'number' && Number.isFinite(input) ? input : null;
}

function asRecord(input: unknown): Record<string, unknown> {
  return input && typeof input === 'object' && !Array.isArray(input)
    ? input as Record<string, unknown>
    : {};
}

function text(input: unknown): string {
  return typeof input === 'string' ? input : '';
}

/** Weather symbol mapping is conservative: unknown symbols never become clear skies. */
export function weatherKind(symbol: string): WeatherKind {
  const value = symbol.toLowerCase();
  if (!value) return 'unknown';
  if (value.includes('thunder')) return 'storm';
  if (value.includes('snow') || value.includes('sleet')) return 'snow';
  if (value.includes('rain') || value.includes('drizzle') || value.includes('shower')) return 'rain';
  if (value.includes('fog')) return 'fog';
  if (value.includes('cloud')) return 'cloud';
  if (value.includes('clear') || value.includes('fair')) return 'sun';
  return 'unknown';
}

export function describeWeather(kind: WeatherKind): string {
  const labels: Record<WeatherKind, string> = {
    sun: 'Despejado', cloud: 'Nublado o parcialmente nublado', rain: 'Lluvia prevista',
    snow: 'Nieve prevista', storm: 'Tormenta prevista', fog: 'Niebla prevista',
    unknown: 'Condición no especificada'
  };
  return labels[kind];
}

export function formatTemperature(celsius: number, unit: 'C' | 'F'): string {
  const value = unit === 'F' ? celsius * 9 / 5 + 32 : celsius;
  return `${Math.round(value)}°${unit}`;
}

export function safeCoordinates(lat: number, lon: number): { lat: string; lon: string } {
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
    throw new Error('Coordenadas fuera del rango permitido.');
  }
  // Fixed precision increases shared cache hits and follows MET Norway policy.
  return { lat: lat.toFixed(2), lon: lon.toFixed(2) };
}

function parseHour(input: unknown): WeatherHour | null {
  const record = asRecord(input);
  const at = text(record.time);
  if (!Number.isFinite(Date.parse(at))) return null;
  const data = asRecord(record.data);
  const instantaneous = asRecord(asRecord(data.instant).details);
  const celsius = finiteNumber(instantaneous.air_temperature);
  if (celsius === null || celsius < -110 || celsius > 65) return null;
  const period = asRecord(data.next_1_hours);
  const fallback = asRecord(data.next_6_hours);
  const next = Object.keys(period).length ? period : fallback;
  const symbol = text(asRecord(next.summary).symbol_code);
  return {
    at, celsius, symbol, kind: weatherKind(symbol),
    windMps: finiteNumber(instantaneous.wind_speed),
    humidity: finiteNumber(instantaneous.relative_humidity),
    precipitationMm: finiteNumber(asRecord(next.details).precipitation_amount)
  };
}

export function normalizeForecast(input: unknown, fetchedAt = new Date().toISOString(), expiresAt?: string): WeatherForecast {
  const properties = asRecord(asRecord(input).properties);
  const meta = asRecord(properties.meta);
  const series = properties.timeseries;
  const hours = (Array.isArray(series) ? series : [])
    .map(parseHour)
    .filter((item): item is WeatherHour => item !== null)
    .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
  if (!hours.length) throw new Error('La fuente no devolvió puntos meteorológicos válidos.');
  const daysByDate = new Map<string, WeatherHour[]>();
  for (const hour of hours) {
    const date = hour.at.slice(0, 10);
    const day = daysByDate.get(date) || [];
    day.push(hour);
    daysByDate.set(date, day);
  }
  const days = [...daysByDate.entries()].slice(0, 9).map(([date, items]): WeatherDay => {
    const temperatures = items.map(item => item.celsius);
    // Worst-weather prioritization prevents clear-sky icons masking forecast storms.
    const priority: WeatherKind[] = ['storm', 'snow', 'rain', 'fog', 'cloud', 'sun', 'unknown'];
    return {
      date,
      minimumC: Math.min(...temperatures),
      maximumC: Math.max(...temperatures),
      kind: priority.find(kind => items.some(item => item.kind === kind)) || 'unknown'
    };
  });
  const updated = text(meta.updated_at);
  return {
    provider: 'MET Norway',
    modelUpdatedAt: Number.isFinite(Date.parse(updated)) ? updated : fetchedAt,
    fetchedAt,
    expiresAt: expiresAt || new Date(Date.parse(fetchedAt) + DEFAULT_TTL_MS).toISOString(),
    hours,
    days
  };
}

export function nextWeatherHour(forecast: WeatherForecast, now = Date.now()): WeatherHour {
  return forecast.hours.find(hour => Date.parse(hour.at) >= now - 30 * 60 * 1000) || forecast.hours[0];
}

export async function fetchWeatherForecast(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherForecast> {
  const coords = safeCoordinates(lat, lon);
  const key = `${coords.lat},${coords.lon}`;
  const cached = forecastCache.get(key);
  if (cached && Date.now() < cached.expiresAt) return cached.payload;
  const url = new URL(FORECAST_ENDPOINT);
  url.searchParams.set('lat', coords.lat);
  url.searchParams.set('lon', coords.lon);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    signal
  });
  if (!response.ok) throw new Error(`Pronóstico no disponible (HTTP ${response.status}).`);
  const fetchedAt = new Date().toISOString();
  const expiry = Date.parse(response.headers.get('Expires') || '');
  const expiresAtMs = Number.isFinite(expiry) && expiry > Date.now()
    ? expiry
    : Date.now() + DEFAULT_TTL_MS;
  const payload = normalizeForecast(await response.json(), fetchedAt, new Date(expiresAtMs).toISOString());
  forecastCache.set(key, { expiresAt: expiresAtMs, payload });
  return payload;
}

/** Alert retrieval is only eligible where the US NWS issues warnings. */
export function nwsCoverageEligible(lat: number, lon: number): boolean {
  return (
    (lat >= 24 && lat <= 50 && lon >= -125 && lon <= -66) ||
    (lat >= 51 && lat <= 72 && lon >= -170 && lon <= -129) ||
    (lat >= 18 && lat <= 23 && lon >= -161 && lon <= -154) ||
    (lat >= 17 && lat <= 19 && lon >= -68 && lon <= -65)
  );
}

export function normalizeAlerts(input: unknown): WeatherAlert[] {
  const features = asRecord(input).features;
  if (!Array.isArray(features)) return [];
  return features.flatMap((feature): WeatherAlert[] => {
    const f = asRecord(feature);
    const p = asRecord(f.properties);
    const id = text(f.id);
    const title = text(p.headline) || text(p.event);
    if (!id.startsWith('https://api.weather.gov/alerts/') || !title) return [];
    const expiresAt = text(p.expires) || null;
    if (expiresAt && Number.isFinite(Date.parse(expiresAt)) && Date.parse(expiresAt) < Date.now()) return [];
    return [{
      id, title, severity: text(p.severity) || 'Unknown',
      description: text(p.description), instruction: text(p.instruction) || null,
      expiresAt, sourceUrl: id
    }];
  });
}

export async function fetchNwsAlerts(lat: number, lon: number, signal?: AbortSignal): Promise<WeatherAlert[]> {
  const coords = safeCoordinates(lat, lon);
  if (!nwsCoverageEligible(lat, lon)) return [];
  const url = new URL(NWS_ENDPOINT);
  url.searchParams.set('point', `${coords.lat},${coords.lon}`);
  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/geo+json' },
    signal
  });
  if (!response.ok) throw new Error(`Alertas NWS no disponibles (HTTP ${response.status}).`);
  return normalizeAlerts(await response.json());
}
