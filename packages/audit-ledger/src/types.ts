export type AuditActionType =
  | 'TASK_STARTED'
  | 'GATE_EVALUATED'
  | 'EVIDENCE_RECORDED'
  | 'TASK_FAILED'
  | 'TASK_COMPLETED'
  | 'WORKFLOW_BLOCKED'
  | `execution.${string}`;

export interface AuditLedgerScope {
  organizationId: string;
  tenantId: string;
  workflowId: string;
}

export interface AuditEventPayload extends AuditLedgerScope {
  taskId: string;
  actorId: string;
  actionType: AuditActionType;
  metadata: Record<string, unknown>;
}

export interface AuditLedgerEvent extends AuditEventPayload {
  eventId: string;
  previousStateHash: string;
  nonce: string;
  digestVersion: 1;
  createdAt: string;
  payloadDigest: string;
}

export interface AuditLedgerHead {
  eventId: string;
  payloadDigest: string;
  createdAt: string;
}

export interface AuditChainVerification {
  valid: boolean;
  eventCount: number;
  firstInvalidEventId?: string;
  reason?: string;
}

export interface AuditLedgerStore {
  readHead(scope: AuditLedgerScope): Promise<AuditLedgerHead | null>;
  append(event: AuditLedgerEvent): Promise<AuditLedgerEvent>;
}
