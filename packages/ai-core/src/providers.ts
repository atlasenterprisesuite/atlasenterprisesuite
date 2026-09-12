import type { AtlasFinding } from '../../task-protocol/src';

export interface ProviderInvocation {
  taskId: string;
  agentId: string;
  prompt: string;
  allowedTools: string[];
  correlationId: string;
}

export interface ProviderResult {
  finalOutput: string;
  traceId: string | null;
  findings: AtlasFinding[];
}

export interface ProviderAdapter {
  readonly providerId: string;
  invoke(input: ProviderInvocation): Promise<ProviderResult>;
}
