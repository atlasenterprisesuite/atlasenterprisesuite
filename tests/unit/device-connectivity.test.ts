import { describe, expect, it, vi } from 'vitest';
import type { AtlasLocalAgent, AtlasLocalDevice } from '../../apps/web/src/modules/device-os/localControlApi';
import { assessWindowsConnectivityReport, guideIphoneManualCheck, parseWindowsConnectivityReport, probeCurrentAtlasOrigin, projectDeviceConnectivity } from '../../apps/web/src/modules/device-os/deviceConnectivity';

const now = Date.parse('2026-11-13T20:00:00Z');
const origin = typeof window === 'undefined' ? 'https://www.atlasenterprisesuite.com' : window.location.origin;
const agent = {
  id: 'a1', org_id: 'org1', platform: 'win32', status: 'online',
  mtls_status: 'active', last_seen_at: '2026-11-13T19:59:00Z'
} as AtlasLocalAgent;
const device = {
  id: 'd1', label: 'Owned laptop', org_id: 'org1', agent_id: 'a1',
  device_type: 'computer', health_status: 'healthy'
} as AtlasLocalDevice;

describe('Device OS connectivity projection: fail closed', () => {
  it('does not confuse agent reporting or healthy inventory with Internet or VPN verification', () => {
    expect(projectDeviceConnectivity([agent], [device], now)).toMatchObject([{
      controlState: 'agent-recent',
      controlEvidence: 'registered-agent-heartbeat',
      internet: 'not-measured', wifi: 'not-measured', cellular: 'not-measured', vpn: 'not-measured'
    }]);
  });

  it('does not trust stale or missing heartbeats or unsecured agents', () => {
    expect(projectDeviceConnectivity([{ ...agent, last_seen_at: '2026-11-13T19:40:00Z' }], [device], now)[0].controlState).toBe('stale');
    expect(projectDeviceConnectivity([{ ...agent, last_seen_at: null }], [device], now)[0].controlState).toBe('stale');
    expect(projectDeviceConnectivity([{ ...agent, mtls_status: 'pending' }], [device], now)[0].controlState).toBe('secure-channel-required');
    expect(projectDeviceConnectivity([{ ...agent, status: 'revoked' }], [device], now)[0].controlState).toBe('revoked');
  });

  it('prevents cross-organization agent-to-device state borrowing', () => {
    const projected = projectDeviceConnectivity([{ ...agent, org_id: 'another-org' }], [device], now)[0];
    expect(projected.controlState).toBe('unverified');
    expect(projected.controlEvidence).toBe('none');
  });
});

describe('ATLAS same-origin browser check', () => {
  it('uses credential-free, no-cache, redirect-rejecting GET', async () => {
    const fetchImpl = vi.fn(async () => ({ status: 200 })) as unknown as typeof fetch;
    await expect(probeCurrentAtlasOrigin({ origin, fetchImpl })).resolves.toEqual({
      state: 'reachable', httpStatus: 200, scope: 'current-atlas-origin-only'
    });
    expect(fetchImpl).toHaveBeenCalledWith(origin + '/', expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error'
    }));
  });

  it('does not promote redirects, errors or arbitrary HTTP to success', async () => {
    const redirect = vi.fn(async () => { throw new Error('redirect denied'); }) as unknown as typeof fetch;
    expect((await probeCurrentAtlasOrigin({ origin, fetchImpl: redirect })).state).toBe('unavailable');
    const denied = vi.fn(async () => ({ status: 403 })) as unknown as typeof fetch;
    expect((await probeCurrentAtlasOrigin({ origin, fetchImpl: denied })).state).toBe('unavailable');
  });

  it('rejects unsafe or malformed target origins', async () => {
    const target = { fetchImpl: vi.fn() as unknown as typeof fetch };
    await expect(probeCurrentAtlasOrigin({ origin: 'http://public.example', ...target })).rejects.toThrow('invalid_current_atlas_origin');
    await expect(probeCurrentAtlasOrigin({ origin: 'https://user:pass@public.example', ...target })).rejects.toThrow();
    await expect(probeCurrentAtlasOrigin({ origin: 'https://public.example/path', ...target })).rejects.toThrow();
    if (typeof window !== 'undefined') {
      await expect(probeCurrentAtlasOrigin({ origin: 'https://other-site.example', ...target })).rejects.toThrow('non_current_origin');
    }
    expect(target.fetchImpl).not.toHaveBeenCalled();
  });
});


describe('Sanitized Windows diagnostics import', () => {
  const sample = {
    schema: 'atlas-network-diagnostics-v1',
    source: 'user-run-windows-powershell',
    measuredAt: '2026-11-13T21:00:00Z',
    adaptersUpCount: 2,
    dnsResolved: true,
    tcp443Reachable: true,
    wireGuardAdapterPresent: true,
    wireGuardAdapterUp: false
  };

  it('accepts and returns only a strict, user-reported summary', () => {
    expect(parseWindowsConnectivityReport(JSON.stringify(sample))).toEqual(sample);
  });
  it('rejects secrets, unknown properties, untrusted sources and inconsistent VPN status', () => {
    expect(() => parseWindowsConnectivityReport(JSON.stringify({ ...sample, wifiPassword: 'secret' }))).toThrow('unexpected_windows_connectivity_fields');
    expect(() => parseWindowsConnectivityReport(JSON.stringify({ ...sample, source: 'verified-agent' }))).toThrow();
    expect(() => parseWindowsConnectivityReport(JSON.stringify({ ...sample, wireGuardAdapterUp: true, wireGuardAdapterPresent: false }))).toThrow();
    expect(() => parseWindowsConnectivityReport('not-json')).toThrow();
    expect(() => parseWindowsConnectivityReport('x'.repeat(5000))).toThrow();
  });
});


describe('Connectivity guidance is bounded by evidence', () => {
  const report = {
    schema: 'atlas-network-diagnostics-v1',
    source: 'user-run-windows-powershell',
    measuredAt: '2026-11-13T20:00:00Z',
    adaptersUpCount: 1,
    dnsResolved: true,
    tcp443Reachable: true,
    wireGuardAdapterPresent: true,
    wireGuardAdapterUp: true
  } as const;
  const clock = Date.parse(report.measuredAt) + 30_000;

  it('calls simple DNS and TCP checks only basic, never verified Internet or VPN', () => {
    const assessment = assessWindowsConnectivityReport(report, clock);
    expect(assessment.state).toBe('basic-checks-passed');
    expect(assessment.findings.join(' ')).toMatch(/handshake.*not verified/);
  });

  it('alerts on DNS failure, no adapters and unreachable TCP', () => {
    const assessment = assessWindowsConnectivityReport({
      ...report, adaptersUpCount: 0, dnsResolved: false, tcp443Reachable: false
    }, clock);
    expect(assessment.state).toBe('needs-attention');
    expect(assessment.findings.join(' ')).toContain('DNS');
    expect(assessment.findings.join(' ')).toContain('TCP');
  });

  it('rejects outdated or future-dated self-reports as current evidence', () => {
    expect(assessWindowsConnectivityReport(report, clock + 16 * 60_000).state).toBe('stale');
    expect(assessWindowsConnectivityReport(report, clock - 3 * 60_000).state).toBe('stale');
  });

  it('does not call an iPhone switch a confirmed connection', () => {
    const guide = guideIphoneManualCheck({
      wifi: 'yes', cellular: 'no', hotspot: 'no', vpn: 'yes'
    }).join(' ');
    expect(guide).toMatch(/does not prove/);
    expect(guide).toMatch(/WireGuard peer handshake/);
    expect(guide).toMatch(/carrier support/);
  });
});
