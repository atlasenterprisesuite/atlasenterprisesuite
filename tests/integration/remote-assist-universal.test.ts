import { describe, expect, it } from 'vitest';
import { getRemoteHostTier, summarizeRemoteCandidates } from '../../apps/web/src/modules/device-os/remoteAssistCompatibility';
import type { AtlasLocalAgent, AtlasLocalDevice } from '../../apps/web/src/modules/device-os/localControlApi';

const agent = (overrides: Partial<AtlasLocalAgent> = {}) => ({
  id: 'agent-1', org_id: 'org-a', platform: 'win32', status: 'online',
  mtls_status: 'active', ...overrides
}) as AtlasLocalAgent;
const device = (overrides: Partial<AtlasLocalDevice> = {}) => ({
  id: 'device-1', agent_id: 'agent-1', org_id: 'org-a',
  capabilities: ['remote.desktop.view'], ...overrides
}) as AtlasLocalDevice;

describe('ATLAS Universal Remote host eligibility — fail closed', () => {
  it('recognizes native desktop host platforms without restricting the viewer to Windows', () => {
    expect(['win32', 'Windows 11', 'darwin', 'macOS', 'linux', 'Ubuntu'].map(getRemoteHostTier))
      .toEqual(Array(6).fill('native-desktop'));
    expect(getRemoteHostTier('chromeos')).toBe('unsupported');
    expect(getRemoteHostTier('unrecognized')).toBe('unsupported');
  });

  it('refuses iOS native desktop control and limits Android to attended screen capability', () => {
    expect(getRemoteHostTier('ios')).toBe('outbound-share-only');
    expect(getRemoteHostTier('iPadOS')).toBe('outbound-share-only');
    expect(getRemoteHostTier('android')).toBe('attended-screen-only');
    expect(summarizeRemoteCandidates([agent({ platform: 'ios' })], [device()]).declaredDevices).toHaveLength(0);
    expect(summarizeRemoteCandidates([agent({ platform: 'android' })], [device({ capabilities: ['remote.desktop.control'] })]).declaredDevices).toHaveLength(0);
  });

  it('requires online and mTLS-active agents bound to the same organization and device', () => {
    expect(summarizeRemoteCandidates([agent({ status: 'offline' })], [device()]).declaredDevices).toHaveLength(0);
    expect(summarizeRemoteCandidates([agent({ mtls_status: 'revoked' })], [device()]).declaredDevices).toHaveLength(0);
    expect(summarizeRemoteCandidates([agent()], [device({ agent_id: 'another' })]).declaredDevices).toHaveLength(0);
    expect(summarizeRemoteCandidates([agent()], [device({ org_id: 'org-b' })]).declaredDevices).toHaveLength(0);
  });

  it('never treats capability declarations alone as a verified live session', () => {
    const result = summarizeRemoteCandidates([agent({ platform: 'darwin' })], [device()]);
    expect(result.onlineAgents).toHaveLength(1);
    expect(result.secureAgents).toHaveLength(1);
    expect(result.declaredDevices).toHaveLength(1);
    expect(result.sessionVerified).toBe(false);
  });
});
