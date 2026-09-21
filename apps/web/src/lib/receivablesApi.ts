import {
  authorizedAtlasFetch,
  getActiveAtlasOrganization,
  type AtlasOrganization
} from './atlasSession';

export type ReceivablesCustomer = {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  status: string;
};

export type ReceivableInvoice = {
  id: string;
  org_id: string;
  customer_id: string | null;
  invoice_number: string;
  issue_date: string;
  due_date: string | null;
  total: number;
  balance_due: number;
  status: string;
  inventory_posted_at: string | null;
  cogs_amount: number | null;
  gross_profit: number | null;
  gross_margin_pct: number | null;
  created_at: string;
  updated_at: string;
};

export type ReceivableInvoiceLine = {
  id: string;
  org_id: string;
  invoice_id: string;
  product_id: string | null;
  description: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
};

export type ReceivablePayment = {
  id: string;
  org_id: string;
  invoice_id: string;
  amount: number;
  payment_date: string;
  status: string;
};

export type ReceivableProduct = {
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

export type ReceivableInventoryLocation = {
  id: string;
  org_id: string;
  code: string;
  name: string;
  location_type: string;
  status: string;
};

export type LiveReceivablesLedger = {
  source: 'supabase_rls_live';
  organization: AtlasOrganization;
  customers: ReceivablesCustomer[];
  invoices: ReceivableInvoice[];
  lines: ReceivableInvoiceLine[];
  payments: ReceivablePayment[];
  products: ReceivableProduct[];
  locations: ReceivableInventoryLocation[];
  loaded_at: string;
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

function orgFilter(orgId: string) {
  return encodeURIComponent(`eq.${orgId}`);
}

export function suggestInvoiceNumber(now = new Date()) {
  const stamp = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 8).toUpperCase()
    : Math.random().toString(16).slice(2, 10).toUpperCase();
  return `INV-${stamp}-${suffix}`;
}

export async function getLiveReceivablesLedger(): Promise<LiveReceivablesLedger> {
  const organization = await getActiveAtlasOrganization();
  const filter = orgFilter(organization.id);
  const [customersResponse, invoicesResponse, linesResponse, paymentsResponse, productsResponse, locationsResponse] = await Promise.all([
    authorizedAtlasFetch(
      `/rest/v1/customers?org_id=${filter}&select=id,org_id,name,email,phone,status&order=name.asc`,
      { method: 'GET' }
    ),
    authorizedAtlasFetch(
      `/rest/v1/invoices?org_id=${filter}&select=id,org_id,customer_id,invoice_number,issue_date,due_date,total,balance_due,status,inventory_posted_at,cogs_amount,gross_profit,gross_margin_pct,created_at,updated_at&order=issue_date.desc,invoice_number.desc`,
      { method: 'GET' }
    ),
    authorizedAtlasFetch(
      `/rest/v1/invoice_lines?org_id=${filter}&select=id,org_id,invoice_id,product_id,description,quantity,unit_price,tax_rate&order=created_at.asc`,
      { method: 'GET' }
    ),
    authorizedAtlasFetch(
      `/rest/v1/payments?org_id=${filter}&select=id,org_id,invoice_id,amount,payment_date,status&order=payment_date.desc,created_at.desc`,
      { method: 'GET' }
    ),
    authorizedAtlasFetch(
      `/rest/v1/products?org_id=${filter}&select=id,org_id,inventory_item_id,sku,name,quantity,unit_cost,unit_price,target_margin_pct,status&status=eq.active&order=name.asc`,
      { method: 'GET' }
    ),
    authorizedAtlasFetch(
      `/rest/v1/inventory_locations?org_id=${filter}&select=id,org_id,code,name,location_type,status&status=eq.active&order=name.asc`,
      { method: 'GET' }
    )
  ]);

  const rawCustomers = await parseResponse<any[]>(customersResponse);
  const rawInvoices = await parseResponse<any[]>(invoicesResponse);
  const rawLines = await parseResponse<any[]>(linesResponse);
  const rawPayments = await parseResponse<any[]>(paymentsResponse);
  const rawProducts = await parseResponse<any[]>(productsResponse);
  const rawLocations = await parseResponse<any[]>(locationsResponse);

  return {
    source: 'supabase_rls_live',
    organization,
    customers: rawCustomers.map((customer) => ({
      id: String(customer.id),
      org_id: String(customer.org_id),
      name: String(customer.name || ''),
      email: customer.email ? String(customer.email) : null,
      phone: customer.phone ? String(customer.phone) : null,
      status: String(customer.status || 'active')
    })),
    invoices: rawInvoices.map((invoice) => ({
      id: String(invoice.id),
      org_id: String(invoice.org_id),
      customer_id: invoice.customer_id ? String(invoice.customer_id) : null,
      invoice_number: String(invoice.invoice_number || ''),
      issue_date: String(invoice.issue_date || ''),
      due_date: invoice.due_date ? String(invoice.due_date) : null,
      total: Number(invoice.total || 0),
      balance_due: Number(invoice.balance_due || 0),
      status: String(invoice.status || 'draft'),
      inventory_posted_at: invoice.inventory_posted_at ? String(invoice.inventory_posted_at) : null,
      cogs_amount: invoice.cogs_amount == null ? null : Number(invoice.cogs_amount),
      gross_profit: invoice.gross_profit == null ? null : Number(invoice.gross_profit),
      gross_margin_pct: invoice.gross_margin_pct == null ? null : Number(invoice.gross_margin_pct),
      created_at: String(invoice.created_at || ''),
      updated_at: String(invoice.updated_at || '')
    })),
    lines: rawLines.map((line) => ({
      id: String(line.id),
      org_id: String(line.org_id),
      invoice_id: String(line.invoice_id),
      product_id: line.product_id ? String(line.product_id) : null,
      description: String(line.description || ''),
      quantity: Number(line.quantity || 0),
      unit_price: Number(line.unit_price || 0),
      tax_rate: Number(line.tax_rate || 0)
    })),
    payments: rawPayments.map((payment) => ({
      id: String(payment.id),
      org_id: String(payment.org_id),
      invoice_id: String(payment.invoice_id),
      amount: Number(payment.amount || 0),
      payment_date: String(payment.payment_date || ''),
      status: String(payment.status || 'confirmed')
    })),
    products: rawProducts.map((product) => ({
      id: String(product.id),
      org_id: String(product.org_id),
      inventory_item_id: product.inventory_item_id ? String(product.inventory_item_id) : null,
      sku: String(product.sku || ''),
      name: String(product.name || ''),
      quantity: Number(product.quantity || 0),
      unit_cost: Number(product.unit_cost || 0),
      unit_price: Number(product.unit_price || 0),
      target_margin_pct: product.target_margin_pct == null ? null : Number(product.target_margin_pct),
      status: String(product.status || 'active')
    })),
    locations: rawLocations.map((location) => ({
      id: String(location.id),
      org_id: String(location.org_id),
      code: String(location.code || ''),
      name: String(location.name || ''),
      location_type: String(location.location_type || 'warehouse'),
      status: String(location.status || 'active')
    })),
    loaded_at: new Date().toISOString()
  };
}

export async function createReceivablesCustomer(input: {
  name: string;
  email?: string;
  phone?: string;
}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/customers?select=id,org_id,name,email,phone,status', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      name: requiredText(input.name, 'customer_name'),
      email: input.email?.trim() || null,
      phone: input.phone?.trim() || null,
      status: 'active'
    })
  });
  const rows = await parseResponse<ReceivablesCustomer[]>(response);
  if (!rows[0]) throw new Error('customer_create_failed');
  return rows[0];
}

