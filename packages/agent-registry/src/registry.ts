import { defaultAgents } from './defaultAgents';
import type { AtlasAgentDefinition } from './types';

// Keep a detached canonical snapshot: callers must not modify registry authority
// by mutating a returned agent or the exported default-agent definitions.
function copyAgent(agent: AtlasAgentDefinition): AtlasAgentDefinition {
  return {
    ...agent,
    capabilities: [...agent.capabilities],
    permissions: [...agent.permissions],
    allowedTools: [...agent.allowedTools],
    allowedStates: [...agent.allowedStates],
    allowedEnvironments: [...agent.allowedEnvironments]
  };
}

const registry = new Map(defaultAgents.map((agent) => [agent.id, copyAgent(agent)] as const));

export function getAgent(id: string): AtlasAgentDefinition {
  const agent = registry.get(id);
  if (!agent) throw new Error(`Unknown ATLAS agent: ${id}`);
  return copyAgent(agent);
}

export function listAgents(): AtlasAgentDefinition[] {
  return [...registry.values()].map(copyAgent);
}
