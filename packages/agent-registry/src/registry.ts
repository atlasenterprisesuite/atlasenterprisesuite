import { defaultAgents } from './defaultAgents';
import type { AtlasAgentDefinition } from './types';

const registry = new Map(defaultAgents.map((agent) => [agent.id, agent] as const));

export function getAgent(id: string): AtlasAgentDefinition {
  const agent = registry.get(id);
  if (!agent) throw new Error(`Unknown ATLAS agent: ${id}`);
  return agent;
}

export function listAgents(): AtlasAgentDefinition[] {
  return [...registry.values()].map((agent) => ({ ...agent, permissions: [...agent.permissions], allowedTools: [...agent.allowedTools] }));
}
