export type ConnectedAppApprovalRequestInput = {
  taskId: string;
  capabilityCode: string;
  summary: string;
};

export function connectedAppApprovalRequest(input: ConnectedAppApprovalRequestInput) {
  return {
    operation: 'request_approval' as const,
    task_id: input.taskId,
    approval_type: 'connected_app_action',
    required_permission: 'execution.approve',
    risk_level: 'high' as const,
    summary: `${input.capabilityCode}: ${input.summary}`
  };
}

export function connectedAppApprovalSatisfiesAction(
  approval: { status: string; payload_digest: string },
  actionDigest: string
): boolean {
  return approval.status === 'approved' && approval.payload_digest === actionDigest;
}
