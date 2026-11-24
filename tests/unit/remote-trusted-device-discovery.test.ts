import { describe, expect, it } from 'vitest';
import { discoverRecognizedHosts } from '../../apps/web/src/modules/device-os/remoteTrustedDeviceDiscovery';
import type { AtlasLocalAgent, AtlasLocalDevice } from '../../apps/web/src/modules/device-os/localControlApi';

const now = Date.parse('2026-11-07T12:00:00Z');
const agent: AtlasLocalAgent = {
  id: 'agent-1', org_id: 'org-a', name: 'ATLAS-WINDOWS', platform: 'win32',
  status: 'online', mtls_status: 'active',
  mtls_cert_fingerprint_sha256: 'a'.repeat(64),
  mtls_cert_expires_at: '2026-11-08T12:00:00Z',
  last_seen_at: '2026-11-07T11:59:30Z'
} as AtlasLocalAgent;
const local = {
  id: 'device-1', agent_id: 'agent-1', org_id: 'org-a', label: 'Local service'
} as AtlasLocalDevice;

describe('ATLAS Pair Once: discovery, never authorization', () => {
  it('discovers an enrolled, recent Windows host only as presence', () => {
    expect(discoverRecognizedHosts([agent], [local], now)).toEqual([{
      agentId: 'agent-1', label: 'ATLAS-WINDOWS',
      platform: 'win32', registeredDevices: 1,
      lastSeenAt: '2026-11-07T11:59:30Z',
      presenceOnly: true, remoteSessionAuthorized: false
    }]);
  });
  it('fails closed when status, fingerprint, expiry, or heartbeat is invalid', () => {
    const variants: AtlasLocalAgent[] = [
      { ...agent, status: 'revoked' },
      { ...agent, status: 'offline' },
      { ...agent, mtls_status: 'expired' },
      { ...agent, mtls_cert_fingerprint_sha256: null },
      { ...agent, mtls_cert_fingerprint_sha256: 'not-a-fingerprint' },
      { ...agent, mtls_cert_expires_at: '2026-11-06T00:00:00Z' },
      { ...agent, last_seen_at: null },
      { ...agent, last_seen_at: '2026-11-07T11:50:00Z' },
      { ...agent, last_seen_at: '2026-11-07T12:05:00Z' },
      { ...agent, platform: 'ios' },
      { ...agent, id: '' },
      { ...agent, org_id: '' }
    ];
    for (const invalid of variants) {
      expect(discoverRecognizedHosts([invalid], [local], now)).toEqual([]);
    }
  });
  it('never combines a local device from a different tenant or agent', () => {
    expect(discoverRecognizedHosts([agent], [
      local, { ...local, id: 'foreign', org_id: 'org-b' },
      { ...local, id: 'other-agent', agent_id: 'other' }
    ], now)[0].registeredDevices).toBe(1);
    expect(discoverRecognizedHosts([agent], [{ ...local, org_id: 'org-b' }], now)[0].registeredDevices).toBe(0);
  });
  it('rejects invalid freshness clock and does not invent a remote session', () => {
    expect(discoverRecognizedHosts([agent], [local], 0)).toEqual([]);
    expect(discoverRecognizedHosts([agent], [local], now, -1)).toEqual([]);
    expect(discoverRecognizedHosts([agent], [local], now, 1_000_000)).toEqual([]);
    const [host] = discoverRecognizedHosts([agent], [local], now);
    expect(host.remoteSessionAuthorized).toBe(false);
    expect(host).not.toHaveProperty('sessionToken');
  });
});
