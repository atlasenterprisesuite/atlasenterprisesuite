import type { AtlasAgentDefinition } from './types';

const readTools = ['atlas.task.read', 'atlas.repo.inspect', 'atlas.ci.verify', 'atlas.audit.read'];
const writeTools = [...readTools, 'atlas.code.propose', 'atlas.test.run', 'atlas.pr.create'];
const allWorkStates = ['planning', 'implementation', 'review', 'qa', 'ci'] as const;

export const defaultAgents: AtlasAgentDefinition[] = [
  {
    id: 'atlas-architect', providerId: 'openai', role: 'Architecture',
    capabilities: ['architect', 'plan'],
    permissions: ['ai.task.read', 'ai.task.update', 'ai.delegate', 'ai.repo.read', 'ai.review.submit'],
    allowedTools: [...readTools, 'atlas.agent.delegate', 'atlas.review.request'],
    allowedStates: ['queued', 'planning', 'implementation', 'review'],
    allowedEnvironments: ['development', 'test'], maxDelegationDepth: 2
  },
  {
    id: 'atlas-planner', providerId: 'openai', role: 'Planning',
    capabilities: ['plan'], permissions: ['ai.task.read', 'ai.task.update', 'ai.repo.read'],
    allowedTools: readTools, allowedStates: ['queued', 'planning'],
    allowedEnvironments: ['development', 'test'], maxDelegationDepth: 1
  },
  {
    id: 'atlas-openai-engineer', providerId: 'openai', role: 'Implementation',
    capabilities: ['implement'],
    permissions: ['ai.task.read', 'ai.task.update', 'ai.repo.read', 'ai.code.write', 'ai.test.execute', 'ai.pr.create'],
    allowedTools: writeTools, allowedStates: ['implementation', 'review', 'qa'],
    allowedEnvironments: ['development', 'test'], maxDelegationDepth: 0
  },
  {
    id: 'atlas-copilot-engineer', providerId: 'github-copilot', role: 'Implementation',
    capabilities: ['implement'],
    permissions: ['ai.task.read', 'ai.task.update', 'ai.repo.read', 'ai.code.write', 'ai.test.execute', 'ai.pr.create'],
    allowedTools: writeTools, allowedStates: ['implementation', 'review', 'qa'],
    allowedEnvironments: ['development', 'test'], maxDelegationDepth: 0
  },
  {
    id: 'atlas-gemini-analyst', providerId: 'gemini', role: 'Independent analysis',
    capabilities: ['research', 'review'],
    permissions: ['ai.task.read', 'ai.repo.read', 'ai.ci.read', 'ai.audit.read', 'ai.review.submit'],
    allowedTools: readTools, allowedStates: [...allWorkStates],
    allowedEnvironments: ['development', 'test', 'production'], maxDelegationDepth: 0
  },
  {
    id: 'atlas-reviewer', providerId: 'openai', role: 'Review',
    capabilities: ['review'],
    permissions: ['ai.task.read', 'ai.repo.read', 'ai.review.submit', 'ai.ci.read', 'ai.audit.read'],
    allowedTools: readTools, allowedStates: ['review', 'qa', 'ci'],
    allowedEnvironments: ['development', 'test', 'production'], maxDelegationDepth: 0
  },
  {
    id: 'atlas-qa', providerId: 'github-copilot', role: 'Quality assurance',
    capabilities: ['qa'],
    permissions: ['ai.task.read', 'ai.repo.read', 'ai.test.execute', 'ai.review.submit', 'ai.ci.read'],
    allowedTools: [...readTools, 'atlas.test.run'], allowedStates: ['qa', 'ci'],
    allowedEnvironments: ['development', 'test'], maxDelegationDepth: 0
  },
  {
    id: 'atlas-release-governor', providerId: 'external-mcp', role: 'Release evidence governor',
    capabilities: ['release-govern'],
    permissions: ['ai.task.read', 'ai.ci.read', 'ai.approval.read', 'ai.audit.read', 'ai.deploy.request'],
    allowedTools: [...readTools, 'atlas.deploy.request'],
    allowedStates: ['ci', 'awaiting_human_approval', 'approved'],
    allowedEnvironments: ['production'], maxDelegationDepth: 0
  }
];
