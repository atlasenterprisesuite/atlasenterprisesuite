import type { AtlasPermission, TenantScope } from '../../core/src';

export type AgentStatus = 'draft' | 'review' | 'approved' | 'published' | 'retired';

export type AgentChannel =
  | 'web'
  | 'mobile'
  | 'voice'
  | 'whatsapp'
  | 'email'
  | 'operator_console';

export type AgentVersion = {
  agentId: string;
  versionId: string;
  parentVersionId: string | null;
  scope: TenantScope;
  status: AgentStatus;
  provider: string;
  model: string;
  coreInstructions: string;
  permissions: readonly AtlasPermission[];
  tools: readonly string[];
  safetyRules: readonly string[];
  channelInstructions: Readonly<Partial<Record<AgentChannel, string>>>;
  createdByActorId: string;
  createdAt: string;
  publishedAt?: string;
};

export type AgentDraftInput = Omit<AgentVersion, 'status' | 'publishedAt'>;
