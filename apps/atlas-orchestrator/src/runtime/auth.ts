import type { TenantScope } from '../../../../packages/core/src/index';
import { getAgent } from '../../../../packages/agent-registry/src';
import type { AtlasActor } from '../../../../packages/governance/src';

export type AtlasMcpSecretEnv = Partial<Record<
  | 'ATLAS_MCP_OPENAI_TOKEN'
  | 'ATLAS_MCP_OPENAI_WRITE_TOKEN'
  | 'ATLAS_MCP_GEMINI_TOKEN'
  | 'ATLAS_MCP_COPILOT_TOKEN'
  | 'ATLAS_MCP_COPILOT_WRITE_TOKEN',
  string
>>;

function bearer(header: string | undefined): string {
  if (!header?.startsWith('Bearer ')) throw new Error('Unauthorized ATLAS MCP client');
  const token = header.slice('Bearer '.length).trim();
  if (!token) throw new Error('Unauthorized ATLAS MCP client');
  return token;
}

function fromRegisteredAgent(agentId: string, scope: TenantScope): AtlasActor {
  const agent = getAgent(agentId);
  return { actorId: agent.id, kind: 'agent', scope, permissions: [...agent.permissions] };
}

function readOnlyActor(actorId: string, scope: TenantScope): AtlasActor {
  return {
    actorId,
    kind: 'agent',
    scope,
    permissions: ['ai.task.read', 'ai.repo.read', 'ai.ci.read', 'ai.audit.read', 'ai.review.submit']
  };
}

export function resolveHttpActor(
  authorization: string | undefined,
  scope: TenantScope,
  secrets: AtlasMcpSecretEnv
): AtlasActor {
  const token = bearer(authorization);

  if (secrets.ATLAS_MCP_GEMINI_TOKEN && token === secrets.ATLAS_MCP_GEMINI_TOKEN) {
    return fromRegisteredAgent('atlas-gemini-analyst', scope);
  }
  if (secrets.ATLAS_MCP_OPENAI_TOKEN && token === secrets.ATLAS_MCP_OPENAI_TOKEN) {
    return readOnlyActor('atlas-openai-reader', scope);
  }
  if (secrets.ATLAS_MCP_COPILOT_TOKEN && token === secrets.ATLAS_MCP_COPILOT_TOKEN) {
    return readOnlyActor('atlas-copilot-reader', scope);
  }
  if (secrets.ATLAS_MCP_OPENAI_WRITE_TOKEN && token === secrets.ATLAS_MCP_OPENAI_WRITE_TOKEN) {
    return fromRegisteredAgent('atlas-openai-engineer', scope);
  }
  if (secrets.ATLAS_MCP_COPILOT_WRITE_TOKEN && token === secrets.ATLAS_MCP_COPILOT_WRITE_TOKEN) {
    return fromRegisteredAgent('atlas-copilot-engineer', scope);
  }

  throw new Error('Unauthorized ATLAS MCP client');
}
