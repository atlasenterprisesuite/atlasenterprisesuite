import { describe, it, expect } from 'vitest';
import { phoenixDiagnosticTargets, phoenixCommandOutcome } from '../../apps/web/src/modules/device-os/phoenixControlPolicy';
import type { AtlasLocalAgent, AtlasLocalCommand, AtlasLocalDevice } from '../../apps/web/src/modules/device-os/localControlApi';

const agent = { id: 'a1', org_id: 't1', status: 'online', mtls_status: 'active' } as AtlasLocalAgent;
const device = {
  id: 'd1', agent_id: 'a1', org_id: 't1', adapter: 'http-health',
  label: 'Service', capabilities: ['health.check']
} as AtlasLocalDevice;
const cmd = {
  id: 'c1', device_id: 'd1', capability: 'health.check', action: 'status.read',
  status: 'queued', risk_level: 'low'
} as AtlasLocalCommand;

describe('ATLAS Phoenix control fail closed', () => {
  it('requires online same-tenant mTLS bound agent and read-only service', () => {
    expect(phoenixDiagnosticTargets([agent], [device])).toHaveLength(1);
    expect(phoenixDiagnosticTargets([{ ...agent, status: 'offline' }], [device])).toEqual([]);
    expect(phoenixDiagnosticTargets([{ ...agent, status: 'revoked' }], [device])).toEqual([]);
    expect(phoenixDiagnosticTargets([{ ...agent, mtls_status: 'expired' }], [device])).toEqual([]);
    expect(phoenixDiagnosticTargets([agent], [{ ...device, org_id: 't2' }])).toEqual([]);
    expect(phoenixDiagnosticTargets([agent], [{ ...device, agent_id: 'someone-else' }])).toEqual([]);
  });
  it('does not authorize updates or desktop control based on declared capability', () => {
    for (const capability of ['remote.desktop.control', 'system.update', 'process.execute']) {
      expect(phoenixDiagnosticTargets([agent], [{ ...device, capabilities: [capability] }])).toEqual([]);
    }
    expect(phoenixDiagnosticTargets([agent], [{ ...device, adapter: 'browser-cdp' }])).toEqual([]);
    expect(phoenixDiagnosticTargets([agent], [{ ...device, id: '' }])).toEqual([]);
  });
  it('uses an exact command id, device and low-risk status.read before reporting success', () => {
    expect(phoenixCommandOutcome('c1', 'd1', [cmd])).toBe('pending');
    expect(phoenixCommandOutcome('c1', 'd1', [{ ...cmd, status: 'succeeded' }])).toBe('succeeded');
    expect(phoenixCommandOutcome('c1', 'd1', [{ ...cmd, status: 'failed' }])).toBe('failed');
    expect(phoenixCommandOutcome('c1', 'd1', [{ ...cmd, action: 'install', status: 'succeeded' }])).toBe('unknown');
    expect(phoenixCommandOutcome('c1', 'd1', [{ ...cmd, device_id: 'd2', status: 'succeeded' }])).toBe('unknown');
    expect(phoenixCommandOutcome('c1', 'd1', [{ ...cmd, risk_level: 'critical', status: 'succeeded' }])).toBe('unknown');
  });
});
