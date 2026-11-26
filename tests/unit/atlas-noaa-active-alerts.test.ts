import { describe, expect, it } from 'vitest';
import { normalizeNoaaActiveAlerts } from '../../packages/analytics/src/noaa-active-alerts';

const ctx = () => ({
  latitude: 28.5,
  longitude: -81.3,
  fetchedAt: '2026-11-26T14:00:00Z',
  sourceUrl: 'https://api.weather.gov/alerts/active?point=28.5000%2C-81.3000'
});
const feature = (id = 'urn:oid:NOAA-001', event = 'Flood Warning') => ({
  type: 'Feature',
  id,
  properties: {
    id,
    status: 'Actual',
    messageType: 'Alert',
    event,
    headline: 'Example alert — test fixture, not live data',
    severity: 'Severe',
    areaDesc: 'Test area',
    sent: '2026-11-26T09:00:00-05:00',
    effective: '2026-11-26T08:00:00-05:00',
    expires: '2026-11-26T15:00:00-05:00'
  }
});
const feed = (features: unknown[]) => ({ type: 'FeatureCollection', features });

describe('ATLAS NOAA active alerts — normalized evidence only', () => {
  it('converts timezone offsets and classifies an official active warning as reviewable, never publishable', () => {
    const result = normalizeNoaaActiveAlerts(feed([feature()]), ctx());
    expect(result.status).toBe('complete');
    expect(result.alerts).toHaveLength(1);
    expect(result.alerts[0].hazard).toBe('flood');
    expect(result.alerts[0].validFrom).toBe('2026-11-26T13:00:00.000Z');
    expect(result.alerts[0].source.provider).toBe('NOAA/NWS');
    expect(result.alerts[0].mayPublishAlert).toBe(false);
  });
  it('keeps the distinction between no official active alerts and rejected records', () => {
    const noAlerts = normalizeNoaaActiveAlerts(feed([]), ctx());
    expect(noAlerts.status).toBe('complete');
    expect(noAlerts.providerCount).toBe(0);
    const stale = feature(); stale.properties.sent = '2026-11-16T09:00:00-05:00';
    const partial = normalizeNoaaActiveAlerts(feed([stale]), ctx());
    expect(partial.status).toBe('partial');
    expect(partial.alerts).toHaveLength(0);
    expect(partial.rejectedCount).toBe(1);
    expect(partial.providerCount).toBe(1);
  });
  it('rejects test and cancelled messages, not silently declaring clear conditions', () => {
    const test = feature(); test.properties.status = 'Test';
    const cancel = feature('urn:oid:NOAA-002'); cancel.properties.messageType = 'Cancel';
    const result = normalizeNoaaActiveAlerts(feed([test, cancel]), ctx());
    expect(result.status).toBe('partial');
    expect(result.rejectedCount).toBe(2);
  });
  it('classifies diverse hazards while preserving the original event name', () => {
    const result = normalizeNoaaActiveAlerts(feed([
      feature('a','Hurricane Warning'), feature('b','Freeze Warning'), feature('c','Heat Advisory'),
      feature('d','Drought Warning'), feature('e','Tornado Warning')
    ]), ctx());
    expect(result.alerts.map(x => x.hazard)).toEqual([
      'tropical-cyclone','extreme-cold','heat','drought','severe-weather'
    ]);
    expect(result.alerts[4].event).toBe('Tornado Warning');
  });
  it('marks an oversized alert collection as partial and bounded', () => {
    const features = Array.from({ length: 36 }, (_, i) => feature('noaa-' + i));
    const result = normalizeNoaaActiveAlerts(feed(features), ctx());
    expect(result.alerts).toHaveLength(30);
    expect(result.truncated).toBe(true);
    expect(result.unprocessedCount).toBe(6);
    expect(result.status).toBe('partial');
  });
  it('fails closed on malformed provider response and on untrusted source URLs', () => {
    expect(() => normalizeNoaaActiveAlerts({ features: [] }, ctx())).toThrow('invalid_noaa_collection');
    expect(() => normalizeNoaaActiveAlerts(feed([]), { ...ctx(), fetchedAt: 'invalid' })).toThrow('invalid_retrieval_time');
    const spoofed = normalizeNoaaActiveAlerts(feed([feature()]), { ...ctx(), sourceUrl: 'https://api.weather.gov.evil.example/alerts/active' });
    expect(spoofed.status).toBe('partial');
    expect(spoofed.alerts).toHaveLength(0);
  });
});
