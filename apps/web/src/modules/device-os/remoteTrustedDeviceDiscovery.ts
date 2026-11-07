import type { AtlasLocalAgent, AtlasLocalDevice } from './localControlApi';
import { getRemoteHostTier } from './remoteAssistCompatibility';

export type AtlasRecognizedHost = {
  agentId: string;
  label: string;
  platform: string;
  registeredDevices: number;
  lastSeenAt: string;
  presenceOnly: true;
  remoteSessionAuthorized: false;
};

/**
 * ATLAS Pair Once / discovery-only v0.
 * Do not interpret login/email, declared capability or device metadata as proof
 * of remote-control authorization. The canonical backend scopes these lists
 * to the current authenticated ATLAS organization.
 */
export function discoverRecognizedHosts(
  agents: readonly AtlasLocalAgent[],
  devices: readonly AtlasLocalDevice[],
  nowMs: number,
  freshnessMs = 120_000
): AtlasRecognizedHost[] {
  if (!Number.isFinite(nowMs) || nowMs <= 0 || !Number.isFinite(freshnessMs) ||
      freshnessMs <= 0 || freshnessMs > 300_000) return [];

  return agents.flatMap((agent): AtlasRecognizedHost[] => {
    if (!agent.id || !agent.org_id || getRemoteHostTier(agent.platform) !== 'native-desktop' ||
        agent.status !== 'online' || agent.mtls_status !== 'active' ||
        !/^[a-f\d]{64}$/i.test(agent.mtls_cert_fingerprint_sha256 ?? '')) return [];

    const lastSeen = Date.parse(agent.last_seen_at ?? '');
    const certificateExpires = Date.parse(agent.mtls_cert_expires_at ?? '');
    const age = nowMs - lastSeen;
    if (!Number.isFinite(age) || age < -15_000 || age > freshnessMs ||
        !Number.isFinite(certificateExpires) || certificateExpires <= nowMs) return [];

    const registeredDevices = devices.filter((device) =>
      Boolean(device.id) && device.agent_id === agent.id && device.org_id === agent.org_id
    ).length;

    return [{
      agentId: agent.id,
      label: agent.name || 'ATLAS device',
      platform: agent.platform,
      registeredDevices,
      lastSeenAt: agent.last_seen_at as string,
      presenceOnly: true,
      remoteSessionAuthorized: false
    }];
  });
}
