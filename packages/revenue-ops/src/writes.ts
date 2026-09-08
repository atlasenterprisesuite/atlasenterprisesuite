import type {
  CrmAccount,
  CrmContact,
  InventoryMovement,
  Opportunity,
  PosTransaction,
  ProjectRecord,
  PurchaseOrder,
  SalesOrder,
} from './types';
import type { RevenueScope } from './repository';

export interface RevenueActor {
  actorId: string;
  permissions: string[];
}

export interface RevenueWriteContext {
  scope: RevenueScope;
  actor: RevenueActor;
  reason?: string;
}

export interface RevenueOpsWrites {
  createAccount(context: RevenueWriteContext, input: Omit<CrmAccount, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<CrmAccount>;
  createContact(context: RevenueWriteContext, input: Omit<CrmContact, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<CrmContact>;
  createOpportunity(context: RevenueWriteContext, input: Omit<Opportunity, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<Opportunity>;
  createSalesOrder(context: RevenueWriteContext, input: Omit<SalesOrder, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<SalesOrder>;
  createPurchaseOrder(context: RevenueWriteContext, input: Omit<PurchaseOrder, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<PurchaseOrder>;
  recordInventoryMovement(context: RevenueWriteContext, input: Omit<InventoryMovement, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<InventoryMovement>;
  createPosTransaction(context: RevenueWriteContext, input: Omit<PosTransaction, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<PosTransaction>;
  createProject(context: RevenueWriteContext, input: Omit<ProjectRecord, 'id' | 'tenantId' | 'organizationId' | 'createdAt' | 'updatedAt'>): Promise<ProjectRecord>;
}

export function requireRevenuePermission(context: RevenueWriteContext, permission: string): void {
  if (!context.scope.tenantId || !context.scope.organizationId) {
    throw new Error('Revenue write requires tenant and organization scope');
  }
  if (!context.actor.actorId) {
    throw new Error('Revenue write requires an authenticated actor');
  }
  if (!context.actor.permissions.includes(permission)) {
    throw new Error(`Missing required permission: ${permission}`);
  }
}

export const revenuePermissions = {
  crmManage: 'revenue.crm.manage',
  salesManage: 'revenue.sales.manage',
  purchasingManage: 'revenue.purchasing.manage',
  inventoryManage: 'revenue.inventory.manage',
  posManage: 'revenue.pos.manage',
  projectsManage: 'revenue.projects.manage',
} as const;
