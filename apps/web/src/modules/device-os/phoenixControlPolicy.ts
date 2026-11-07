import type { AtlasLocalAgent, AtlasLocalDevice, AtlasLocalCommand } from './localControlApi';

/** Discovery for read-only diagnostics ONLY. Not an update, remote boot, or control grant. */
export function phoenixDiagnosticTargets(agents: readonly AtlasLocalAgent[], devices: readonly AtlasLocalDevice[]) {
  return devices.filter((device) =>
    Boolean(device.id && device.agent_id && device.org_id) &&
    device.adapter === 'http-health' &&
    device.capabilities.includes('health.check') &&
    agents.some((agent) =>
      agent.id === device.agent_id &&
      agent.org_id === device.org_id &&
      agent.status === 'online' &&
      agent.mtls_status === 'active'
    )
  ).map((device) => ({
    id: device.id, agentId: device.agent_id, label: device.label,
    capability: 'health.check' as const, action: 'status.read' as const
  }));
}

export function phoenixCommandOutcome(
  id: string | null, deviceId: string | null, commands: readonly AtlasLocalCommand[]
) {
  if (!id || !deviceId) return 'not-requested' as const;
  const command = commands.find((item) =>
    item.id === id && item.device_id === deviceId &&
    item.capability === 'health.check' && item.action === 'status.read' &&
    item.risk_level === 'low'
  );
  if (!command) return 'unknown' as const;
  if (command.status === 'succeeded') return 'succeeded' as const;
  if (command.status === 'failed' || command.status === 'cancelled') return 'failed' as const;
  return 'pending' as const;
}
