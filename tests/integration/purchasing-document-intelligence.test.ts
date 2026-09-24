import { describe, expect, it } from 'vitest';
import { parsePurchasingDocumentText } from '../../apps/web/src/lib/purchasingDocumentIntake';

describe('purchasing document intelligence', () => {
  it('classifies and extracts a purchase order with line data', () => {
    const parsed = parsePurchasingDocumentText(`
      PURCHASE ORDER
      PO Number: PO-2026-1001
      Vendor: ACME Supply LLC
      Order Date: 09/20/2026
      SKU-100 Widget 3 12.50
    `);
    expect(parsed.kind).toBe('purchase_order');
    expect(parsed.poNumber).toBe('PO-2026-1001');
    expect(parsed.vendorName).toBe('ACME Supply LLC');
    expect(parsed.documentDate).toBe('2026-09-20');
    expect(parsed.lines[0]).toMatchObject({ sku: 'SKU-100', quantity: 3, unitCost: 12.5 });
    expect(parsed.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('extracts a packing slip and preserves fail-closed line quantities', () => {
    const parsed = parsePurchasingDocumentText(`
      PACKING SLIP Number: PS-4488
      PO Number: PO-2026-1001
      Vendor: ACME Supply LLC
      Date: 09/21/2026
      SKU-100 Widget 3
    `);
    expect(parsed.kind).toBe('packing_slip');
    expect(parsed.packingSlipNumber).toBe('PS-4488');
    expect(parsed.poNumber).toBe('PO-2026-1001');
    expect(parsed.lines[0]).toMatchObject({ sku: 'SKU-100', quantity: 3 });
  });

  it('extracts a vendor invoice for the existing three-way-match gate', () => {
    const parsed = parsePurchasingDocumentText(`
      VENDOR INVOICE
      Invoice #: INV-9008
      PO Number: PO-2026-1001
      Vendor: ACME Supply LLC
      Invoice Date: 09/21/2026
      Due Date: 10/21/2026
      SKU-100 Widget 3 12.50
    `);
    expect(parsed.kind).toBe('vendor_invoice');
    expect(parsed.documentNumber).toBe('INV-9008');
    expect(parsed.poNumber).toBe('PO-2026-1001');
    expect(parsed.documentDate).toBe('2026-09-21');
    expect(parsed.dueDate).toBe('2026-10-21');
    expect(parsed.lines[0]).toMatchObject({ sku: 'SKU-100', quantity: 3, unitCost: 12.5 });
  });

  it('returns unknown instead of guessing an unsupported document', () => {
    const parsed = parsePurchasingDocumentText('Thank you for your business');
    expect(parsed.kind).toBe('unknown');
    expect(parsed.confidence).toBe(0);
  });
});
