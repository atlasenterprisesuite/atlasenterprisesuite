import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization,
  getAtlasAccessToken
} from '../../lib/atlasSession';

export type AtlasLocalAgent = {
  id: string;
  org_id: string;
  name: string;
  status: 'online' | 'offline' | 'revoked';
  platform: string;
  agent_version: string;
  capabilities: string[];
  modules: string[];
  public_key_fingerprint: string | null;
  mtls_status: 'unconfigured' | 'pending' | 'active' | 'expired' | 'revoked';
  mtls_cert_fingerprint_sha256: string | null;
  mtls_cert_serial: string | null;
  mtls_cloudflare_cert_id: string | null;
  mtls_cert_expires_at: string | null;
  realtime_last_connected_at: string | null;
  installer_version: string | null;
  last_seen_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AtlasLocalDevice = {
  id: string;
  org_id: string;
  agent_id: string;
  external_id: string;
  label: string;
  device_type: string;
  adapter: string;
  capabilities: string[];
  health_status: 'unknown' | 'healthy' | 'degraded' | 'offline' | 'error';
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
};

export type AtlasLocalCommand = {
  id: string;
  org_id: string;
  device_id: string;
  capability: string;
  action: string;
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  approval_id: string | null;
  status: 'queued' | 'claimed' | 'succeeded' | 'failed' | 'cancelled';
  claimed_by_agent_id: string | null;
  claimed_at: string | null;
  finished_at: string | null;
  error_code: string | null;
  created_at: string;
};

async function post<T>(operation: string, input: Record<string, unknown> = {}): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-local-control', {
    method: 'POST',
    body: JSON.stringify({ operation, organization_id: organization.id, ...input })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) {
    throw new Error(body?.error || `local_control_failed_${response.status}`);
  }
  return body as T;
}

export async function listLocalAgents() {
  return (await post<{ ok: true; agents: AtlasLocalAgent[] }>('agents.list')).agents;
}

export async function listLocalDevices() {
  return (await post<{ ok: true; devices: AtlasLocalDevice[] }>('devices.list')).devices;
}

export async function listLocalCommands() {
  return (await post<{ ok: true; commands: AtlasLocalCommand[] }>('commands.list')).commands;
}

export async function createLocalAgentEnrollment(agentName: string) {
  return post<{
    ok: true;
    enrollment: { id: string; agent_name: string; expires_at: string };
    enrollment_code: string;
  }>('enrollment.create', { agent_name: agentName });
}

export async function revokeLocalAgent(agentId: string) {
  return post<{ ok: true }>('agents.revoke', { agent_id: agentId });
}

export async function bindLocalAgentMtls(input: {
  agentId: string;
  fingerprintSha256: string;
  serial: string;
  expiresAt: string;
}) {
  return post<{
    ok: true;
    agent: Pick<
      AtlasLocalAgent,
      'id' |
      'mtls_status' |
      'mtls_cert_fingerprint_sha256' |
      'mtls_cert_serial' |
      'mtls_cert_expires_at'
    >;
  }>('agents.mtls.bind', {
    agent_id: input.agentId,
    fingerprint_sha256: input.fingerprintSha256,
    serial: input.serial,
    expires_at: input.expiresAt
  });
}

export async function revokeLocalAgentMtls(agentId: string) {
  return post<{ ok: true }>('agents.mtls.revoke', { agent_id: agentId });
}

async function publishRealtimeNudge(input: {
  organizationId: string;
  agentId: string;
  commandId: string;
}) {
  const token = getAtlasAccessToken();
  if (!token) return { delivered: 0, state: 'no_session' as const };

  try {
    const response = await fetch('/_atlas/local-bus/publish', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        organization_id: input.organizationId,
        agent_id: input.agentId,
        command_id: input.commandId
      })
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.ok !== true) {
      return { delivered: 0, state: 'fallback_polling' as const };
    }
    return { delivered: Number(body.delivered || 0), state: 'published' as const };
  } catch {
    return { delivered: 0, state: 'fallback_polling' as const };
  }
}

export async function enqueueLocalDeviceCommand(input: {
  deviceId: string;
  agentId: string;
  capability: string;
  action: string;
  riskLevel?: 'low' | 'medium';
  approvalId?: string;
}) {
  const organization = await getActiveAtlasOrganization();
  const result = await post<{ ok: true; command: AtlasLocalCommand }>('commands.enqueue', {
    device_id: input.deviceId,
    capability: input.capability,
    action: input.action,
    risk_level: input.riskLevel || 'low',
    approval_id: input.approvalId || undefined
  });
  const realtime = await publishRealtimeNudge({
    organizationId: organization.id,
    agentId: input.agentId,
    commandId: result.command.id
  });
  return { ...result, realtime };
}
