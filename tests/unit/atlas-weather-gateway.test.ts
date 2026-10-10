import { afterEach, describe, expect, it, vi } from 'vitest';
import { weatherGateway } from '../../worker/weatherGateway';

afterEach(() => vi.unstubAllGlobals());

function at(path: string, method = 'GET') {
  return new Request('https://www.atlasenterprisesuite.com' + path, { method });
}

describe('ATLAS Cloudflare Weather Gateway', () => {
  it('leaves all unrelated routes to the canonical worker and denies mutations', async () => {
    await expect(weatherGateway(at('/status'))).resolves.toBeNull();
    const denied = await weatherGateway(at('/api/v1/weather/forecast?lat=28&lon=-81', 'POST'));
    expect(denied?.status).toBe(405);
    const invalid = await weatherGateway(at('/api/v1/weather/forecast?lat=999&lon=-81'));
    expect(invalid?.status).toBe(400);
    expect(await weatherGateway(at('/api/v1/weather/delete?lat=28&lon=-81'))).toMatchObject({ status: 404 });
  });

  it('identifies ATLAS to MET Norway and never permits arbitrary upstream URLs', async () => {
    const target = vi.fn(async (url: string, options: RequestInit) => {
      expect(String(url)).toContain('https://api.met.no/weatherapi/locationforecast/2.0/compact');
      expect(String(url)).not.toContain('evil.example');
      expect((options.headers as Record<string, string>)['User-Agent']).toContain('atlasenterprisesuite.com');
      return new Response(JSON.stringify({ properties: { timeseries: [] } }), {
        status: 200,
        headers: { Expires: new Date(Date.now() + 60_000).toUTCString() }
      });
    });
    vi.stubGlobal('fetch', target);
    const response = await weatherGateway(at('/api/v1/weather/forecast?lat=28.5384&lon=-81.3789&url=https://evil.example/'));
    expect(response?.status).toBe(200);
    expect(response?.headers.get('x-atlas-data-provider')).toBe('met-norway-forecast');
    expect(target).toHaveBeenCalledTimes(1);
  });

  it('does not invent weather if an upstream source fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('Provider down', { status: 503 })));
    const response = await weatherGateway(at('/api/v1/weather/forecast?lat=20.1&lon=-81.4'));
    expect(response?.status).toBe(503);
    expect(await response?.json()).toEqual({ error: 'official_weather_provider_unavailable' });
  });

  it('only requests official US alerts where the NWS provides coverage', async () => {
    const mocked = vi.fn();
    vi.stubGlobal('fetch', mocked);
    const outside = await weatherGateway(at('/api/v1/weather/alerts?lat=10.48&lon=-66.9'));
    expect(await outside?.json()).toEqual({ features: [] });
    expect(mocked).not.toHaveBeenCalled();
  });

  it('validates station URLs and preserves the original observed timestamp', async () => {
    const observedAt = new Date().toISOString();
    const mocked = vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes('/points/')) return new Response(JSON.stringify({
        properties: { observationStations: 'https://api.weather.gov/gridpoints/MLB/10,20/stations' }
      }));
      if (url.includes('/gridpoints/')) return new Response(JSON.stringify({
        features: [{ properties: { stationIdentifier: 'KMCO' } }]
      }));
      return new Response(JSON.stringify({ properties: {
        timestamp: observedAt, temperature: { value: 27 }, relativeHumidity: { value: 70 }
      } }));
    });
    vi.stubGlobal('fetch', mocked);
    const response = await weatherGateway(at('/api/v1/weather/observations?lat=28.55&lon=-81.34'));
    expect(response?.status).toBe(200);
    expect(await response?.json()).toMatchObject({ station: 'KMCO', properties: { timestamp: observedAt } });
    expect(mocked).toHaveBeenCalledTimes(3);
  });
});
