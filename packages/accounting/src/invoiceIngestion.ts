import type { TenantScope } from '../../core/src';

export type InvoiceIngestionSource = 'manual' | 'verified-extraction';

export type InvoiceIngestionLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate?: number;
  accountCode?: string;
};

export type InvoiceIngestionInput = TenantScope & {
  source: InvoiceIngestionSource;
  invoiceNumber: string;
  issueDate: string;
  dueDate?: string | null;
  counterpartyName: string;
  currency: 'USD';
  kind: 'sale' | 'purchase';
  lines: InvoiceIngestionLine[];
};

export type NormalizedInvoiceIngestion = InvoiceIngestionInput & {
  subtotal: number;
  tax: number;
  total: number;
};

export type DraftJournalLine = {
  accountCode: string;
  debit: number;
  credit: number;
  description: string;
};

export type DraftJournal = TenantScope & {
  reference: string;
  date: string;
  description: string;
  source: 'invoice-ingestion';
  lines: DraftJournalLine[];
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function money(value: number) {
  return Number(value.toFixed(2));
}

export function normalizeInvoiceIngestion(input: InvoiceIngestionInput): NormalizedInvoiceIngestion {
  if (!input.tenantId || !input.organizationId) throw new Error('invoice_scope_required');
  if (!input.invoiceNumber.trim()) throw new Error('invoice_number_required');
  if (!input.counterpartyName.trim()) throw new Error('counterparty_required');
  if (!ISO_DATE.test(input.issueDate)) throw new Error('invalid_issue_date');
  if (input.dueDate && !ISO_DATE.test(input.dueDate)) throw new Error('invalid_due_date');
  if (!input.lines.length) throw new Error('invoice_lines_required');

  let subtotal = 0;
  let tax = 0;

  const lines = input.lines.map((line) => {
    const description = line.description.trim();
    if (!description) throw new Error('line_description_required');
    if (!Number.isFinite(line.quantity) || line.quantity <= 0) throw new Error('invalid_line_quantity');
    if (!Number.isFinite(line.unitPrice) || line.unitPrice < 0) throw new Error('invalid_line_unit_price');
    const taxRate = line.taxRate ?? 0;
    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 1) throw new Error('invalid_line_tax_rate');

    const amount = money(line.quantity * line.unitPrice);
    subtotal += amount;
    tax += money(amount * taxRate);

    return {
      ...line,
      description,
      taxRate
    };
  });

  return {
    ...input,
    invoiceNumber: input.invoiceNumber.trim(),
    counterpartyName: input.counterpartyName.trim(),
    lines,
    subtotal: money(subtotal),
    tax: money(tax),
    total: money(subtotal + tax)
  };
}

export function buildInvoiceDraftJournal(input: NormalizedInvoiceIngestion): DraftJournal {
  const lines: DraftJournalLine[] = [];

  if (input.kind === 'sale') {
    lines.push({
      accountCode: '1100',
      debit: input.total,
      credit: 0,
      description: `Accounts receivable · ${input.counterpartyName}`
    });
    lines.push({
      accountCode: '4000',
      debit: 0,
      credit: input.subtotal,
      description: `Revenue · ${input.invoiceNumber}`
    });
    if (input.tax > 0) {
      lines.push({
        accountCode: '2100',
        debit: 0,
        credit: input.tax,
        description: `Sales tax payable · ${input.invoiceNumber}`
      });
    }
  } else {
    const grouped = new Map<string, number>();
    for (const line of input.lines) {
      const accountCode = line.accountCode?.trim();
      if (!accountCode) throw new Error('purchase_account_code_required');
      const amount = money(line.quantity * line.unitPrice);
      grouped.set(accountCode, money((grouped.get(accountCode) || 0) + amount));
    }
    for (const [accountCode, amount] of grouped) {
      lines.push({
        accountCode,
        debit: amount,
        credit: 0,
        description: `Purchase · ${input.invoiceNumber}`
      });
    }
    if (input.tax > 0) {
      lines.push({
        accountCode: '6100',
        debit: input.tax,
        credit: 0,
        description: `Purchase tax · ${input.invoiceNumber}`
      });
    }
    lines.push({
      accountCode: '2000',
      debit: 0,
      credit: input.total,
      description: `Accounts payable · ${input.counterpartyName}`
    });
  }

  const debit = money(lines.reduce((sum, line) => sum + line.debit, 0));
  const credit = money(lines.reduce((sum, line) => sum + line.credit, 0));
  if (debit !== credit) throw new Error('invoice_journal_unbalanced');

  return {
    tenantId: input.tenantId,
    organizationId: input.organizationId,
    reference: input.invoiceNumber,
    date: input.issueDate,
    description: `${input.kind === 'sale' ? 'Sales invoice' : 'Vendor bill'} · ${input.counterpartyName}`,
    source: 'invoice-ingestion',
    lines
  };
}
