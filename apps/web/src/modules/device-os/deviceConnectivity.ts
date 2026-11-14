import type { AtlasLocalAgent, AtlasLocalDevice } from './localControlApi';

export type DeviceControlState = 'agent-recent' | 'secure-channel-required' | 'stale' | 'offline' | 'revoked' | 'unverified';

export type DeviceConnectivityRow = Readonly<{
  id: string;
  label: string;
  platform: string;
  controlState: DeviceControlState;
  controlEvidence: 'registered-agent-heartbeat' | 'none';
  internet: 'not-measured';
  wifi: 'not-measured';
  cellular: 'not-measured';
  vpn: 'not-measured';
  lastSeenAt: string | null;
}>;

const HEARTBEAT_MAX_AGE_MS = 5 * 60 * 1000;
const CLOCK_SKEW_MS = 60 * 1000;

export function projectDeviceConnectivity(
  agents: readonly AtlasLocalAgent[],
  devices: readonly AtlasLocalDevice[],
  nowMs: number = Date.now()
): DeviceConnectivityRow[] {
  const agentById = new Map(agents.map((agent) => [agent.id, agent]));
  return devices.map((device) => {
    const candidate = agentById.get(device.agent_id);
    // A mismatched organization must never borrow another agent's state.
    const agent = candidate?.org_id === device.org_id ? candidate : undefined;
    let controlState: DeviceControlState = 'unverified';
    let controlEvidence: DeviceConnectivityRow['controlEvidence'] = 'none';
    const seenAt = agent?.last_seen_at;
    const seenMs = seenAt ? Date.parse(seenAt) : Number.NaN;
    const heartbeatRecent =
      Number.isFinite(nowMs) && Number.isFinite(seenMs) &&
      seenMs <= nowMs + CLOCK_SKEW_MS && nowMs - seenMs <= HEARTBEAT_MAX_AGE_MS;

    if (agent?.status === 'revoked') controlState = 'revoked';
    else if (agent?.status === 'offline') controlState = 'offline';
    else if (agent?.status === 'online' && !heartbeatRecent) controlState = 'stale';
    else if (agent?.status === 'online' && agent.mtls_status !== 'active') controlState = 'secure-channel-required';
    else if (agent?.status === 'online' && heartbeatRecent && agent.mtls_status === 'active') {
      controlState = 'agent-recent';
      controlEvidence = 'registered-agent-heartbeat';
    }

    return {
      id: device.id,
      label: device.label,
      platform: agent?.platform || device.device_type,
      controlState,
      controlEvidence,
      internet: 'not-measured',
      wifi: 'not-measured',
      cellular: 'not-measured',
      vpn: 'not-measured',
      lastSeenAt: agent?.last_seen_at || null
    };
  });
}

export type AtlasOriginProbe = Readonly<{
  state: 'reachable' | 'unavailable';
  httpStatus: number | null;
  scope: 'current-atlas-origin-only';
}>;

/**
 * A user-triggered HTTP check to the current ATLAS origin. It is NOT an internet,
 * DNS, VPN, Wi-Fi, captive portal or hardware-connectivity certification.
 * No cross-origin targets, cookies, redirects, scanning or stored measurements.
 */
export async function probeCurrentAtlasOrigin(options: {
  origin: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<AtlasOriginProbe> {
  const url = new URL(options.origin);
  const loopback = url.hostname === 'localhost' || url.hostname === '127.0.0.1' || url.hostname === '[::1]';
  if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
      !(url.protocol === 'https:' || (loopback && url.protocol === 'http:'))) {
    throw new Error('invalid_current_atlas_origin');
  }
  const timeoutMs = options.timeoutMs ?? 5000;
  if (!Number.isFinite(timeoutMs) || timeoutMs < 100 || timeoutMs > 10000) throw new Error('invalid_probe_timeout');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await (options.fetchImpl ?? fetch)(url.origin + '/', {
      method: 'GET',
      cache: 'no-store',
      credentials: 'omit',
      redirect: 'error',
      signal: controller.signal
    });
    return {
      state: response.status === 200 ? 'reachable' : 'unavailable',
      httpStatus: response.status,
      scope: 'current-atlas-origin-only'
    };
  } catch {
    return { state: 'unavailable', httpStatus: null, scope: 'current-atlas-origin-only' };
  } finally {
    clearTimeout(timer);
  }
}
