import { integrationError } from './context';

export type IntegrationApprovalPolicy = {
  requiresApproval: boolean;
};

export type IntegrationApprovalOperation = {
  operation: string;
  provider?: string;
  connectionId?: string | null;
  environment?: string | null;
  capability?: string | null;
};

export type IntegrationApprovalAdapter = {
  requireApproved(operation: IntegrationApprovalOperation): Promise<{
    approved: true;
    approvalId: string;
  }>;
};

export async function requireApprovalIfConfigured(
  policy: IntegrationApprovalPolicy,
  operation: IntegrationApprovalOperation,
  approvalAdapter?: IntegrationApprovalAdapter
) {
  if (!policy.requiresApproval) return { approved: true as const, approvalId: null };
  if (!approvalAdapter) throw integrationError('approval_required', 409);
  return approvalAdapter.requireApproved(operation);
}
