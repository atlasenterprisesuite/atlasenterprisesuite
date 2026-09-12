import { describe, expect, it } from 'vitest';
import { normalizeExecutionState, parseExecutionResponse } from '../../apps/web/src/execution/api';

describe('Guided Execution web API', () => {
  it('whitelists execution state and omits raw action payloads', () => {
    const state = normalizeExecutionState({
      ok: true,
      workflow: {
        id: 'wf-1', org_id: 'org-1', tenant_id: 'tenant-1', workflow_type: 'manager.infrastructure_readiness',
        owner_module: 'manager', status: 'now', current_task_id: 'task-1', current_module: 'manager',
        context: { return_path: '/' }, version: 1
      },
      tasks: [{
        id: 'task-1', workflow_id: 'wf-1', module: 'manager', title: 'Verify infrastructure readiness',
        goal: 'Produce evidence-backed readiness', status: 'now', priority: 'high', current_step_id: 'step-1',
        next_action: 'Verify GitHub', blocked_reason: null, permissions_required: ['execution.read']
      }],
      steps: [{
        id: 'step-1', task_id: 'task-1', sequence: 1, module: 'manager', action_type: 'verify_github',
        action_payload: { secret: 'must-not-cross-ui-boundary' }, status: 'ready', completion_criteria: ['github verified'],
        permissions_required: ['execution.read'], evidence_requirement: ['infra_verification'], started_at: null, completed_at: null
      }],
      dependencies: [], evidence: [], approvals: []
    });

    expect(state.workflow.context).toEqual({ return_path: '/' });
    expect(state.steps[0]).not.toHaveProperty('actionPayload');
    expect(JSON.stringify(state)).not.toContain('must-not-cross-ui-boundary');
  });

  it('drops a non-object workflow context', () => {
    const state = normalizeExecutionState({
      workflow: { id: 'wf-1', context: 'https://example.com' },
      tasks: [], steps: [], dependencies: [], evidence: [], approvals: []
    });
    expect(state.workflow.context).toEqual({});
  });

  it('preserves server error codes', async () => {
    const response = new Response(JSON.stringify({ error: 'workflow_not_found' }), { status: 404 });
    await expect(parseExecutionResponse(response)).rejects.toThrow('workflow_not_found');
  });
});
