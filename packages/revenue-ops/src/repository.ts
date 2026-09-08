import type {
  CrmAccount,
  CrmContact,
  InventoryItem,
  InventoryMovement,
  Opportunity,
  PosTransaction,
  ProjectRecord,
  PurchaseOrder,
  RevenueRecordId,
  SalesOrder,
} from './types';

export interface RevenueScope {
  tenantId: string;
  organizationId: string;
}

export interface RevenueOpsRepository {
  listAccounts(scope: RevenueScope): Promise<CrmAccount[]>;
  getAccount(scope: RevenueScope, id: RevenueRecordId): Promise<CrmAccount | null>;
  listContacts(scope: RevenueScope, accountId?: RevenueRecordId): Promise<CrmContact[]>;
  listOpportunities(scope: RevenueScope, accountId?: RevenueRecordId): Promise<Opportunity[]>;
  listSalesOrders(scope: RevenueScope, accountId?: RevenueRecordId): Promise<SalesOrder[]>;
  listPurchaseOrders(scope: RevenueScope): Promise<PurchaseOrder[]>;
  listInventoryItems(scope: RevenueScope): Promise<InventoryItem[]>;
  listInventoryMovements(scope: RevenueScope, itemId?: RevenueRecordId): Promise<InventoryMovement[]>;
  listPosTransactions(scope: RevenueScope): Promise<PosTransaction[]>;
  listProjects(scope: RevenueScope): Promise<ProjectRecord[]>;
}

export function requireRevenueScope(scope: RevenueScope): RevenueScope {
  if (!scope.tenantId || !scope.organizationId) {
    throw new Error('Revenue operations require tenantId and organizationId');
  }
  return scope;
}
