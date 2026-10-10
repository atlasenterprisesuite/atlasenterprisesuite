import { describe, expect, it } from 'vitest';
import { InMemoryAuditSink } from '../../packages/core/src';
import {
  createCouncilTask,
  parseCouncilCommand,
  transitionCouncilTask,
  type CouncilTask,
} from '../../packages/ai-council-core/src';
import { createGitHubCopilotProviderAdapter } from '../../packages/ai-provider-github/src';
import { createCouncilHandoffWorkflow } from '../../packages/ai-council-handoff/src';

const scope = { tenantId: 'tenant-a', organizationId: 'org-a' };

function awaitingApprovalTask(): CouncilTask {
  const command = parseCouncilCommand('/implement\nShip approved AI Council change');
  if (!command) throw new Error('Expected command');
  const received = createCouncilTask(
    {
      ...scope,
      repositoryId: '1329354275',
      discussionId: 'D_kwDO1',
      originCommentId: 'DC_kwDO2',
      requestingActor: 'user-winder',
      command,
      promptHash: 'sha256:test',
      promptSnapshot: '/implement\nShip approved AI Council change',
    },
    { id: () => 'task-1', now: () => '2026-10-10T16:00:00.000Z' },
  );

  const authorized = transitionCouncilTask(received, 'authorized', () => '2026-10-10T16:00:01.000Z');
  const queued = transitionCouncilTask(authorized, 'queued', () => '2026-10-10T16:00:02.000Z');
  const collecting = transitionCouncilTask(queued, 'collecting', () => '2026-10-10T16:00:03.000Z');
  const ready = transitionCouncilTask(collecting, 'ready_for_consensus', () => '2026-10-10T16:00:04.000Z');
  const consensusComplete = transitionCouncilTask(ready, 'consensus_complete', () => '2026-10-10T16:00:05.000Z');
  const decided = Object.freeze({ ...consensusComplete, consensusState: 'approved' as const });
  return transitionCouncilTask(decided, 'awaiting_human_approval', () => '2026-10-10T16:00:06.000Z');
}

function workflow() {
  const audit = new InMemoryAuditSink();
  let auditCounter = 0;
  const service = createCouncilHandoffWorkflow({
    audit,
    now: () => '2026-10-10T16:10:00.000Z',
    auditId: () => `handoff-audit-${++auditCounter}`,
  });
  return { audit, service };
}

describe('ATLAS AI Council implementation handoff', () => {
  it('requires an explicit human approval before handoff', () => {
    const { audit, service } = workflow();
    const approved = service.approve({
      task: awaitingApprovalTask(),
      actorId: 'human-approver',
    });

    expect(approved.state).toBe('ready_for_handoff');
    expect(audit.list(scope).some((event) => event.action === 'ai_council.handoff.approved')).toBe(true);
  });

  it('creates and links an implementation issue before delegating to Copilot', async () => {
    const { service } = workflow();
    const approved = service.approve({
      task: awaitingApprovalTask(),
      actorId: 'human-approver',
    });

    const assignments: unknown[] = [];
    const provider = createGitHubCopilotProviderAdapter({
      baseBranch: 'release/atlas-a-z',
      model: 'copilot-default',
      client: {
        assignIssue: async (input) => {
          assignments.push(input);
          return {
            assignmentId: 'assignment-1',
            url: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/101',
            status: 'assigned',
          };
        },
      },
    });

    const result = await service.delegate({
      task: approved,
      actorId: 'human-approver',
      repositoryFullName: 'atlasenterprisesuite/atlasenterprisesuite',
      issueTitle: 'Implement AI Council handoff',
      issueBody: 'Approved implementation contract',
      provider,
      issueClient: {
        createIssue: async () => ({
          issueNumber: 101,
          url: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/101',
        }),
      },
    });

    expect(result.task.linkedIssue).toBe(101);
    expect(result.task.state).toBe('implementing');
    expect(result.assignment.status).toBe('assigned');
    expect(assignments).toHaveLength(1);
    expect(assignments[0]).toMatchObject({ issueNumber: 101, baseBranch: 'release/atlas-a-z' });
  });

  it('does not fabricate Copilot delegation when assignment fails', async () => {
    const { service } = workflow();
    const approved = service.approve({
      task: awaitingApprovalTask(),
      actorId: 'human-approver',
    });

    const provider = createGitHubCopilotProviderAdapter({
      baseBranch: 'release/atlas-a-z',
      model: 'copilot-default',
      client: {
        assignIssue: async () => {
          throw new Error('Copilot assignment unavailable');
        },
      },
    });

    const result = await service.delegate({
      task: approved,
      actorId: 'human-approver',
      repositoryFullName: 'atlasenterprisesuite/atlasenterprisesuite',
      issueTitle: 'Implement AI Council handoff',
      issueBody: 'Approved implementation contract',
      provider,
      issueClient: {
        createIssue: async () => ({
          issueNumber: 102,
          url: 'https://github.com/atlasenterprisesuite/atlasenterprisesuite/issues/102',
        }),
      },
    });

    expect(result.task.linkedIssue).toBe(102);
    expect(result.task.state).toBe('ready_for_handoff');
    expect(result.assignment).toBeNull();
    expect(result.status).toBe('assignment_failed');
  });

  it('moves into review only after a real pull request is linked', () => {
    const { service } = workflow();
    const approved = service.approve({ task: awaitingApprovalTask(), actorId: 'human-approver' });
    const implementing = Object.freeze({
      ...approved,
      linkedIssue: 101,
      state: 'implementing' as const,
    });

    const reviewing = service.linkPullRequest({
      task: implementing,
      actorId: 'github-copilot',
      prNumber: 77,
    });

    expect(reviewing.linkedPr).toBe(77);
    expect(reviewing.state).toBe('reviewing');
  });

  it('requires exact-SHA CI success and human review approval before completion', () => {
    const { service } = workflow();
    const approved = service.approve({ task: awaitingApprovalTask(), actorId: 'human-approver' });
    const reviewing = Object.freeze({
      ...approved,
      linkedIssue: 101,
      linkedPr: 77,
      state: 'reviewing' as const,
    });

    expect(() =>
      service.complete({
        task: reviewing,
        actorId: 'human-approver',
        prNumber: 77,
        headSha: 'abc123',
        verifiedSha: 'different',
        ciConclusion: 'success',
        reviewApproved: true,
      }),
    ).toThrow(/exact-sha/i);

    expect(() =>
      service.complete({
        task: reviewing,
        actorId: 'human-approver',
        prNumber: 77,
        headSha: 'abc123',
        verifiedSha: 'abc123',
        ciConclusion: 'failure',
        reviewApproved: true,
      }),
    ).toThrow(/ci/i);

    const completed = service.complete({
      task: reviewing,
      actorId: 'human-approver',
      prNumber: 77,
      headSha: 'abc123',
      verifiedSha: 'abc123',
      ciConclusion: 'success',
      reviewApproved: true,
    });

    expect(completed.state).toBe('completed');
    expect(completed.linkedPr).toBe(77);
  });

  it('never treats completion as permission to merge or deploy', () => {
    const { service } = workflow();
    expect(service.capabilities()).toEqual({
      canCreateIssue: true,
      canDelegateImplementation: true,
      canLinkPullRequest: true,
      canVerifyReview: true,
      canMerge: false,
      canDeploy: false,
    });
  });
});
