import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  describeWeather, fetchNwsAlerts, fetchNwsObservation, fetchWeatherForecast, formatTemperature, nextWeatherHour,
  normalizeAlerts, normalizeForecast, nwsCoverageEligible, safeCoordinates, weatherKind
} from '../../apps/web/src/modules/weather/weatherDomain';

const sample = {
  properties: {
    meta: { updated_at: '2026-10-10T09:00:00Z' },
    timeseries: [
      { time: '2026-10-10T10:00:00Z', data: {
        instant: { details: { air_temperature: 25, relative_humidity: 70, wind_speed: 3 } },
        next_1_hours: { summary: { symbol_code: 'rainshowers_day' }, details: { precipitation_amount: 1.1 } }
      } },
      { time: '2026-10-10T11:00:00Z', data: {
        instant: { details: { air_temperature: 27, relative_humidity: 66, wind_speed: 2 } },
        next_1_hours: { summary: { symbol_code: 'thunderstorm' }, details: { precipitation_amount: 4.1 } }
      } }
    ]
  }
};

afterEach(() => vi.unstubAllGlobals());

describe('ATLAS Weather model truth boundary', () => {
  it('rejects invalid coordinates and rounds for safe cache reuse', () => {
    expect(safeCoordinates(28.53843, -81.37892)).toEqual({ lat: '28.54', lon: '-81.38' });
    expect(() => safeCoordinates(91, -81)).toThrow();
    expect(() => safeCoordinates(Number.NaN, 0)).toThrow();
  });

  it('classifies extreme weather before generic cloudy conditions', () => {
    expect(weatherKind('heavyrainandthunder')).toBe('storm');
    expect(weatherKind('snowshowers_day')).toBe('snow');
    expect(weatherKind('lightrain')).toBe('rain');
    expect(weatherKind('partlycloudy_day')).toBe('cloud');
    expect(weatherKind('clearsky_day')).toBe('sun');
    expect(weatherKind('')).toBe('unknown');
    expect(describeWeather('storm')).toContain('Tormenta');
  });

  it('normalizes forecast data without inventing sensor observations', () => {
    const result = normalizeForecast(sample, '2026-10-10T09:59:00Z');
    expect(result.provider).toBe('MET Norway');
    expect(result.modelUpdatedAt).toBe('2026-10-10T09:00:00Z');
    expect(result.hours).toHaveLength(2);
    expect(result.hours[0].kind).toBe('rain');
    expect(result.hours[0].precipitationMm).toBe(1.1);
    expect(result.days[0]).toMatchObject({ date: '2026-10-10', minimumC: 25, maximumC: 27, kind: 'storm' });
    expect(nextWeatherHour(result, Date.parse('2026-10-10T10:40:00Z')).at).toBe('2026-10-10T11:00:00Z');
    expect(formatTemperature(25, 'F')).toBe('77°F');
    expect(formatTemperature(25, 'C')).toBe('25°C');
    expect(() => normalizeForecast({ properties: { timeseries: [{ time: 'bad', data: {} }] } })).toThrow(/válidos/);
  });

  it('fetches real provider JSON and honors Expires instead of hammering the API', async () => {
    const mocked = vi.fn(async () => ({
      ok: true,
      headers: { get: (name: string) => name === 'Expires' ? new Date(Date.now() + 600_000).toUTCString() : null },
      json: async () => sample
    }));
    vi.stubGlobal('fetch', mocked);
    const first = await fetchWeatherForecast(28.53, -81.37);
    const second = await fetchWeatherForecast(28.53, -81.37);
    expect(first).toEqual(second);
    expect(mocked).toHaveBeenCalledTimes(1);
    expect(String(mocked.mock.calls[0]?.[0])).toContain('api.met.no');
  });

  it('does not disguise an unavailable source as successful weather data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 503 })));
    await expect(fetchWeatherForecast(-30.01, -70.01)).rejects.toThrow('503');
  });
});

describe('ATLAS official warning boundary', () => {
  it('gates NOAA/NWS to US coverage and returns no simulated warnings', async () => {
    expect(nwsCoverageEligible(28.54, -81.38)).toBe(true);
    expect(nwsCoverageEligible(10.48, -66.90)).toBe(false);
    const mocked = vi.fn();
    vi.stubGlobal('fetch', mocked);
    await expect(fetchNwsAlerts(10.48, -66.90)).resolves.toEqual([]);
    expect(mocked).not.toHaveBeenCalled();
  });

  it('verifies actual station measurements and rejects stale readings', async () => {
    const observedAt = new Date().toISOString();
    const mocked = vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes('/points/')) return {
        ok: true, json: async () => ({ properties: { observationStations: 'https://api.weather.gov/gridpoints/MLB/10,20/stations' } })
      };
      if (url.includes('/gridpoints/')) return {
        ok: true, json: async () => ({ features: [{ properties: { stationIdentifier: 'KMCO' } }] })
      };
      return { ok: true, json: async () => ({ properties: {
        timestamp: observedAt, textDescription: 'Partly Cloudy',
        temperature: { value: 26 }, relativeHumidity: { value: 80 }, windSpeed: { value: 3 }
      } }) };
    });
    vi.stubGlobal('fetch', mocked);
    const observation = await fetchNwsObservation(28.55, -81.34);
    expect(observation).toMatchObject({ station: 'KMCO', celsius: 26, humidity: 80 });
    expect(mocked).toHaveBeenCalledTimes(3);

    const stale = vi.fn(async (input: string) => {
      const url = String(input);
      if (url.includes('/points/')) return { ok: true, json: async () => ({ properties: { observationStations: 'https://api.weather.gov/gridpoints/MLB/10,20/stations' } }) };
      if (url.includes('/gridpoints/')) return { ok: true, json: async () => ({ features: [{ properties: { stationIdentifier: 'KMCO' } }] }) };
      return { ok: true, json: async () => ({ properties: { timestamp: '2020-01-01T00:00:00Z', temperature: { value: 26 } } }) };
    });
    vi.stubGlobal('fetch', stale);
    await expect(fetchNwsObservation(28.55, -81.34)).resolves.toBeNull();
  });

  it('accepts only genuine unexpired NOAA alert references', () => {
    const future = new Date(Date.now() + 100_000).toISOString();
    const parsed = normalizeAlerts({ features: [
      { id: 'https://api.weather.gov/alerts/123', properties: { headline: 'Flood Warning', severity: 'Severe', expires: future } },
      { id: 'https://example.invalid/fake', properties: { headline: 'Fake Alert' } },
      { id: 'https://api.weather.gov/alerts/expired', properties: { headline: 'Old', expires: '2020-01-01T00:00:00Z' } }
    ] });
    expect(parsed).toHaveLength(1);
    expect(parsed[0]).toMatchObject({ title: 'Flood Warning', severity: 'Severe' });
  });
});
