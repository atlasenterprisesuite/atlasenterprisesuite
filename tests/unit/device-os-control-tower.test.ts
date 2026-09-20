import { describe, expect, it } from 'vitest';
import {
  buildDeviceOsPosture,
  evaluateAgentTrust,
  type DeviceOsPostureInput
} from '../../apps/web/src/modules/device-os/deviceOSControlTower';

const NOW = '2026-09-20T12:00:00.000Z';

function input(overrides: Partial<DeviceOsPostureInput> = {}): DeviceOsPostureInput {
  return {
    agents: [],
    devices: [],
    commands: [],
    now: NOW,
    ...overrides
  };
}

describe('ATLAS Device OS Control Tower', () => {
  it('does not call an enrolled agent trusted until heartbeat and provider-backed mTLS evidence exist', () => {
    expect(evaluateAgentTrust({
      status: 'offline',
      mtls_status: 'unconfigured',
      mtls_cert_expires_at: null,
      mtls_cloudflare_cert_id: null,
      last_seen_at: null
    }, NOW)).toBe('enrolled-unverified');

    expect(evaluateAgentTrust({
      status: 'online',
      mtls_status: 'active',
      mtls_cert_expires_at: '2026-09-21T12:00:00.000Z',
      mtls_cloudflare_cert_id: 'cf-cert-1',
      last_seen_at: '2026-09-20T11:59:30.000Z'
    }, NOW)).toBe('verified-active');
  });

  it('marks stale heartbeats and expired certificates as attention conditions', () => {
    expect(evaluateAgentTrust({
      status: 'online',
      mtls_status: 'active',
      mtls_cert_expires_at: '2026-09-21T12:00:00.000Z',
      mtls_cloudflare_cert_id: 'cf-cert-1',
      last_seen_at: '2026-09-20T11:50:00.000Z'
    }, NOW)).toBe('stale');

    expect(evaluateAgentTrust({
      status: 'online',
      mtls_status: 'active',
      mtls_cert_expires_at: '2026-09-20T11:59:59.000Z',
      mtls_cloudflare_cert_id: 'cf-cert-1',
      last_seen_at: '2026-09-20T11:59:30.000Z'
    }, NOW)).toBe('certificate-expired');
  });

  it('reports evidence-backed posture without fabricating readiness scores', () => {
    const posture = buildDeviceOsPosture(input({
      agents: [{
        id: 'agent-1',
        status: 'online',
        mtls_status: 'active',
        mtls_cert_expires_at: '2026-09-21T12:00:00.000Z',
        mtls_cloudflare_cert_id: 'cf-cert-1',
        last_seen_at: '2026-09-20T11:59:30.000Z'
      }],
      devices: [{ id: 'device-1', health_status: 'healthy', last_seen_at: '2026-09-20T11:59:20.000Z' }],
      commands: [{ id: 'command-1', status: 'queued', created_at: '2026-09-20T11:59:40.000Z', finished_at: null, error_code: null }]
    }));

    expect(posture.state).toBe('operational');
    expect(posture.verifiedAgents).toBe(1);
    expect(posture.reportedDevices).toBe(1);
    expect(posture.activeCommands).toBe(1);
    expect(posture.issues).toEqual([]);
    expect(posture).not.toHaveProperty('score');
    expect(posture).not.toHaveProperty('percentage');
  });

  it('surfaces stale agents, unhealthy devices, failed commands and aged queue work', () => {
    const posture = buildDeviceOsPosture(input({
      agents: [{
        id: 'agent-1',
        status: 'online',
        mtls_status: 'active',
        mtls_cert_expires_at: '2026-09-21T12:00:00.000Z',
        mtls_cloudflare_cert_id: 'cf-cert-1',
        last_seen_at: '2026-09-20T11:40:00.000Z'
      }],
      devices: [{ id: 'device-1', health_status: 'degraded', last_seen_at: '2026-09-20T11:59:20.000Z' }],
      commands: [
        { id: 'command-1', status: 'queued', created_at: '2026-09-20T11:40:00.000Z', finished_at: null, error_code: null },
        { id: 'command-2', status: 'failed', created_at: '2026-09-20T11:58:00.000Z', finished_at: '2026-09-20T11:58:30.000Z', error_code: 'adapter_failed' }
      ]
    }));

    expect(posture.state).toBe('attention');
    expect(posture.staleAgents).toBe(1);
    expect(posture.unhealthyDevices).toBe(1);
    expect(posture.failedCommands).toBe(1);
    expect(posture.stuckCommands).toBe(1);
    expect(posture.issues.length).toBeGreaterThanOrEqual(4);
  });
});
