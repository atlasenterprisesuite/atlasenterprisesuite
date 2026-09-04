export type ReconciliationItemStatus = 'resolved' | 'excluded';
export type ReconciliationMatchType =
  | 'matched'
  | 'unmatched'
  | 'duplicate'
  | 'timing_difference'
  | 'transfer'
  | 'manual';

export type StartReconciliationCommand = {
  organizationId: string;
  bankAccountId: string;
  periodStart: string;
  periodEnd: string;
  statementEndingBalance: number;
  ledgerEndingBalance: number;
};

export type ResolveReconciliationItemCommand = {
  organizationId: string;
  itemId: string;
  status: ReconciliationItemStatus;
  matchType: ReconciliationMatchType;
  variance: number;
  note: string | null;
};

export type CloseReconciliationCommand = {
  organizationId: string;
  sessionId: string;
};

export interface BankCashWriteGateway {
  startReconciliation(command: StartReconciliationCommand): Promise<string>;
  resolveReconciliationItem(command: ResolveReconciliationItemCommand): Promise<string>;
  closeReconciliation(command: CloseReconciliationCommand): Promise<string>;
}

function requireText(value: string, message: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(message);
  return normalized;
}

function requireDateOnly(value: string, label: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) {
    throw new Error(`${label} must be YYYY-MM-DD`);
  }
  return value;
}

function requireFinite(value: number, label: string): number {
  const normalized = Number(value);
  if (!Number.isFinite(normalized)) throw new Error(`${label} must be a finite number`);
  return normalized;
}

export class BankCashWriteService {
  constructor(private readonly gateway: BankCashWriteGateway) {}

  async startReconciliation(command: StartReconciliationCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const bankAccountId = requireText(command.bankAccountId, 'Bank account is required');
    const periodStart = requireDateOnly(command.periodStart, 'Reconciliation period start');
    const periodEnd = requireDateOnly(command.periodEnd, 'Reconciliation period end');
    if (periodEnd < periodStart) {
      throw new Error('Reconciliation period end must be on or after period start');
    }
    const statementEndingBalance = requireFinite(command.statementEndingBalance, 'Statement ending balance');
    const ledgerEndingBalance = requireFinite(command.ledgerEndingBalance, 'Ledger ending balance');

    return this.gateway.startReconciliation({
      organizationId,
      bankAccountId,
      periodStart,
      periodEnd,
      statementEndingBalance,
      ledgerEndingBalance,
    });
  }

  async resolveReconciliationItem(command: ResolveReconciliationItemCommand): Promise<string> {
    const organizationId = requireText(command.organizationId, 'Organization is required');
    const itemId = requireText(command.itemId, 'Reconciliation item is required');
    const allowedStatuses: readonly ReconciliationItemStatus[] = ['resolved', 'excluded'];
    if (!allowedStatuses.includes(command.status as ReconciliationItemStatus)) {
      throw new Error('Unsupported reconciliation item status');
    }
    const allowedMatchTypes: readonly ReconciliationMatchType[] = [
      'matched', 'unmatched', 'duplicate', 'timing_difference', 'transfer', 'manual',
    ];
    if (!allowedMatchTypes.includes(command.matchType as ReconciliationMatchType)) {
      throw new Error('Unsupported reconciliation match type');
    }
    const variance = requireFinite(command.variance, 'Reconciliation variance');
    const note = command.note === null ? null : command.note.trim() || null;

    return this.gateway.resolveReconciliationItem({
      organizationId,
      itemId,
      status: command.status,
      matchType: command.matchType,
      variance,
      note,
    });
  }

  async closeReconciliation(command: CloseReconciliationCommand): Promise<string> {
    return this.gateway.closeReconciliation({
      organizationId: requireText(command.organizationId, 'Organization is required'),
      sessionId: requireText(command.sessionId, 'Reconciliation session is required'),
    });
  }
}