export async function createDraftInvoice(input: {
  customerId: string;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string;
}) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/invoices?select=id,org_id,customer_id,invoice_number,issue_date,due_date,total,balance_due,status,inventory_posted_at,cogs_amount,gross_profit,gross_margin_pct,created_at,updated_at', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      customer_id: requiredText(input.customerId, 'customer'),
      invoice_number: requiredText(input.invoiceNumber, 'invoice_number'),
      issue_date: requiredText(input.issueDate, 'issue_date'),
      due_date: input.dueDate || null,
      total: 0,
      status: 'draft'
    })
  });
  const rows = await parseResponse<ReceivableInvoice[]>(response);
  if (!rows[0]) throw new Error('invoice_create_failed');
  return rows[0];
}

export async function addInvoiceLine(input: {
  invoiceId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
  productId?: string | null;
}) {
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) throw new Error('quantity_must_be_positive');
  if (!Number.isFinite(input.unitPrice) || input.unitPrice < 0) throw new Error('unit_price_invalid');
  if (!Number.isFinite(input.taxRate) || input.taxRate < 0) throw new Error('tax_rate_invalid');

  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/invoice_lines?select=id,org_id,invoice_id,product_id,description,quantity,unit_price,tax_rate', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      invoice_id: requiredText(input.invoiceId, 'invoice'),
      product_id: input.productId ? requiredText(input.productId, 'product') : null,
      description: requiredText(input.description, 'description'),
      quantity: input.quantity,
      unit_price: input.unitPrice,
      tax_rate: input.taxRate
    })
  });
  const rows = await parseResponse<ReceivableInvoiceLine[]>(response);
  if (!rows[0]) throw new Error('invoice_line_create_failed');
  return rows[0];
}

export async function issueInvoice(invoiceId: string) {
  const organization = await getActiveAtlasOrganization();
  const id = encodeURIComponent(`eq.${requiredText(invoiceId, 'invoice')}`);
  const filter = orgFilter(organization.id);
  const response = await authorizedAtlasFetch(
    `/rest/v1/invoices?id=${id}&org_id=${filter}&status=eq.draft&total=gt.0&select=id,org_id,customer_id,invoice_number,issue_date,due_date,total,balance_due,status,inventory_posted_at,cogs_amount,gross_profit,gross_margin_pct,created_at,updated_at`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'open' })
    }
  );
  const rows = await parseResponse<ReceivableInvoice[]>(response);
  if (!rows[0]) throw new Error('invoice_not_issuable');
  return rows[0];
}

export async function issueInventoryInvoice(input: { invoiceId: string; locationId: string }) {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/rpc/issue_inventory_invoice_v1', {
    method: 'POST',
    body: JSON.stringify({
      p_org_id: organization.id,
      p_invoice_id: requiredText(input.invoiceId, 'invoice'),
      p_location_id: requiredText(input.locationId, 'inventory_location')
    })
  });
  return parseResponse<Record<string, unknown>>(response);
}

export async function recordReceivablesPayment(input: {
  invoiceId: string;
  amount: number;
  paidOn: string;
}) {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error('payment_amount_must_be_positive');
  const response = await authorizedAtlasFetch('/rest/v1/rpc/record_invoice_payment', {
    method: 'POST',
    body: JSON.stringify({
      invoice_uuid: requiredText(input.invoiceId, 'invoice'),
      payment_amount: input.amount,
      paid_on: requiredText(input.paidOn, 'payment_date')
    })
  });
  return parseResponse<string>(response);
}
