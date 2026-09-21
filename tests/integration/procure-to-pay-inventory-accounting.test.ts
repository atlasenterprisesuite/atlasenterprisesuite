import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const lifecycleSql = readFileSync('supabase/migrations/20260920190000_procure_to_pay_inventory_margin.sql', 'utf8');
const quantitySyncSql = readFileSync('supabase/migrations/20260920190500_inventory_product_quantity_sync.sql', 'utf8');
const procureApi = readFileSync('apps/web/src/lib/procureToPayApi.ts', 'utf8');
const receivablesApi = readFileSync('apps/web/src/lib/receivablesApi.ts', 'utf8');
const procurePage = readFileSync('apps/web/src/modules/inventory/ProcureToPayPage.tsx', 'utf8');
const receivablesPage = readFileSync('apps/web/src/modules/finance/accounting/ReceivablesPage.tsx', 'utf8');
const app = readFileSync('apps/web/src/App.tsx', 'utf8');

describe('ATLAS procure-to-pay inventory accounting contract', () => {
  it('persists PO receipts with packing-slip evidence and inventory movements', () => {
    expect(lifecycleSql).toContain('create table if not exists public.inventory_receipts');
    expect(lifecycleSql).toContain('packing_slip_number text not null');
    expect(lifecycleSql).toContain('create or replace function public.receive_purchase_order_v1');
    expect(lifecycleSql).toContain("'purchase_receipt'");
    expect(lifecycleSql).toContain("'partially_received'");
  });

  it('fails closed before registering AP unless PO, receipt and vendor invoice match', () => {
    expect(lifecycleSql).toContain('create or replace function public.register_matched_ap_bill_v1');
    expect(lifecycleSql).toContain("raise exception 'three_way_quantity_mismatch'");
    expect(lifecycleSql).toContain("raise exception 'three_way_cost_mismatch'");
    expect(lifecycleSql).toContain("'three_way_matched'");
    expect(lifecycleSql).toContain("'1200', 'Inventory'");
    expect(lifecycleSql).toContain("'2000', 'Accounts Payable'");
  });

  it('uses weighted cost and user-governed gross margin without inventing a default margin', () => {
    expect(lifecycleSql).toContain('average_unit_cost');
    expect(lifecycleSql).toContain('target_margin_pct');
    expect(lifecycleSql).toContain('v_cost / (1 - p_target_margin_pct / 100)');
    expect(procurePage).toContain('Target gross margin %');
    expect(procureApi).toContain('/rest/v1/rpc/set_product_margin_v1');
  });

  it('keeps product stock projected from the movement ledger', () => {
    expect(quantitySyncSql).toContain('sync_product_quantity_from_inventory_movement');
    expect(quantitySyncSql).toContain('after insert on public.inventory_movements');
    expect(quantitySyncSql).toContain('sum(m.quantity)');
  });

  it('forces inventory-backed AR through stock relief and COGS posting', () => {
    expect(lifecycleSql).toContain('guard_inventory_invoice_issue');
    expect(lifecycleSql).toContain("raise exception 'inventory_invoice_requires_governed_issue'");
    expect(lifecycleSql).toContain('create or replace function public.issue_inventory_invoice_v1');
    expect(lifecycleSql).toContain("'5100', 'Cost of Goods Sold'");
    expect(lifecycleSql).toContain("'customer_invoice'");
    expect(receivablesApi).toContain('/rest/v1/rpc/issue_inventory_invoice_v1');
    expect(receivablesPage).toContain('Issue + inventory + COGS');
  });

  it('exposes the canonical workflow in the ATLAS route graph', () => {
    expect(app).toContain('path="/inventory/procure-to-pay"');
    expect(procurePage).toContain('Procure to Pay & Inventory');
  });
});
