import type { TenantScope } from '../../core/src/index';
import type { AtlasTaskState } from '../../task-protocol/src';
import { authorize, type AtlasActor } from './permissions';

export function canHumanApproveRelease(
  actor: AtlasActor,
  targetScope: TenantScope,
  taskState: AtlasTaskState
): boolean {
  return actor.kind === 'human'
    && taskState === 'awaiting_human_approval'
    && authorize(actor, 'release.approve', targetScope).allowed;
}
