import { describe, expect, it } from 'vitest';
import {
  connectedAppApprovalRequest,
  connectedAppApprovalSatisfiesAction
} from '../../supabase/functions/_shared/connected-apps/work-approval';

describe('Connected Apps Work approval bridge', () => {
  it('routes consequential actions through the existing execution approval engine', () => {
    const request = connectedAppApprovalRequest({
      taskId: 'task-1',
      capabilityCode: 'mail.send',
      summary: 'Send approved message'
    });
    expect(request.operation).toBe('request_approval');
    expect(request.approval_type).toBe('connected_app_action');
    expect(request.required_permission).toBe('execution.approve');
    expect(request.risk_level).toBe('high');
  });

  it('rejects changed rejected expired or pending approvals', () => {
    const digest = 'a'.repeat(64);
    const changed = 'b'.repeat(64);
    expect(connectedAppApprovalSatisfiesAction({ status: 'approved', payload_digest: digest }, digest)).toBe(true);
    expect(connectedAppApprovalSatisfiesAction({ status: 'approved', payload_digest: digest }, changed)).toBe(false);
    expect(connectedAppApprovalSatisfiesAction({ status: 'rejected', payload_digest: digest }, digest)).toBe(false);
    expect(connectedAppApprovalSatisfiesAction({ status: 'pending', payload_digest: digest }, digest)).toBe(false);
  });
});
