import type { AiPermission } from '../../governance/src';
import type { AtlasTaskState } from '../../task-protocol/src';

export type AgentCapability = 'plan' | 'architect' | 'research' | 'implement' | 'review' | 'qa' | 'release-govern';
export type AgentProviderId = 'openai' | 'github-copilot' | 'gemini' | 'external-mcp';

export interface AtlasAgentDefinition {
  id: string;
  providerId: AgentProviderId;
  role: string;
  capabilities: AgentCapability[];
  permissions: AiPermission[];
  allowedTools: string[];
  allowedStates: AtlasTaskState[];
  allowedEnvironments: Array<'development' | 'test' | 'production'>;
  maxDelegationDepth: number;
}
