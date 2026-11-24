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
    const certExpiresMs = agent?.mtls_cert_expires_at ? Date.parse(agent.mtls_cert_expires_at) : Number.NaN;
    const secureBindingCurrent = agent?.mtls_status === 'active' &&
      Number.isFinite(certExpiresMs) && certExpiresMs > nowMs;
    const heartbeatRecent =
      Number.isFinite(nowMs) && Number.isFinite(seenMs) &&
      seenMs <= nowMs + CLOCK_SKEW_MS && nowMs - seenMs <= HEARTBEAT_MAX_AGE_MS;

    if (agent?.status === 'revoked') controlState = 'revoked';
    else if (agent?.status === 'offline') controlState = 'offline';
    else if (agent?.status === 'online' && !heartbeatRecent) controlState = 'stale';
    else if (agent?.status === 'online' && !secureBindingCurrent) controlState = 'secure-channel-required';
    else if (agent?.status === 'online' && heartbeatRecent && secureBindingCurrent) {
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
  const browserOrigin = typeof window === 'undefined' ? null : window.location.origin;
  if (browserOrigin && url.origin !== browserOrigin) throw new Error('non_current_origin');
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


/**
 * Accepts only the sanitized, user-pasted output of our opt-in Windows script.
 * The result is user-provided evidence, never a trusted agent attestation.
 */
export type WindowsConnectivityReport = Readonly<{
  schema: 'atlas-network-diagnostics-v1';
  source: 'user-run-windows-powershell';
  measuredAt: string;
  adaptersUpCount: number;
  dnsResolved: boolean;
  tcp443Reachable: boolean;
  wireGuardAdapterPresent: boolean;
  wireGuardAdapterUp: boolean;
}>;

export function parseWindowsConnectivityReport(text: string): WindowsConnectivityReport {
  if (!text || text.length > 4096) throw new Error('invalid_windows_connectivity_report');
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error('invalid_windows_connectivity_report');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_windows_connectivity_report');
  }
  const data = parsed as Record<string, unknown>;
  const keys = [
    'schema', 'source', 'measuredAt', 'adaptersUpCount',
    'dnsResolved', 'tcp443Reachable', 'wireGuardAdapterPresent', 'wireGuardAdapterUp'
  ];
  if (Object.keys(data).length !== keys.length || keys.some((key) => !Object.prototype.hasOwnProperty.call(data, key))) {
    throw new Error('unexpected_windows_connectivity_fields');
  }
  if (data.schema !== 'atlas-network-diagnostics-v1' ||
      data.source !== 'user-run-windows-powershell' ||
      typeof data.measuredAt !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T/.test(data.measuredAt) ||
      !Number.isFinite(Date.parse(data.measuredAt)) ||
      !Number.isInteger(data.adaptersUpCount) ||
      (data.adaptersUpCount as number) < 0 ||
      (data.adaptersUpCount as number) > 256 ||
      typeof data.dnsResolved !== 'boolean' ||
      typeof data.tcp443Reachable !== 'boolean' ||
      typeof data.wireGuardAdapterPresent !== 'boolean' ||
      typeof data.wireGuardAdapterUp !== 'boolean' ||
      (data.wireGuardAdapterUp && !data.wireGuardAdapterPresent)) {
    throw new Error('invalid_windows_connectivity_report');
  }
  return {
    schema: 'atlas-network-diagnostics-v1',
    source: 'user-run-windows-powershell',
    measuredAt: data.measuredAt as string,
    adaptersUpCount: data.adaptersUpCount as number,
    dnsResolved: data.dnsResolved as boolean,
    tcp443Reachable: data.tcp443Reachable as boolean,
    wireGuardAdapterPresent: data.wireGuardAdapterPresent as boolean,
    wireGuardAdapterUp: data.wireGuardAdapterUp as boolean
  };
}


export type WindowsConnectivityAssessment = Readonly<{
  state: 'stale' | 'needs-attention' | 'basic-checks-passed';
  findings: readonly string[];
}>;

/**
 * Deterministic triage, not network certification. User-reported diagnostics
 * are never bound to a registered ATLAS device without agent-side evidence.
 */
export function assessWindowsConnectivityReport(
  report: WindowsConnectivityReport,
  nowMs: number = Date.now()
): WindowsConnectivityAssessment {
  const measuredMs = Date.parse(report.measuredAt);
  if (!Number.isFinite(nowMs) || !Number.isFinite(measuredMs) ||
      measuredMs > nowMs + 60_000 || nowMs - measuredMs > 15 * 60_000) {
    return {
      state: 'stale',
      findings: ['The report is older than 15 minutes or its clock is inconsistent. Repeat the local diagnostic.']
    };
  }

  const findings: string[] = [];
  if (report.adaptersUpCount === 0) {
    findings.push('No network adapter reported an Up state. Check an authorized Wi-Fi, Ethernet or mobile hotspot connection.');
  }
  if (!report.dnsResolved) {
    findings.push('The DNS lookup of example.com did not return an IPv4 result. Check Windows DNS settings or the network connection.');
  }
  if (!report.tcp443Reachable) {
    findings.push('TCP 443 to 1.1.1.1 was not confirmed. Check permitted Internet access and firewall settings; do not disable security controls.');
  }
  if (report.wireGuardAdapterPresent && !report.wireGuardAdapterUp) {
    findings.push('A WireGuard adapter was detected but is not Up. Verify the authorized tunnel in the WireGuard app.');
  }
  if (report.wireGuardAdapterUp) {
    findings.push('WireGuard interface reports Up, but peer handshake and traffic routing are not verified by this script.');
  }
  if (findings.length === 0) {
    findings.push('DNS and one public TCP endpoint passed. This does not establish general Internet, Wi-Fi or VPN health.');
  }
  const needsAttention = report.adaptersUpCount === 0 || !report.dnsResolved ||
    !report.tcp443Reachable || (report.wireGuardAdapterPresent && !report.wireGuardAdapterUp);
  return {
    state: needsAttention ? 'needs-attention' : 'basic-checks-passed',
    findings
  };
}

export type IphoneManualCheck = Readonly<{
  wifi: 'yes' | 'no' | 'unknown';
  cellular: 'yes' | 'no' | 'unknown';
  hotspot: 'yes' | 'no' | 'unknown';
  vpn: 'yes' | 'no' | 'unknown';
}>;

export function guideIphoneManualCheck(check: IphoneManualCheck): readonly string[] {
  const notes: string[] = [];
  if (check.wifi === 'no' && check.cellular === 'no') {
    notes.push('Neither Wi-Fi nor mobile data was reported available. Check a permitted Wi-Fi connection or an active mobile plan.');
  }
  if (check.wifi === 'yes') {
    notes.push('Wi-Fi selected in Settings does not prove that an Internet route works.');
  }
  if (check.cellular === 'no') {
    notes.push('Cellular data is not currently reported available. Personal Hotspot may require an active plan and carrier support.');
  }
  if (check.hotspot === 'yes') {
    notes.push('Hotspot was reported enabled. Verify that Windows explicitly joins your iPhone hotspot and can access a permitted site.');
  } else if (check.hotspot === 'no') {
    notes.push('If you want iPhone-to-Windows sharing, check Settings → Personal Hotspot and confirm carrier support.');
  }
  if (check.vpn === 'yes') {
    notes.push('An enabled VPN switch does not prove a WireGuard peer handshake or usable tunnel.');
  }
  if (!notes.length) {
    notes.push('No connection status is independently verified. Check Settings → Wi-Fi, Cellular, Personal Hotspot and VPN.');
  }
  return notes;
}
