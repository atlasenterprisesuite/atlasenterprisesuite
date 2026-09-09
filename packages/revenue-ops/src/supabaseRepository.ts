import type { SupabaseClient } from '@supabase/supabase-js';
import type { RevenueOpsRepository, RevenueScope } from './repository';
import type {
  CrmAccount,
  CrmContact,
  InventoryItem,
  InventoryMovement,
  Opportunity,
  PosTransaction,
  ProjectRecord,
  PurchaseOrder,
  SalesOrder,
} from './types';

function scopedRows<T extends Record<string, unknown>>(
  rows: readonly T[],
  scope: RevenueScope,
): T[] {
  return rows.filter((row) => row.tenant_id === scope.tenantId && row.org_id === scope.organizationId);
}

export class SupabaseRevenueOpsRepository implements RevenueOpsRepository {
  constructor(private readonly client: SupabaseClient) {}

  private async listRows<T extends Record<string, unknown>>(table: string, scope: RevenueScope): Promise<T[]> {
    const { data, error } = await this.client
      .from(table)
      .select('*')
      .eq('tenant_id', scope.tenantId)
      .eq('org_id', scope.organizationId);

    if (error) throw new Error(`Revenue Operations query failed for ${table}: ${error.message}`);
    return scopedRows((data ?? []) as T[], scope);
  }

  async listAccounts(scope: RevenueScope): Promise<CrmAccount[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_accounts', scope);
    return rows.map((row) => ({
      id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
      name: String(row.name), externalReference: row.external_reference ? String(row.external_reference) : undefined,
      status: row.status === 'inactive' ? 'inactive' : 'active',
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }));
  }

  async getAccount(scope: RevenueScope, id: string): Promise<CrmAccount | null> {
    const rows = await this.listAccounts(scope);
    return rows.find((row) => row.id === id) ?? null;
  }

  async listContacts(scope: RevenueScope, accountId?: string): Promise<CrmContact[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_contacts', scope);
    return rows
      .filter((row) => !accountId || row.account_id === accountId)
      .map((row) => ({
        id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
        accountId: row.account_id ? String(row.account_id) : undefined,
        displayName: String(row.display_name), email: row.email ? String(row.email) : undefined,
        phone: row.phone ? String(row.phone) : undefined,
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      }));
  }

  async listOpportunities(scope: RevenueScope, accountId?: string): Promise<Opportunity[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_opportunities', scope);
    return rows
      .filter((row) => !accountId || row.account_id === accountId)
      .map((row) => ({
        id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
        accountId: row.account_id ? String(row.account_id) : undefined,
        name: String(row.name), stage: row.stage as Opportunity['stage'],
        expectedValueCents: Number(row.expected_value_cents ?? 0), currency: String(row.currency),
        expectedCloseDate: row.expected_close_date ? String(row.expected_close_date) : undefined,
        lostReason: row.lost_reason ? String(row.lost_reason) : undefined,
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      }));
  }

  async listSalesOrders(scope: RevenueScope, accountId?: string): Promise<SalesOrder[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_sales_orders', scope);
    return rows
      .filter((row) => !accountId || row.account_id === accountId)
      .map((row) => ({
        id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
        accountId: String(row.account_id), opportunityId: row.opportunity_id ? String(row.opportunity_id) : undefined,
        orderNumber: String(row.order_number), status: row.status as SalesOrder['status'],
        subtotalCents: Number(row.subtotal_cents ?? 0), taxCents: Number(row.tax_cents ?? 0),
        totalCents: Number(row.total_cents ?? 0), currency: String(row.currency),
        createdAt: String(row.created_at), updatedAt: String(row.updated_at),
      }));
  }

  async listPurchaseOrders(_scope: RevenueScope): Promise<PurchaseOrder[]> {
    throw new Error('Purchasing source is not configured in Supabase v2');
  }

  async listInventoryItems(scope: RevenueScope): Promise<InventoryItem[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_inventory_items', scope);
    return rows.map((row) => ({
      id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
      sku: String(row.sku), name: String(row.name), active: row.active === true,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }));
  }

  async listInventoryMovements(scope: RevenueScope, itemId?: string): Promise<InventoryMovement[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_inventory_movements', scope);
    return rows
      .filter((row) => !itemId || row.item_id === itemId)
      .map((row) => ({
        id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
        itemId: String(row.item_id), movementType: row.movement_type as InventoryMovement['movementType'],
        quantity: Number(row.quantity), fromLocationId: row.from_location_id ? String(row.from_location_id) : undefined,
        toLocationId: row.to_location_id ? String(row.to_location_id) : undefined,
        referenceType: row.reference_type ? String(row.reference_type) : undefined,
        referenceId: row.reference_id ? String(row.reference_id) : undefined,
        createdAt: String(row.created_at), updatedAt: String(row.created_at),
      }));
  }

  async listPosTransactions(scope: RevenueScope): Promise<PosTransaction[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_pos_transactions', scope);
    return rows.map((row) => ({
      id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
      transactionNumber: String(row.transaction_number), totalCents: Number(row.total_cents ?? 0),
      currency: String(row.currency), settlementState: row.settlement_state as PosTransaction['settlementState'],
      settlementProvider: row.settlement_provider ? String(row.settlement_provider) : undefined,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }));
  }

  async listProjects(scope: RevenueScope): Promise<ProjectRecord[]> {
    const rows = await this.listRows<Record<string, unknown>>('revenue_projects', scope);
    return rows.map((row) => ({
      id: String(row.id), tenantId: String(row.tenant_id), organizationId: String(row.org_id),
      name: String(row.name), status: row.status as ProjectRecord['status'],
      ownerEmployeeId: row.owner_employee_id ? String(row.owner_employee_id) : undefined,
      createdAt: String(row.created_at), updatedAt: String(row.updated_at),
    }));
  }
}

export function createSupabaseRevenueOpsRepository(client: SupabaseClient): RevenueOpsRepository {
  return new SupabaseRevenueOpsRepository(client);
}
