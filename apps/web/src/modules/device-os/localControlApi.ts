import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../lib/atlasSession';

export type AtlasLocalAgent = {
  id: string; org_id: string; name: string; status: 'online'|'offline'|'revoked';
  platform: string; agent_version: string; capabilities: string[]; modules: string[];
  public_key_fingerprint: string | null; last_seen_at: string | null; created_at: string; updated_at: string;
};
export type AtlasLocalDevice = {
  id: string; org_id: string; agent_id: string; external_id: string; label: string;
  device_type: string; adapter: string; capabilities: string[];
  health_status: 'unknown'|'healthy'|'degraded'|'offline'|'error';
  last_seen_at: string | null; metadata: Record<string, unknown>;
};
export type AtlasLocalCommand = {
  id: string; org_id: string; device_id: string; capability: string; action: string;
  risk_level: 'low'|'medium'|'high'|'critical'; approval_id: string | null;
  status: 'queued'|'claimed'|'succeeded'|'failed'|'cancelled';
  claimed_by_agent_id: string | null; claimed_at: string | null; finished_at: string | null;
  error_code: string | null; created_at: string;
};

async function post<T>(operation: string, input: Record<string, unknown> = {}): Promise<T> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/functions/v1/atlas-local-control', {
    method: 'POST',
    body: JSON.stringify({ operation, organization_id: organization.id, ...input })
  });
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.ok) throw new Error(body?.error || `local_control_failed_${response.status}`);
  return body as T;
}

export async function listLocalAgents() {
  return (await post<{ok:true;agents:AtlasLocalAgent[]}>('agents.list')).agents;
}
export async function listLocalDevices() {
  return (await post<{ok:true;devices:AtlasLocalDevice[]}>('devices.list')).devices;
}
export async function listLocalCommands() {
  return (await post<{ok:true;commands:AtlasLocalCommand[]}>('commands.list')).commands;
}
export async function createLocalAgentEnrollment(agentName: string) {
  return post<{ok:true;enrollment:{id:string;agent_name:string;expires_at:string};enrollment_code:string}>(
    'enrollment.create', { agent_name: agentName }
  );
}
export async function revokeLocalAgent(agentId: string) {
  return post<{ok:true}>('agents.revoke', { agent_id: agentId });
}
export async function enqueueLocalDeviceCommand(input: {
  deviceId: string; capability: string; action: string; riskLevel?: 'low'|'medium'; approvalId?: string;
}) {
  return post<{ok:true;command:AtlasLocalCommand}>('commands.enqueue', {
    device_id: input.deviceId,
    capability: input.capability,
    action: input.action,
    risk_level: input.riskLevel || 'low',
    approval_id: input.approvalId || undefined
  });
}
