import type {
  OpportunityStage,
  PosSettlementState,
  PurchaseOrderStatus,
  SalesOrderStatus,
} from './types';

const opportunityTransitions: Record<OpportunityStage, OpportunityStage[]> = {
  lead: ['qualified', 'lost'],
  qualified: ['proposal', 'lost'],
  proposal: ['negotiation', 'won', 'lost'],
  negotiation: ['won', 'lost'],
  won: [],
  lost: [],
};

const salesOrderTransitions: Record<SalesOrderStatus, SalesOrderStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['confirmed', 'cancelled'],
  confirmed: ['fulfilled', 'cancelled'],
  fulfilled: [],
  cancelled: [],
};

const purchaseOrderTransitions: Record<PurchaseOrderStatus, PurchaseOrderStatus[]> = {
  draft: ['approved', 'cancelled'],
  approved: ['ordered', 'cancelled'],
  ordered: ['received', 'cancelled'],
  received: [],
  cancelled: [],
};

const settlementTransitions: Record<PosSettlementState, PosSettlementState[]> = {
  unconfigured: [],
  pending: ['settled', 'failed'],
  settled: [],
  failed: ['pending'],
};

export function canTransitionOpportunity(from: OpportunityStage, to: OpportunityStage) {
  return opportunityTransitions[from].includes(to);
}

export function canTransitionSalesOrder(from: SalesOrderStatus, to: SalesOrderStatus) {
  return salesOrderTransitions[from].includes(to);
}

export function canTransitionPurchaseOrder(from: PurchaseOrderStatus, to: PurchaseOrderStatus) {
  return purchaseOrderTransitions[from].includes(to);
}

export function canTransitionSettlement(from: PosSettlementState, to: PosSettlementState) {
  return settlementTransitions[from].includes(to);
}

export function assertTenantScope(
  expected: { tenantId: string; organizationId: string },
  actual: { tenantId: string; organizationId: string },
) {
  if (expected.tenantId !== actual.tenantId || expected.organizationId !== actual.organizationId) {
    throw new Error('REVENUE_OPS_SCOPE_MISMATCH');
  }
}
