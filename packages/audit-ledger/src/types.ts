export const SOURCE_AUDIT_ACTION_TYPES = [
  'TASK_STARTED',
  'GATE_EVALUATED',
  'EVIDENCE_RECORDED',
  'TASK_FAILED',
  'TASK_COMPLETED',
  'WORKFLOW_BLOCKED'
] as const;

export type AuditActionType =
  | (typeof SOURCE_AUDIT_ACTION_TYPES)[number]
  | `execution.${string}`;

const SOURCE_AUDIT_ACTION_SET = new Set<string>(SOURCE_AUDIT_ACTION_TYPES);
const EXECUTION_AUDIT_ACTION_PATTERN = /^execution\.[a-z0-9_.-]{1,100}$/;

export function assertValidAuditActionType(value: string): asserts value is AuditActionType {
  if (SOURCE_AUDIT_ACTION_SET.has(value) || EXECUTION_AUDIT_ACTION_PATTERN.test(value)) return;
  throw new Error('audit_ledger_invalid_action_type');
}

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
  readChain(scope: AuditLedgerScope): Promise<AuditLedgerEvent[]>;
  append(event: AuditLedgerEvent): Promise<AuditLedgerEvent>;
}

export interface AuditLedgerService {
  recordEvent(event: AuditEventPayload): Promise<{ eventId: string; digest: string }>;
  verifyChainIntegrity(
    scope: AuditLedgerScope,
    options?: { allowEmpty?: boolean }
  ): Promise<AuditChainVerification>;
}
