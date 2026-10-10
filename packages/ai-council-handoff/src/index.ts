import {
  transitionCouncilTask,
  type CouncilProviderAdapter,
  type CouncilTask,
} from '../../ai-council-core/src';
import type { AuditEvent, AuditSink } from '../../core/src';

export type CouncilImplementationAssignment = Readonly<{
  assignmentId: string;
  url: string;
  status: 'assigned' | 'queued' | 'failed';
}>;

export type CouncilIssueClient = {
  createIssue(input: {
    repositoryFullName: string;
    title: string;
    body: string;
  }): Promise<{ issueNumber: number; url: string }>;
};

function appendAudit(
  audit: AuditSink,
  event: Omit<AuditEvent, 'id' | 'timestamp'>,
  options: { id: () => string; now: () => string },
): void {
  audit.append({
    ...event,
    id: options.id(),
    timestamp: options.now(),
  });
}

function requireState(task: CouncilTask, state: CouncilTask['state'], operation: string): void {
  if (task.state !== state) {
    throw new Error(`AI Council ${operation} requires ${state} task, got ${task.state}`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer`);
  }
}

function withIssue(task: CouncilTask, issueNumber: number, now: () => string): CouncilTask {
  return Object.freeze({
    ...task,
    linkedIssue: issueNumber,
    updatedAt: now(),
  });
}

function withPullRequest(task: CouncilTask, prNumber: number, now: () => string): CouncilTask {
  return Object.freeze({
    ...task,
    linkedPr: prNumber,
    updatedAt: now(),
  });
}

export function createCouncilHandoffWorkflow(options: {
  audit: AuditSink;
  now?: () => string;
  auditId?: () => string;
}) {
  const now = options.now ?? (() => new Date().toISOString());
  const auditId = options.auditId ?? (() => `ai-handoff-audit-${crypto.randomUUID()}`);

  return Object.freeze({
    capabilities() {
      return Object.freeze({
        canCreateIssue: true,
        canDelegateImplementation: true,
        canLinkPullRequest: true,
        canVerifyReview: true,
        canMerge: false,
        canDeploy: false,
      });
    },

    approve(input: {
      task: CouncilTask;
      actorId: string;
    }): CouncilTask {
      requireState(input.task, 'awaiting_human_approval', 'human approval');

      if (
        input.task.consensusState !== 'approved' &&
        input.task.consensusState !== 'approved_with_conditions' &&
        input.task.consensusState !== 'needs_human_review'
      ) {
        throw new Error(
          `AI Council handoff cannot approve consensus state ${input.task.consensusState}`,
        );
      }

      const task = transitionCouncilTask(input.task, 'ready_for_handoff', now);

      appendAudit(
        options.audit,
        {
          tenantId: task.tenantId,
          organizationId: task.organizationId,
          actorId: input.actorId,
          action: 'ai_council.handoff.approved',
          entityType: 'ai_council_task',
          entityId: task.taskId,
          before: {
            state: input.task.state,
            consensusState: input.task.consensusState,
          },
          after: {
            state: task.state,
            consensusState: task.consensusState,
          },
          correlationId: task.taskId,
        },
        { id: auditId, now },
      );

      return task;
    },

    async delegate(input: {
      task: CouncilTask;
      actorId: string;
      repositoryFullName: string;
      issueTitle: string;
      issueBody: string;
      issueClient: CouncilIssueClient;
      provider: CouncilProviderAdapter<CouncilImplementationAssignment>;
    }): Promise<Readonly<{
      task: CouncilTask;
      issue: { issueNumber: number; url: string };
      assignment: CouncilImplementationAssignment | null;
      status: 'delegated' | 'assignment_failed';
    }>> {
      requireState(input.task, 'ready_for_handoff', 'implementation delegation');

      if (!input.provider.capabilities().implementation) {
        throw new Error(
          `AI Council provider ${input.provider.providerId} does not support implementation`,
        );
      }

      const issue = await input.issueClient.createIssue({
        repositoryFullName: input.repositoryFullName,
        title: input.issueTitle,
        body: [
          `ATLAS Task: \`${input.task.taskId}\``,
          `Consensus: \`${input.task.consensusState}\``,
          '',
          input.issueBody,
        ].join('\n'),
      });

      requirePositiveInteger(issue.issueNumber, 'Issue number');
      const linkedTask = withIssue(input.task, issue.issueNumber, now);

      appendAudit(
        options.audit,
        {
          tenantId: linkedTask.tenantId,
          organizationId: linkedTask.organizationId,
          actorId: input.actorId,
          action: 'ai_council.handoff.issue_linked',
          entityType: 'ai_council_task',
          entityId: linkedTask.taskId,
          before: { linkedIssue: input.task.linkedIssue },
          after: { linkedIssue: linkedTask.linkedIssue, issueUrl: issue.url },
          correlationId: linkedTask.taskId,
        },
        { id: auditId, now },
      );

      try {
        const assignment = await input.provider.invoke({
          task: linkedTask,
          prompt: linkedTask.promptSnapshot,
          policyContext: Object.freeze({
            phase: 'implementation_handoff',
            consensusState: linkedTask.consensusState,
          }),
        });

        if (assignment.status === 'failed') {
          appendAudit(
            options.audit,
            {
              tenantId: linkedTask.tenantId,
              organizationId: linkedTask.organizationId,
              actorId: input.actorId,
              action: 'ai_council.handoff.assignment_failed',
              entityType: 'ai_council_task',
              entityId: linkedTask.taskId,
              before: null,
              after: {
                provider: input.provider.providerId,
                issueNumber: issue.issueNumber,
                assignmentId: assignment.assignmentId,
              },
              correlationId: linkedTask.taskId,
            },
            { id: auditId, now },
          );

          return Object.freeze({
            task: linkedTask,
            issue,
            assignment: null,
            status: 'assignment_failed' as const,
          });
        }

        const implementing = transitionCouncilTask(linkedTask, 'implementing', now);

        appendAudit(
          options.audit,
          {
            tenantId: implementing.tenantId,
            organizationId: implementing.organizationId,
            actorId: input.actorId,
            action: 'ai_council.handoff.delegated',
            entityType: 'ai_council_task',
            entityId: implementing.taskId,
            before: { state: linkedTask.state },
            after: {
              state: implementing.state,
              provider: input.provider.providerId,
              issueNumber: issue.issueNumber,
              assignmentId: assignment.assignmentId,
              assignmentStatus: assignment.status,
              assignmentUrl: assignment.url,
            },
            correlationId: implementing.taskId,
          },
          { id: auditId, now },
        );

        return Object.freeze({
          task: implementing,
          issue,
          assignment,
          status: 'delegated' as const,
        });
      } catch {
        appendAudit(
          options.audit,
          {
            tenantId: linkedTask.tenantId,
            organizationId: linkedTask.organizationId,
            actorId: input.actorId,
            action: 'ai_council.handoff.assignment_failed',
            entityType: 'ai_council_task',
            entityId: linkedTask.taskId,
            before: null,
            after: {
              provider: input.provider.providerId,
              issueNumber: issue.issueNumber,
              status: 'failed',
            },
            correlationId: linkedTask.taskId,
          },
          { id: auditId, now },
        );

        return Object.freeze({
          task: linkedTask,
          issue,
          assignment: null,
          status: 'assignment_failed' as const,
        });
      }
    },

    linkPullRequest(input: {
      task: CouncilTask;
      actorId: string;
      prNumber: number;
    }): CouncilTask {
      requireState(input.task, 'implementing', 'pull request linkage');
      if (input.task.linkedIssue == null) {
        throw new Error('AI Council pull request linkage requires a linked Issue');
      }
      requirePositiveInteger(input.prNumber, 'Pull request number');

      const linked = withPullRequest(input.task, input.prNumber, now);
      const reviewing = transitionCouncilTask(linked, 'reviewing', now);

      appendAudit(
        options.audit,
        {
          tenantId: reviewing.tenantId,
          organizationId: reviewing.organizationId,
          actorId: input.actorId,
          action: 'ai_council.handoff.pr_linked',
          entityType: 'ai_council_task',
          entityId: reviewing.taskId,
          before: {
            state: input.task.state,
            linkedPr: input.task.linkedPr,
          },
          after: {
            state: reviewing.state,
            linkedPr: reviewing.linkedPr,
          },
          correlationId: reviewing.taskId,
        },
        { id: auditId, now },
      );

      return reviewing;
    },

    complete(input: {
      task: CouncilTask;
      actorId: string;
      prNumber: number;
      headSha: string;
      verifiedSha: string;
      ciConclusion: 'success' | 'failure' | 'cancelled' | 'skipped' | 'pending';
      reviewApproved: boolean;
    }): CouncilTask {
      requireState(input.task, 'reviewing', 'review completion');
      requirePositiveInteger(input.prNumber, 'Pull request number');

      if (input.task.linkedPr !== input.prNumber) {
        throw new Error('AI Council review PR does not match the linked pull request');
      }
      if (!input.headSha || !input.verifiedSha || input.headSha !== input.verifiedSha) {
        throw new Error('AI Council exact-SHA verification failed');
      }
      if (input.ciConclusion !== 'success') {
        throw new Error(`AI Council CI verification requires success, got ${input.ciConclusion}`);
      }
      if (!input.reviewApproved) {
        throw new Error('AI Council human review approval is required');
      }

      const completed = transitionCouncilTask(input.task, 'completed', now);

      appendAudit(
        options.audit,
        {
          tenantId: completed.tenantId,
          organizationId: completed.organizationId,
          actorId: input.actorId,
          action: 'ai_council.handoff.review_verified',
          entityType: 'ai_council_task',
          entityId: completed.taskId,
          before: { state: input.task.state },
          after: {
            state: completed.state,
            linkedPr: completed.linkedPr,
            verifiedSha: input.verifiedSha,
            ciConclusion: input.ciConclusion,
            reviewApproved: true,
            mergeAuthorized: false,
            deployAuthorized: false,
          },
          correlationId: completed.taskId,
        },
        { id: auditId, now },
      );

      return completed;
    },
  });
}
