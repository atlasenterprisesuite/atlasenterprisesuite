export type RevenueRecordId = string;

export type OpportunityStage =
  | 'lead'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost';

export type SalesOrderStatus =
  | 'draft'
  | 'approved'
  | 'confirmed'
  | 'fulfilled'
  | 'cancelled';

export type PurchaseOrderStatus =
  | 'draft'
  | 'approved'
  | 'ordered'
  | 'received'
  | 'cancelled';

export type InventoryMovementType = 'receipt' | 'issue' | 'transfer' | 'adjustment';

export type PosSettlementState = 'unconfigured' | 'pending' | 'settled' | 'failed';

export interface TenantScopedEntity {
  id: RevenueRecordId;
  tenantId: string;
  organizationId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmAccount extends TenantScopedEntity {
  name: string;
  externalReference?: string;
  status: 'active' | 'inactive';
}

export interface CrmContact extends TenantScopedEntity {
  accountId?: RevenueRecordId;
  displayName: string;
  email?: string;
  phone?: string;
}

export interface Opportunity extends TenantScopedEntity {
  accountId?: RevenueRecordId;
  name: string;
  stage: OpportunityStage;
  expectedValueCents: number;
  currency: string;
  expectedCloseDate?: string;
  lostReason?: string;
}

export interface SalesOrder extends TenantScopedEntity {
  accountId: RevenueRecordId;
  opportunityId?: RevenueRecordId;
  orderNumber: string;
  status: SalesOrderStatus;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  currency: string;
}

export interface PurchaseOrder extends TenantScopedEntity {
  vendorId: RevenueRecordId;
  orderNumber: string;
  status: PurchaseOrderStatus;
  totalCents: number;
  currency: string;
}

export interface InventoryItem extends TenantScopedEntity {
  sku: string;
  name: string;
  active: boolean;
}

export interface InventoryMovement extends TenantScopedEntity {
  itemId: RevenueRecordId;
  movementType: InventoryMovementType;
  quantity: number;
  fromLocationId?: RevenueRecordId;
  toLocationId?: RevenueRecordId;
  referenceType?: string;
  referenceId?: RevenueRecordId;
}

export interface PosTransaction extends TenantScopedEntity {
  transactionNumber: string;
  totalCents: number;
  currency: string;
  settlementState: PosSettlementState;
  settlementProvider?: string;
}

export interface ProjectRecord extends TenantScopedEntity {
  name: string;
  status: 'planned' | 'active' | 'on_hold' | 'completed' | 'cancelled';
  ownerEmployeeId?: RevenueRecordId;
}
