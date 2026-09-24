import type { AgentDraftInput, AgentStatus, AgentVersion } from './types';

const transitions: Record<AgentStatus, readonly AgentStatus[]> = {
  draft: ['review'],
  review: ['draft', 'approved'],
  approved: ['draft', 'published'],
  published: ['retired'],
  retired: []
};

export const canTransitionAgentStatus = (from: AgentStatus, to: AgentStatus) =>
  transitions[from].includes(to);

export function createAgentDraft(input: AgentDraftInput): AgentVersion {
  return {
    ...input,
    scope: { ...input.scope },
    status: 'draft',
    permissions: [...input.permissions],
    tools: [...input.tools],
    safetyRules: [...input.safetyRules],
    channelInstructions: { ...input.channelInstructions }
  };
}

export function transitionAgentStatus(
  version: AgentVersion,
  to: AgentStatus
): AgentVersion {
  if (!canTransitionAgentStatus(version.status, to)) {
    throw new Error('invalid_agent_status_transition');
  }

  return { ...version, status: to };
}
