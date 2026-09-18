import { describe, expect, it } from 'vitest';
import { workflowsByView } from '../../apps/web/src/work/view-model';
import { workWorkflowFixtures } from '../fixtures/workSovereign';

describe('ATLAS Work view model', () => {
  it('derives Active from canonical status without completed history states', () => {
    const ids = workflowsByView(workWorkflowFixtures, 'active').map((workflow) => workflow.id);
    expect(ids).toContain('wf-now');
    expect(ids).toContain('wf-approval');
    expect(ids).toContain('wf-blocked');
    expect(ids).not.toContain('wf-completed');
    expect(ids).not.toContain('wf-failed');
    expect(ids).not.toContain('wf-cancelled');
  });

  it('derives History from completed, failed and cancelled workflows', () => {
    expect(workflowsByView(workWorkflowFixtures, 'history').map((workflow) => workflow.id)).toEqual([
      'wf-completed', 'wf-failed', 'wf-cancelled'
    ]);
  });

  it('derives Approvals only from awaiting-approval workflows', () => {
    expect(workflowsByView(workWorkflowFixtures, 'approvals').map((workflow) => workflow.id)).toEqual(['wf-approval']);
  });

  it('returns every workflow for the all view', () => {
    expect(workflowsByView(workWorkflowFixtures, 'all')).toHaveLength(workWorkflowFixtures.length);
  });
});
