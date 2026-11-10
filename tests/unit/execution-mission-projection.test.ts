import { describe, expect, it } from 'vitest';
import { projectMission, projectMissionEvents } from '../../packages/execution/src/mission-projection';
import type { ExecutionAuditEvent, ExecutionWorkflow } from '../../packages/execution/src/types';

const workflowBase: ExecutionWorkflow = {
  id: 'workflow-1',
  scope: { tenantId: 'tenant-1', organizationId: 'org-1' },
  workflowType: 'capability_mission',
  ownerModule: 'communication',
  status: 'draft',
  currentTaskId: 'task-1',
  currentModule: 'communication',
  context: {
    requestedOutcome: 'Place a governed outbound call',
    capabilityIds: ['communications.voice.call.create'],
    correlationId: 'corr-1'
  },
  createdByUserId: 'user-1',
  version: 1,
  createdAt: '2026-10-04T14:00:00.000Z',
  updatedAt: '2026-10-04T14:01:00.000Z',
  completedAt: null
};

describe('ATLAS mission projection', () => {
  it.each([
    ['draft', 'pending'],
    ['now', 'running'],
    ['next', 'running'],
    ['automatable', 'running'],
    ['delegated', 'running'],
    ['blocked', 'blocked'],
    ['awaiting_approval', 'blocked'],
    ['completed', 'succeeded'],
    ['failed', 'failed'],
    ['cancelled', 'cancelled']
  ] as const)('maps execution state %s to mission state %s', (status, expected) => {
    const projection = projectMission({ workflow: { ...workflowBase, status } });
    expect(projection.state).toBe(expected);
    expect(projection.missionId).toBe(workflowBase.id);
    expect(projection.workflowId).toBe(workflowBase.id);
    expect(projection.correlationId).toBe('corr-1');
  });

  it('excludes unknown capability ids and returns a projection warning', () => {
    const projection = projectMission({
      workflow: {
        ...workflowBase,
        context: {
          ...workflowBase.context,
          capabilityIds: ['communications.voice.call.create', 'communications.unknown']
        }
      }
    });

    expect(projection.capabilityIds).toEqual(['communications.voice.call.create']);
    expect(projection.warnings).toEqual(['unknown_capability:communications.unknown']);
  });

  it('projects audit lineage without creating a second mission identifier', () => {
    const audit: ExecutionAuditEvent = {
      id: 'event-1',
      scope: workflowBase.scope,
      actorUserId: 'user-1',
      taskId: 'task-1',
      workflowId: workflowBase.id,
      module: 'communication',
      action: 'capability:communications.voice.call.create:provider_response_received',
      previousState: 'running',
      resultingState: 'completed',
      evidenceIds: ['evidence-1'],
      correlationId: 'corr-1',
      createdAt: '2026-10-04T14:02:00.000Z'
    };

    expect(projectMissionEvents({ workflow: workflowBase, auditEvents: [audit] })).toEqual([
      {
        eventId: 'event-1',
        missionId: workflowBase.id,
        workflowId: workflowBase.id,
        taskId: 'task-1',
        capabilityId: 'communications.voice.call.create',
        type: 'provider_response_received',
        correlationId: 'corr-1',
        evidenceIds: ['evidence-1'],
        createdAt: '2026-10-04T14:02:00.000Z'
      }
    ]);
  });
});
