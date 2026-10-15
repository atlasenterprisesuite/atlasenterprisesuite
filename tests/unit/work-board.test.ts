import { describe, expect, it } from 'vitest';
import { EXECUTION_STATUSES } from '../../packages/execution/src/types';
import type { WorkWorkflow } from '../../apps/web/src/work/types';
import { WORK_BOARD_LANES, WORK_STATUS_LANE, buildWorkBoard } from '../../apps/web/src/work/work-board-model';
import { workWorkflowFixtures } from '../fixtures/workSovereign';

const fixtures = workWorkflowFixtures as unknown as readonly WorkWorkflow[];

describe('ATLAS Work board — canonical, read-only projection', () => {
  it('maps every execution status to exactly one known lane', () => {
    expect(Object.keys(WORK_STATUS_LANE).sort()).toEqual([...EXECUTION_STATUSES].sort());
    expect(WORK_BOARD_LANES.map(lane => lane.id)).toEqual([
      'planned', 'in_progress', 'approval', 'blocked', 'closed'
    ]);
  });

  it('projects real workflow state without altering it', () => {
    const before = JSON.stringify(fixtures);
    const columns = buildWorkBoard(fixtures);
    expect(columns.find(lane => lane.id === 'in_progress')?.workflows.map(w => w.id)).toEqual(['wf-now']);
    expect(columns.find(lane => lane.id === 'approval')?.workflows.map(w => w.id)).toEqual(['wf-approval']);
    expect(columns.find(lane => lane.id === 'blocked')?.workflows.map(w => w.id)).toEqual(['wf-blocked']);
    expect(columns.find(lane => lane.id === 'closed')?.workflows.map(w => w.id)).toEqual([
      'wf-completed', 'wf-failed', 'wf-cancelled'
    ]);
    expect(JSON.stringify(fixtures)).toBe(before);
  });

  it('filters by module and search without inventing records', () => {
    expect(buildWorkBoard(fixtures, { module: 'finance' })
      .flatMap(lane => lane.workflows).map(w => w.id)).toEqual(['wf-completed']);
    expect(buildWorkBoard(fixtures, { query: 'STUDIO' })
      .flatMap(lane => lane.workflows).map(w => w.id)).toEqual(['wf-blocked']);
    expect(buildWorkBoard(fixtures, { query: 'missing' })
      .every(lane => lane.workflows.length === 0)).toBe(true);
  });

  it('fails closed if mixed organizations, duplicated ids or unknown statuses are encountered', () => {
    expect(() => buildWorkBoard([...fixtures, { ...fixtures[0], organizationId: 'org-other', id: 'foreign' }]))
      .toThrow('work_board_scope_mismatch');
    expect(() => buildWorkBoard([...fixtures, fixtures[0]])).toThrow('work_board_duplicate_workflow');
    expect(() => buildWorkBoard([{ ...fixtures[0], status: 'invented' as WorkWorkflow['status'] }]))
      .toThrow('work_board_unknown_status');
  });

  it('renders five empty columns for an empty authorized list', () => {
    expect(buildWorkBoard([]).map(lane => lane.workflows.length)).toEqual([0, 0, 0, 0, 0]);
  });
});
