import { authorizedAtlasFetch, getActiveAtlasOrganization, type AtlasOrganization } from './atlasSession';

export type PurchasingVendor = {
  id: string;
  org_id: string;
  vendor_code: string;
  name: string;
  payment_terms: string | null;
  status: string;
};

export type PurchaseOrder = {
  id: string;
  org_id: string;
  po_number: string;
  vendor_id: string;
  order_date: string;
  expected_date: string | null;
  currency: string;
  status: string;
  notes: string | null;
};

export type PurchaseOrderLine = {
  id: string;
  org_id: string;
  purchase_order_id: string;
  item_id: string | null;
  description: string;
  quantity: number;
  unit_cost: number;
  received_quantity: number;
};

export type InventoryItem = {
  id: string;
  org_id: string;
  sku: string;
  name: string;
  unit: string;
  status: string;
  average_unit_cost: number;
  last_unit_cost: number;
};

export type InventoryLocation = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  location_type: string;
  status: string;
};

export type InventoryReceipt = {
  id: string;
  org_id: string;
  purchase_order_id: string;
  location_id: string;
  packing_slip_number: string;
  received_at: string;
  status: string;
};

export type InventoryReceiptLine = {
  id: string;
  org_id: string;
  receipt_id: string;
  purchase_order_line_id: string;
  item_id: string;
  quantity: number;
  unit_cost: number;
};

export type MatchedBill = {
  id: string;
  org_id: string;
  purchasing_vendor_id: string | null;
  purchase_order_id: string | null;
  inventory_receipt_id: string | null;
  bill_number: string;
  bill_date: string | null;
  due_date: string | null;
  amount: number;
  balance_due: number;
  approval_state: string;
  match_state: string;
  status: string;
};

export type SalesProduct = {
  id: string;
  org_id: string;
  inventory_item_id: string | null;
  sku: string;
  name: string;
  quantity: number;
  unit_cost: number;
  unit_price: number;
  target_margin_pct: number | null;
  status: string;
};

export type ProcureToPaySnapshot = {
  organization: AtlasOrganization;
  vendors: PurchasingVendor[];
  purchaseOrders: PurchaseOrder[];
  purchaseOrderLines: PurchaseOrderLine[];
  items: InventoryItem[];
  locations: InventoryLocation[];
  receipts: InventoryReceipt[];
  receiptLines: InventoryReceiptLine[];
  bills: MatchedBill[];
  products: SalesProduct[];
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!response.ok) {
    const message = data?.message || data?.error_description || data?.error || text || `Request failed (${response.status})`;
    throw new Error(String(message));
  }
  return data as T;
}

