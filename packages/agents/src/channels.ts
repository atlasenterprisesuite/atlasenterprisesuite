import type { AgentChannel, AgentVersion } from './types';

export type ResolvedAgentInstructions = {
  core: string;
  channel: string | null;
  permissions: AgentVersion['permissions'];
  tools: AgentVersion['tools'];
  safetyRules: AgentVersion['safetyRules'];
};

export function resolveAgentInstructions(
  version: AgentVersion,
  channel: AgentChannel
): ResolvedAgentInstructions {
  return {
    core: version.coreInstructions,
    channel: version.channelInstructions[channel] ?? null,
    permissions: version.permissions,
    tools: version.tools,
    safetyRules: version.safetyRules
  };
}
