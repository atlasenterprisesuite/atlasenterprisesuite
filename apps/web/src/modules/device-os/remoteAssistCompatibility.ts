import type { AtlasLocalAgent, AtlasLocalDevice } from './localControlApi';

/**
 * Capability discovery only. This module NEVER authorizes or creates a remote session.
 * Real session access must be decided server-side with signed-adapter, consent, RBAC,
 * organization, audit, expiry and revocation checks.
 */
export type RemoteHostTier =
  | 'native-desktop'
  | 'attended-screen-only'
  | 'outbound-share-only'
  | 'unsupported';

export function getRemoteHostTier(platform: string): RemoteHostTier {
  const normalized = platform.trim().toLowerCase().replace(/[\s_-]/g, '');
  if (normalized === 'win32' || normalized.startsWith('windows') ||
      normalized === 'darwin' || normalized.startsWith('macos') ||
      normalized === 'linux' || normalized.startsWith('ubuntu') ||
      normalized.startsWith('debian') || normalized.startsWith('fedora')) {
    return 'native-desktop';
  }
  if (normalized.startsWith('android')) return 'attended-screen-only';
  if (normalized === 'ios' || normalized.startsWith('ipados') ||
      normalized.startsWith('iphoneos')) return 'outbound-share-only';
  return 'unsupported';
}

export function summarizeRemoteCandidates(
  agents: readonly AtlasLocalAgent[],
  devices: readonly AtlasLocalDevice[]
) {
  const onlineAgents = agents.filter((agent) => {
    const tier = getRemoteHostTier(agent.platform);
    return agent.status === 'online' &&
      (tier === 'native-desktop' || tier === 'attended-screen-only');
  });
  const secureAgents = onlineAgents.filter((agent) => agent.mtls_status === 'active');
  const declaredDevices = devices.filter((device) => {
    if (!device.id || !device.agent_id || !device.org_id) return false;
    const linkedAgent = secureAgents.find((agent) =>
      agent.id === device.agent_id && agent.org_id === device.org_id
    );
    if (!linkedAgent) return false;
    const view = device.capabilities.includes('remote.desktop.view');
    const control = device.capabilities.includes('remote.desktop.control');
    return getRemoteHostTier(linkedAgent.platform) === 'native-desktop'
      ? view || control
      : view;
  });

  // Agent metadata cannot prove native adapter signature, consent, transport
  // establishment or server-authorized session; never return connected/ready.
  return { onlineAgents, secureAgents, declaredDevices, sessionVerified: false as const };
}