function requiredText(value: string, field: string) {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field}_required`);
  return normalized;
}

function filter(orgId: string) {
  return encodeURIComponent(`eq.${orgId}`);
}

export function suggestPoNumber(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 6).toUpperCase()
    : Math.random().toString(16).slice(2, 8).toUpperCase();
  return `PO-${stamp}-${suffix}`;
}

export async function getProcureToPaySnapshot(): Promise<ProcureToPaySnapshot> {
  const organization = await getActiveAtlasOrganization();
  const org = filter(organization.id);
  const responses = await Promise.all([
    authorizedAtlasFetch(`/rest/v1/purchasing_vendors?org_id=${org}&select=id,org_id,vendor_code,name,payment_terms,status&order=name.asc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/purchase_orders?org_id=${org}&select=id,org_id,po_number,vendor_id,order_date,expected_date,currency,status,notes&order=created_at.desc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/purchase_order_lines?org_id=${org}&select=id,org_id,purchase_order_id,item_id,description,quantity,unit_cost,received_quantity&order=created_at.asc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/inventory_items?org_id=${org}&select=id,org_id,sku,name,unit,status,average_unit_cost,last_unit_cost&order=name.asc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/inventory_locations?org_id=${org}&select=id,org_id,code,name,location_type,status&order=name.asc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/inventory_receipts?org_id=${org}&select=id,org_id,purchase_order_id,location_id,packing_slip_number,received_at,status&order=received_at.desc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/inventory_receipt_lines?org_id=${org}&select=id,org_id,receipt_id,purchase_order_line_id,item_id,quantity,unit_cost&order=created_at.asc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/accounting_bills?org_id=${org}&select=id,org_id,purchasing_vendor_id,purchase_order_id,inventory_receipt_id,bill_number,bill_date,due_date,amount,balance_due,approval_state,match_state,status&order=created_at.desc`, { method: 'GET' }),
    authorizedAtlasFetch(`/rest/v1/products?org_id=${org}&select=id,org_id,inventory_item_id,sku,name,quantity,unit_cost,unit_price,target_margin_pct,status&order=name.asc`, { method: 'GET' })
  ]);

  const [vendors, purchaseOrders, purchaseOrderLines, items, locations, receipts, receiptLines, bills, products] = await Promise.all(
    responses.map((response) => parseResponse<any[]>(response))
  );

  return {
    organization,
    vendors: vendors.map((row) => ({ ...row, payment_terms: row.payment_terms || null })),
    purchaseOrders: purchaseOrders.map((row) => ({ ...row, expected_date: row.expected_date || null, notes: row.notes || null })),
    purchaseOrderLines: purchaseOrderLines.map((row) => ({ ...row, quantity: Number(row.quantity || 0), unit_cost: Number(row.unit_cost || 0), received_quantity: Number(row.received_quantity || 0) })),
    items: items.map((row) => ({ ...row, average_unit_cost: Number(row.average_unit_cost || 0), last_unit_cost: Number(row.last_unit_cost || 0) })),
    locations,
    receipts,
    receiptLines: receiptLines.map((row) => ({ ...row, quantity: Number(row.quantity || 0), unit_cost: Number(row.unit_cost || 0) })),
    bills: bills.map((row) => ({ ...row, amount: Number(row.amount || 0), balance_due: Number(row.balance_due || 0) })),
    products: products.map((row) => ({
      ...row,
      quantity: Number(row.quantity || 0),
      unit_cost: Number(row.unit_cost || 0),
      unit_price: Number(row.unit_price || 0),
      target_margin_pct: row.target_margin_pct == null ? null : Number(row.target_margin_pct)
    }))
  };
}

export async function createPurchasingVendor(input: { vendorCode: string; name: string; paymentTerms?: string }) {
  const organization = await getActiveAtlasOrganization();
  const vendorCode = requiredText(input.vendorCode, 'vendor_code');
  const response = await authorizedAtlasFetch(
    '/rest/v1/purchasing_vendors?on_conflict=org_id,vendor_code&select=id,org_id,vendor_code,name,payment_terms,status',
    {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({
        org_id: organization.id,
        vendor_code: vendorCode,
        name: requiredText(input.name, 'vendor_name'),
        payment_terms: input.paymentTerms?.trim() || null,
        status: 'active'
      })
    }
  );
  const rows = await parseResponse<PurchasingVendor[]>(response);
  if (!rows[0]) throw new Error('vendor_save_failed');
  return rows[0];
}

export async function saveVendorW9Profile(input: {
  vendorId: string;
  legalName: string;
  businessName?: string;
  federalTaxClassification: string;
  llcTaxClassification?: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  taxIdType: 'ein' | 'ssn';
  taxId: string;
  w9SignedDate?: string;
  w9SourceFilename?: string;
}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/upsert_vendor_w9_profile_v1', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_vendor_id: requiredText(input.vendorId, 'vendor'),
      p_legal_name: requiredText(input.legalName, 'w9_legal_name'),
      p_business_name: input.businessName?.trim() || null,
      p_federal_tax_classification: requiredText(input.federalTaxClassification, 'w9_tax_classification'),
      p_llc_tax_classification: input.llcTaxClassification?.trim() || null,
      p_address_line1: requiredText(input.addressLine1, 'w9_address'),
      p_address_line2: input.addressLine2?.trim() || null,
      p_city: requiredText(input.city, 'w9_city'),
      p_state: requiredText(input.state, 'w9_state').toUpperCase(),
      p_postal_code: requiredText(input.postalCode, 'w9_postal_code'),
      p_tax_id_type: input.taxIdType,
      p_tax_id: requiredText(input.taxId, 'w9_tax_id'),
      p_w9_signed_date: input.w9SignedDate || null,
      p_w9_source_filename: input.w9SourceFilename?.trim() || null
    })
  });
  return parseResponse<Record<string, unknown>>(response);
}

export async function createInventoryItem(input: { sku: string; name: string; unit?: string }) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/inventory_items?select=id,org_id,sku,name,unit,status,average_unit_cost,last_unit_cost', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      sku: requiredText(input.sku, 'sku'),
      name: requiredText(input.name, 'item_name'),
      unit: input.unit?.trim() || 'each',
      status: 'active'
    })
  });
  const rows = await parseResponse<InventoryItem[]>(response);
  if (!rows[0]) throw new Error('inventory_item_create_failed');
  return rows[0];
}

export async function createInventoryLocation(input: { code: string; name: string }) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/inventory_locations?select=id,org_id,code,name,location_type,status', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      code: requiredText(input.code, 'location_code'),
      name: requiredText(input.name, 'location_name'),
      location_type: 'warehouse',
      status: 'active'
    })
  });
  const rows = await parseResponse<InventoryLocation[]>(response);
  if (!rows[0]) throw new Error('inventory_location_create_failed');
  return rows[0];
}

export async function createPurchaseOrder(input: {
  poNumber: string;
  vendorId: string;
  orderDate: string;
  expectedDate?: string;
  notes?: string;
}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/purchase_orders?select=id,org_id,po_number,vendor_id,order_date,expected_date,currency,status,notes', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      po_number: requiredText(input.poNumber, 'po_number'),
      vendor_id: requiredText(input.vendorId, 'vendor'),
      order_date: requiredText(input.orderDate, 'order_date'),
      expected_date: input.expectedDate || null,
      currency: 'USD',
      status: 'draft',
      notes: input.notes?.trim() || null
    })
  });
  const rows = await parseResponse<PurchaseOrder[]>(response);
  if (!rows[0]) throw new Error('purchase_order_create_failed');
  return rows[0];
}

export async function addPurchaseOrderLine(input: {
  purchaseOrderId: string;
  itemId: string;
  description: string;
  quantity: number;
  unitCost: number;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('quantity_must_be_positive');
  if (!Number.isFinite(input.unitCost) || input.unitCost < 0) throw new Error('unit_cost_invalid');
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/purchase_order_lines?select=id,org_id,purchase_order_id,item_id,description,quantity,unit_cost,received_quantity', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      purchase_order_id: requiredText(input.purchaseOrderId, 'purchase_order'),
      item_id: requiredText(input.itemId, 'inventory_item'),
      description: requiredText(input.description, 'description'),
      quantity: input.quantity,
      unit_cost: input.unitCost,
      received_quantity: 0
    })
  });
  const rows = await parseResponse<PurchaseOrderLine[]>(response);
  if (!rows[0]) throw new Error('purchase_order_line_create_failed');
  return rows[0];
}

export async function approvePurchaseOrder(purchaseOrderId: string) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    `/rest/v1/purchase_orders?id=eq.${encodeURIComponent(requiredText(purchaseOrderId, 'purchase_order'))}&org_id=${filter(organization.id)}&status=in.(draft,submitted)&select=id,status`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'approved' })
    }
  );
  const rows = await parseResponse<any[]>(response);
  if (!rows[0]) throw new Error('purchase_order_not_approvable');
  return rows[0];
}

export async function receivePurchaseOrder(input: {
  purchaseOrderId: string;
  locationId: string;
  packingSlipNumber: string;
  lines: Array<{ purchase_order_line_id: string; quantity: number }>;
  notes?: string;
}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/receive_purchase_order_v1', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_purchase_order_id: requiredText(input.purchaseOrderId, 'purchase_order'),
      p_location_id: requiredText(input.locationId, 'location'),
      p_packing_slip_number: requiredText(input.packingSlipNumber, 'packing_slip_number'),
      p_lines: input.lines,
      p_notes: input.notes?.trim() || null
    })
  });
  return parseResponse<string>(response);
}

export async function registerMatchedApBill(input: {
  purchaseOrderId: string;
  receiptId: string;
  billNumber: string;
  billDate: string;
  dueDate?: string;
  tolerancePct: number;
  lines: Array<{ purchase_order_line_id: string; quantity: number; unit_cost: number; tax_amount: number }>;
}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/register_matched_ap_bill_v1', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_purchase_order_id: requiredText(input.purchaseOrderId, 'purchase_order'),
      p_receipt_id: requiredText(input.receiptId, 'receipt'),
      p_bill_number: requiredText(input.billNumber, 'bill_number'),
      p_bill_date: requiredText(input.billDate, 'bill_date'),
      p_due_date: input.dueDate || null,
      p_lines: input.lines,
      p_tolerance_pct: input.tolerancePct
    })
  });
  return parseResponse<Record<string, unknown>>(response);
}

export async function createSalesProductFromInventory(input: { itemId: string }) {
  const snapshot = await getProcureToPaySnapshot();
  const item = snapshot.items.find((candidate) => candidate.id === input.itemId);
  if (!item) throw new Error('inventory_item_not_found');
  const existing = snapshot.products.find((product) => product.inventory_item_id === item.id);
  if (existing) return existing;

  const movementResponse = await authorizedAtlasFetch(
    `/rest/v1/inventory_movements?org_id=${filter(snapshot.organization.id)}&item_id=eq.${encodeURIComponent(item.id)}&select=quantity`,
    { method: 'GET' }
  );
  const movements = await parseResponse<Array<{ quantity: number | string }>>(movementResponse);
  const onHand = movements.reduce((sum, movement) => sum + Number(movement.quantity || 0), 0);

  const response = await authorizedAtlasFetch('/rest/v1/products?select=id,org_id,inventory_item_id,sku,name,quantity,unit_cost,unit_price,target_margin_pct,status', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: snapshot.organization.id,
      inventory_item_id: item.id,
      sku: item.sku,
      name: item.name,
      quantity: onHand,
      reorder_point: 0,
      unit_cost: item.average_unit_cost,
      unit_price: 0,
      target_margin_pct: null,
      status: 'active'
    })
  });
  const rows = await parseResponse<SalesProduct[]>(response);
  if (!rows[0]) throw new Error('sales_product_create_failed');
  return rows[0];
}

export async function setProductMargin(input: { productId: string; targetMarginPct: number }) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/set_product_margin_v1', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_product_id: requiredText(input.productId, 'product'),
      p_target_margin_pct: input.targetMarginPct
    })
  });
  return parseResponse<Record<string, unknown>>(response);
}
