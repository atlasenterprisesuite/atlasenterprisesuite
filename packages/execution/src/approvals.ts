import type { AtlasPermission } from '../../core/src/index';
import type { AtlasExecutionClass } from './types';

export type AtlasRiskClass = 'low' | 'moderate' | 'high' | 'regulated';
export type AtlasApprovalStatus = 'pending' | 'approved' | 'denied' | 'cancelled' | 'expired';

export type AtlasApprovalRequest = {
  approvalId: string;
  taskId: string;
  stepId: string | null;
  organizationId: string;
  module: string;
  requestedBy: string;
  actionSummary: string;
  riskClass: AtlasRiskClass;
  permissionsRequested: AtlasPermission[];
  intendedExternalEffect: string | null;
  targetReference: string | null;
  proposedValues: Record<string, unknown>;
  evidenceIds: string[];
  expiresAt: string | null;
  status: AtlasApprovalStatus;
  approverId: string | null;
  decidedAt: string | null;
  decisionReason: string | null;
};

export type ApprovalPolicyInput = {
  executionClass: AtlasExecutionClass;
  risk: AtlasRiskClass;
  estimatedCost: number;
  approvalCostThreshold?: number;
  preauthorizationValidated?: boolean;
};

export function approvalRequiredFor(input: ApprovalPolicyInput): boolean {
  if (input.estimatedCost < 0) throw new Error('invalid_input');

  if (
    input.approvalCostThreshold !== undefined &&
    input.estimatedCost > input.approvalCostThreshold
  ) {
    return true;
  }

  if (
    input.executionClass === 'execute' &&
    (input.risk === 'high' || input.risk === 'regulated') &&
    !input.preauthorizationValidated
  ) {
    return true;
  }

  return false;
}

export type ApprovalSatisfactionInput = {
  required: boolean;
  approval: Pick<AtlasApprovalRequest, 'status' | 'expiresAt'> | null;
  now?: string | Date;
};

export function assertApprovalSatisfied(input: ApprovalSatisfactionInput): void {
  if (!input.required) return;
  if (!input.approval || input.approval.status !== 'approved') {
    throw new Error('approval_required');
  }

  if (input.approval.expiresAt) {
    const expiresAt = new Date(input.approval.expiresAt).getTime();
    const now = input.now instanceof Date
      ? input.now.getTime()
      : input.now
        ? new Date(input.now).getTime()
        : Date.now();
    if (!Number.isFinite(expiresAt) || expiresAt <= now) {
      throw new Error('approval_required');
    }
  }
}
