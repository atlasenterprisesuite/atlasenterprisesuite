import type { AiPermission, AtlasActor } from '../../governance/src';

export const toolIds = [
  'atlas.task.create', 'atlas.task.read', 'atlas.task.update', 'atlas.task.claim',
  'atlas.agent.delegate', 'atlas.agent.respond', 'atlas.repo.inspect', 'atlas.code.propose',
  'atlas.test.run', 'atlas.review.request', 'atlas.pr.create', 'atlas.ci.verify',
  'atlas.deploy.request', 'atlas.audit.read'
] as const;

export type AtlasToolId = (typeof toolIds)[number];

export const toolPermission: Record<AtlasToolId, AiPermission> = {
  'atlas.task.create': 'ai.task.create',
  'atlas.task.read': 'ai.task.read',
  'atlas.task.update': 'ai.task.update',
  'atlas.task.claim': 'ai.task.update',
  'atlas.agent.delegate': 'ai.delegate',
  'atlas.agent.respond': 'ai.task.update',
  'atlas.repo.inspect': 'ai.repo.read',
  'atlas.code.propose': 'ai.code.write',
  'atlas.test.run': 'ai.test.execute',
  'atlas.review.request': 'ai.review.submit',
  'atlas.pr.create': 'ai.pr.create',
  'atlas.ci.verify': 'ai.ci.read',
  'atlas.deploy.request': 'ai.deploy.request',
  'atlas.audit.read': 'ai.audit.read'
};

export function visibleToolIds(actor: AtlasActor): AtlasToolId[] {
  return toolIds.filter((toolId) => actor.permissions.includes(toolPermission[toolId]));
}
