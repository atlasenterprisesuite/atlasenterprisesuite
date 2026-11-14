import { describe, expect, it, vi } from 'vitest';
import type { AtlasLocalAgent, AtlasLocalDevice } from '../../apps/web/src/modules/device-os/localControlApi';
import { probeCurrentAtlasOrigin, projectDeviceConnectivity } from '../../apps/web/src/modules/device-os/deviceConnectivity';

const now = Date.parse('2026-11-13T20:00:00Z');
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
    await expect(probeCurrentAtlasOrigin({ origin: 'https://www.atlasenterprisesuite.com', fetchImpl })).resolves.toEqual({
      state: 'reachable', httpStatus: 200, scope: 'current-atlas-origin-only'
    });
    expect(fetchImpl).toHaveBeenCalledWith('https://www.atlasenterprisesuite.com/', expect.objectContaining({
      method: 'GET', credentials: 'omit', cache: 'no-store', redirect: 'error'
    }));
  });

  it('does not promote redirects, errors or arbitrary HTTP to success', async () => {
    const redirect = vi.fn(async () => { throw new Error('redirect denied'); }) as unknown as typeof fetch;
    expect((await probeCurrentAtlasOrigin({ origin: 'https://www.atlasenterprisesuite.com', fetchImpl: redirect })).state).toBe('unavailable');
    const denied = vi.fn(async () => ({ status: 403 })) as unknown as typeof fetch;
    expect((await probeCurrentAtlasOrigin({ origin: 'https://www.atlasenterprisesuite.com', fetchImpl: denied })).state).toBe('unavailable');
  });

  it('rejects unsafe or malformed target origins', async () => {
    const target = { fetchImpl: vi.fn() as unknown as typeof fetch };
    await expect(probeCurrentAtlasOrigin({ origin: 'http://public.example', ...target })).rejects.toThrow('invalid_current_atlas_origin');
    await expect(probeCurrentAtlasOrigin({ origin: 'https://user:pass@public.example', ...target })).rejects.toThrow();
    await expect(probeCurrentAtlasOrigin({ origin: 'https://public.example/path', ...target })).rejects.toThrow();
    expect(target.fetchImpl).not.toHaveBeenCalled();
  });
});
