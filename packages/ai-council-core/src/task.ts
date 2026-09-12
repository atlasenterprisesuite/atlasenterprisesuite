import type { TenantScope } from '../../core/src';
import type { CouncilCommand } from './command';

export type CouncilTaskState =
  | 'received'
  | 'authorized'
  | 'queued'
  | 'collecting'
  | 'ready_for_consensus'
  | 'consensus_complete'
  | 'awaiting_human_approval'
  | 'ready_for_handoff'
  | 'implementing'
  | 'reviewing'
  | 'completed'
  | 'rejected'
  | 'degraded'
  | 'failed'
  | 'cancelled'
  | 'blocked';

export type CouncilConsensusState =
  | 'pending'
  | 'approved'
  | 'approved_with_conditions'
  | 'needs_human_review'
  | 'blocked'
  | 'insufficient_evidence';

export type CouncilTask = Readonly<
  TenantScope & {
    taskId: string;
    repositoryId: string;
    discussionId: string;
    originCommentId: string;
    requestingActor: string;
    command: CouncilCommand;
    promptHash: string;
    promptSnapshot: string;
    state: CouncilTaskState;
    createdAt: string;
    updatedAt: string;
    maxTurns: number;
    turnCount: number;
    linkedIssue: number | null;
    linkedPr: number | null;
    consensusState: CouncilConsensusState;
  }
>;

export type CreateCouncilTaskInput = TenantScope & {
  repositoryId: string;
  discussionId: string;
  originCommentId: string;
  requestingActor: string;
  command: CouncilCommand;
  promptHash: string;
  promptSnapshot: string;
  maxTurns?: number;
};

export function createCouncilTask(
  input: CreateCouncilTaskInput,
  options: { id?: () => string; now?: () => string } = {},
): CouncilTask {
  const now = options.now ?? (() => new Date().toISOString());
  const id = options.id ?? (() => `ai-task-${crypto.randomUUID()}`);
  const timestamp = now();

  return Object.freeze({
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    taskId: id(),
    repositoryId: input.repositoryId,
    discussionId: input.discussionId,
    originCommentId: input.originCommentId,
    requestingActor: input.requestingActor,
    command: structuredClone(input.command),
    promptHash: input.promptHash,
    promptSnapshot: input.promptSnapshot,
    state: 'received' as const,
    createdAt: timestamp,
    updatedAt: timestamp,
    maxTurns: input.maxTurns ?? 6,
    turnCount: 0,
    linkedIssue: null,
    linkedPr: null,
    consensusState: 'pending' as const,
  });
}
