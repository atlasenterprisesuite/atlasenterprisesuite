export type DeviceOsAgentEvidence = {
  id?: string;
  status: 'online' | 'offline' | 'revoked';
  mtls_status: 'unconfigured' | 'pending' | 'active' | 'expired' | 'revoked';
  mtls_cert_expires_at: string | null;
  mtls_cloudflare_cert_id: string | null;
  last_seen_at: string | null;
};

export type DeviceOsDeviceEvidence = {
  id?: string;
  health_status: 'unknown' | 'healthy' | 'degraded' | 'offline' | 'error';
  last_seen_at: string | null;
};

export type DeviceOsCommandEvidence = {
  id?: string;
  status: 'queued' | 'claimed' | 'succeeded' | 'failed' | 'cancelled';
  created_at: string;
  finished_at: string | null;
  error_code: string | null;
};

export type AgentTrustState =
  | 'verified-active'
  | 'connected-unverified'
  | 'enrolled-unverified'
  | 'stale'
  | 'certificate-expired'
  | 'revoked';

export type DeviceOsPostureIssue = {
  code: string;
  severity: 'warning' | 'critical';
  title: string;
  detail: string;
  remediation: string;
};

export type DeviceOsPostureInput = {
  agents: readonly DeviceOsAgentEvidence[];
  devices: readonly DeviceOsDeviceEvidence[];
  commands: readonly DeviceOsCommandEvidence[];
  now?: string;
};

export type DeviceOsPosture = {
  state: 'empty' | 'operational' | 'attention';
  verifiedAgents: number;
  connectedUnverifiedAgents: number;
  staleAgents: number;
  expiredCertificates: number;
  reportedDevices: number;
  healthyDevices: number;
  unhealthyDevices: number;
  activeCommands: number;
  stuckCommands: number;
  failedCommands: number;
  issues: DeviceOsPostureIssue[];
};

const AGENT_STALE_AFTER_MS = 5 * 60 * 1000;
const COMMAND_STUCK_AFTER_MS = 10 * 60 * 1000;

function instant(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateAgentTrust(
  agent: DeviceOsAgentEvidence,
  now = new Date().toISOString()
): AgentTrustState {
  if (agent.status === 'revoked' || agent.mtls_status === 'revoked') return 'revoked';

  const nowMs = instant(now) ?? Date.now();
  const certExpiry = instant(agent.mtls_cert_expires_at);
  if (agent.mtls_status === 'active' && certExpiry !== null && certExpiry <= nowMs) {
    return 'certificate-expired';
  }

  const lastSeen = instant(agent.last_seen_at);
  if (lastSeen === null) return 'enrolled-unverified';
  if (nowMs - lastSeen > AGENT_STALE_AFTER_MS) return 'stale';
  if (agent.status !== 'online') return 'enrolled-unverified';

  const providerBackedMtls = agent.mtls_status === 'active'
    && Boolean(agent.mtls_cloudflare_cert_id)
    && certExpiry !== null
    && certExpiry > nowMs;

  return providerBackedMtls ? 'verified-active' : 'connected-unverified';
}

export function buildDeviceOsPosture(input: DeviceOsPostureInput): DeviceOsPosture {
  const now = input.now ?? new Date().toISOString();
  const nowMs = instant(now) ?? Date.now();
  const trustStates = input.agents.map((agent) => evaluateAgentTrust(agent, now));

  const verifiedAgents = trustStates.filter((state) => state === 'verified-active').length;
  const connectedUnverifiedAgents = trustStates.filter((state) =>
    state === 'connected-unverified' || state === 'enrolled-unverified'
  ).length;
  const staleAgents = trustStates.filter((state) => state === 'stale').length;
  const expiredCertificates = trustStates.filter((state) => state === 'certificate-expired').length;
  const healthyDevices = input.devices.filter((device) => device.health_status === 'healthy').length;
  const unhealthyDevices = input.devices.filter((device) =>
    ['degraded', 'offline', 'error'].includes(device.health_status)
  ).length;
  const activeCommands = input.commands.filter((command) =>
    command.status === 'queued' || command.status === 'claimed'
  ).length;
  const failedCommands = input.commands.filter((command) => command.status === 'failed').length;
  const stuckCommands = input.commands.filter((command) => {
    if (command.status !== 'queued' && command.status !== 'claimed') return false;
    const createdAt = instant(command.created_at);
    return createdAt !== null && nowMs - createdAt > COMMAND_STUCK_AFTER_MS;
  }).length;

  const issues: DeviceOsPostureIssue[] = [];
  if (expiredCertificates > 0) {
    issues.push({
      code: 'mtls_certificate_expired',
      severity: 'critical',
      title: 'Expired Local Agent certificate',
      detail: `${expiredCertificates} agent(s) report an expired provider-backed mTLS certificate.`,
      remediation: 'Reissue through the signed ATLAS Local Agent mTLS workflow before allowing realtime control.'
    });
  }
  if (staleAgents > 0) {
    issues.push({
      code: 'agent_heartbeat_stale',
      severity: 'warning',
      title: 'Local Agent heartbeat is stale',
      detail: `${staleAgents} agent(s) have not produced fresh heartbeat evidence within five minutes.`,
      remediation: 'Check the host service, network path and agent session before treating the agent as reachable.'
    });
  }
  if (connectedUnverifiedAgents > 0) {
    issues.push({
      code: 'agent_trust_unverified',
      severity: 'warning',
      title: 'Agent trust is not fully verified',
      detail: `${connectedUnverifiedAgents} agent(s) are enrolled or recently connected without current provider-backed mTLS evidence.`,
      remediation: 'Complete Cloudflare-backed certificate issuance and verify a fresh heartbeat.'
    });
  }
  if (unhealthyDevices > 0) {
    issues.push({
      code: 'device_health_attention',
      severity: 'warning',
      title: 'Registered device health needs attention',
      detail: `${unhealthyDevices} device(s) report degraded, offline or error health.`,
      remediation: 'Inspect the owning Local Agent and adapter before sending additional actions.'
    });
  }
  if (stuckCommands > 0) {
    issues.push({
      code: 'command_queue_stalled',
      severity: 'critical',
      title: 'Command queue contains stalled work',
      detail: `${stuckCommands} queued or claimed command(s) have remained active for more than ten minutes.`,
      remediation: 'Inspect agent reachability, approval binding and adapter execution before retrying.'
    });
  }
  if (failedCommands > 0) {
    issues.push({
      code: 'command_failures_present',
      severity: 'warning',
      title: 'Recent command failures exist',
      detail: `${failedCommands} command(s) in the loaded evidence set are failed.`,
      remediation: 'Review error codes and adapter evidence; do not infer recovery until a later command succeeds.'
    });
  }

  const empty = input.agents.length === 0 && input.devices.length === 0 && input.commands.length === 0;
  return {
    state: empty ? 'empty' : issues.length ? 'attention' : 'operational',
    verifiedAgents,
    connectedUnverifiedAgents,
    staleAgents,
    expiredCertificates,
    reportedDevices: input.devices.length,
    healthyDevices,
    unhealthyDevices,
    activeCommands,
    stuckCommands,
    failedCommands,
    issues
  };
}
