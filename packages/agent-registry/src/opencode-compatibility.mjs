/**
 * OpenCode Team role compatibility for the existing ATLAS agent registry.
 * This module selects existing agents; it never creates an independent orchestrator.
 * Production and release governance are deliberately excluded from this adapter.
 */
export const OPENCODE_ROLE_BINDINGS = Object.freeze({
  orchestrator: 'atlas-architect',
  designer: 'atlas-architect',
  frontend: 'atlas-openai-engineer',
  backend: 'atlas-openai-engineer',
  developer: 'atlas-openai-engineer',
  debugger: 'atlas-openai-engineer',
  'security-auditor': 'atlas-reviewer',
});

export function resolveOpenCodeRole(role, agents, options = {}) {
  if (typeof role !== 'string' || !Object.hasOwn(OPENCODE_ROLE_BINDINGS, role)) {
    throw new Error('Unsupported OpenCode role');
  }
  if (!Array.isArray(agents) || !agents.every((agent) => agent && typeof agent.id === 'string')) {
    throw new Error('ATLAS agent registry is required');
  }
  const environment = options.environment ?? 'development';
  if (environment !== 'development' && environment !== 'test') {
    throw new Error('OpenCode compatibility is restricted to development and test');
  }
  const agentId = OPENCODE_ROLE_BINDINGS[role];
  const agent = agents.find((candidate) => candidate.id === agentId);
  if (!agent) throw new Error('Mapped ATLAS agent is not registered');
  if (!Array.isArray(agent.allowedEnvironments) || !agent.allowedEnvironments.includes(environment)) {
    throw new Error('Mapped ATLAS agent is not allowed in this environment');
  }
  const requiredCapability = role === 'security-auditor' ? 'review'
    : role === 'orchestrator' || role === 'designer' ? 'architect' : 'implement';
  if (!Array.isArray(agent.capabilities) || !agent.capabilities.includes(requiredCapability)) {
    throw new Error('Mapped ATLAS agent lacks the required capability');
  }
  return agentId;
}
