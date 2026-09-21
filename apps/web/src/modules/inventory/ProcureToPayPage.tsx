import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  addPurchaseOrderLine,
  approvePurchaseOrder,
  createInventoryItem,
  createInventoryLocation,
  createPurchaseOrder,
  createPurchasingVendor,
  createSalesProductFromInventory,
  getProcureToPaySnapshot,
  receivePurchaseOrder,
  registerMatchedApBill,
  saveVendorW9Profile,
  setProductMargin,
  suggestPoNumber,
  type ProcureToPaySnapshot
} from '../../lib/procureToPayApi';
import { ATLAS_SESSION_EVENT } from '../../lib/atlasSession';
import { extractW9FromImage, suggestVendorCode, type W9TaxClassification } from '../../lib/w9Intake';

const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const today = () => new Date().toISOString().slice(0, 10);

function friendlyError(cause: unknown) {
  const raw = cause instanceof Error ? cause.message : 'Unable to complete the request.';
  return raw.replaceAll('_', ' ');
}

export function ProcureToPayPage() {
  const [snapshot, setSnapshot] = useState<ProcureToPaySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [vendorCode, setVendorCode] = useState('');
  const [vendorName, setVendorName] = useState('');
  const [vendorTerms, setVendorTerms] = useState('');

  const [w9FileName, setW9FileName] = useState('');
  const [w9LegalName, setW9LegalName] = useState('');
  const [w9BusinessName, setW9BusinessName] = useState('');
  const [w9Classification, setW9Classification] = useState<W9TaxClassification | ''>('');
  const [w9LlcClassification, setW9LlcClassification] = useState<'C' | 'S' | 'P' | ''>('');
  const [w9AddressLine1, setW9AddressLine1] = useState('');
  const [w9AddressLine2, setW9AddressLine2] = useState('');
  const [w9City, setW9City] = useState('');
  const [w9State, setW9State] = useState('');
  const [w9PostalCode, setW9PostalCode] = useState('');
  const [w9TaxIdType, setW9TaxIdType] = useState<'ein' | 'ssn' | 'unknown'>('unknown');
  const [w9TaxId, setW9TaxId] = useState('');
  const [w9TaxIdLast4, setW9TaxIdLast4] = useState('');
  const [w9SignedDate, setW9SignedDate] = useState('');

  const [itemSku, setItemSku] = useState('');
  const [itemName, setItemName] = useState('');
  const [itemUnit, setItemUnit] = useState('each');

  const [locationCode, setLocationCode] = useState('');
  const [locationName, setLocationName] = useState('');

  const [poNumber, setPoNumber] = useState(() => suggestPoNumber());
  const [poVendorId, setPoVendorId] = useState('');
  const [poOrderDate, setPoOrderDate] = useState(today);
  const [poExpectedDate, setPoExpectedDate] = useState('');
  const [selectedPoId, setSelectedPoId] = useState('');

  const [poLineItemId, setPoLineItemId] = useState('');
  const [poLineDescription, setPoLineDescription] = useState('');
  const [poLineQuantity, setPoLineQuantity] = useState('1');
  const [poLineUnitCost, setPoLineUnitCost] = useState('');

  const [receiptPoId, setReceiptPoId] = useState('');
  const [receiptLocationId, setReceiptLocationId] = useState('');
  const [packingSlipNumber, setPackingSlipNumber] = useState('');
  const [receiptQuantities, setReceiptQuantities] = useState<Record<string, string>>({});

  const [matchReceiptId, setMatchReceiptId] = useState('');
  const [billNumber, setBillNumber] = useState('');
  const [billDate, setBillDate] = useState(today);
  const [billDueDate, setBillDueDate] = useState('');
  const [tolerancePct, setTolerancePct] = useState('0.5');
  const [invoiceCosts, setInvoiceCosts] = useState<Record<string, string>>({});
  const [invoiceTaxes, setInvoiceTaxes] = useState<Record<string, string>>({});

  const [pricingItemId, setPricingItemId] = useState('');
  const [pricingProductId, setPricingProductId] = useState('');
  const [marginPct, setMarginPct] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const next = await getProcureToPaySnapshot();
      setSnapshot(next);
      setPoVendorId((value) => value || next.vendors[0]?.id || '');
      setSelectedPoId((value) => value || next.purchaseOrders[0]?.id || '');
      setPoLineItemId((value) => value || next.items[0]?.id || '');
      setReceiptLocationId((value) => value || next.locations[0]?.id || '');
      setReceiptPoId((value) => value || next.purchaseOrders.find((po) => ['approved', 'partially_received'].includes(po.status))?.id || '');
      setMatchReceiptId((value) => value || next.receipts.find((receipt) => receipt.status === 'posted')?.id || '');
      setPricingItemId((value) => value || next.items[0]?.id || '');
      setPricingProductId((value) => value || next.products[0]?.id || '');
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener(ATLAS_SESSION_EVENT, refresh);
    return () => window.removeEventListener(ATLAS_SESSION_EVENT, refresh);
  }, []);

  async function runMutation(action: () => Promise<unknown>, message: string) {
    setWorking(true);
    setError('');
    setSuccess('');
    try {
      await action();
      setSuccess(message);
      await load();
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setWorking(false);
    }
  }

  const vendorById = useMemo(() => new Map((snapshot?.vendors || []).map((vendor) => [vendor.id, vendor])), [snapshot?.vendors]);
  const itemById = useMemo(() => new Map((snapshot?.items || []).map((item) => [item.id, item])), [snapshot?.items]);
  const poById = useMemo(() => new Map((snapshot?.purchaseOrders || []).map((po) => [po.id, po])), [snapshot?.purchaseOrders]);

  const selectedPoLines = (snapshot?.purchaseOrderLines || []).filter((line) => line.purchase_order_id === selectedPoId);
  const receivablePos = (snapshot?.purchaseOrders || []).filter((po) => ['approved', 'partially_received'].includes(po.status));
  const receiptPoLines = (snapshot?.purchaseOrderLines || []).filter((line) => line.purchase_order_id === receiptPoId && line.received_quantity < line.quantity);
  const selectedReceipt = snapshot?.receipts.find((receipt) => receipt.id === matchReceiptId) || null;
  const selectedReceiptLines = (snapshot?.receiptLines || []).filter((line) => line.receipt_id === matchReceiptId);
  const matchedReceiptPo = selectedReceipt ? poById.get(selectedReceipt.purchase_order_id) : null;
  const selectedPricingProduct = snapshot?.products.find((product) => product.id === pricingProductId) || null;

  useEffect(() => {
    if (!receiptPoLines.length) return;
    setReceiptQuantities((current) => {
      const next = { ...current };
      for (const line of receiptPoLines) {
        if (next[line.id] == null) next[line.id] = String(line.quantity - line.received_quantity);
      }
      return next;
    });
  }, [receiptPoId, snapshot?.purchaseOrderLines.length]);

  useEffect(() => {
    if (!selectedReceiptLines.length) return;
    setInvoiceCosts((current) => {
      const next = { ...current };
      for (const line of selectedReceiptLines) {
        if (next[line.purchase_order_line_id] == null) next[line.purchase_order_line_id] = String(line.unit_cost);
      }
      return next;
    });
    setInvoiceTaxes((current) => {
      const next = { ...current };
      for (const line of selectedReceiptLines) {
        if (next[line.purchase_order_line_id] == null) next[line.purchase_order_line_id] = '0';
      }
      return next;
    });
  }, [matchReceiptId, snapshot?.receiptLines.length]);

  async function handleVendor(event: FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      const created = await createPurchasingVendor({ vendorCode, name: vendorName, paymentTerms: vendorTerms });
      setVendorCode('');
      setVendorName('');
      setVendorTerms('');
      setPoVendorId(created.id);
    }, 'Vendor created for purchasing.');
  }

  async function handleW9File(file: File | undefined) {
    if (!file) return;
    setWorking(true);
    setError('');
    setSuccess('');
    setW9FileName(file.name);
    try {
      if (!file.type.startsWith('image/')) throw new Error('w9_image_required');
      if (file.size > 8_000_000) throw new Error('w9_image_too_large');
      const parsed = await extractW9FromImage(file);
      setW9LegalName(parsed.legalName);
      setW9BusinessName(parsed.businessName);
      setW9Classification(parsed.classification);
      setW9LlcClassification(parsed.llcTaxClassification);
      setW9AddressLine1(parsed.addressLine1);
      setW9AddressLine2(parsed.addressLine2);
      setW9City(parsed.city);
      setW9State(parsed.state);
      setW9PostalCode(parsed.postalCode);
      setW9TaxIdType(parsed.taxIdType);
      setW9TaxId(parsed.taxId);
      setW9TaxIdLast4(parsed.taxIdLast4);
      const displayName = parsed.businessName || parsed.legalName;
      if (displayName) {
        setVendorName(displayName);
        setVendorCode((current) => current || suggestVendorCode(displayName));
      }
      setSuccess(parsed.classification
        ? 'W-9 text extracted locally. Review every field before saving.'
        : 'W-9 text extracted locally. Tax classification could not be proven from the image, so manual review is required.');
    } catch (cause) {
      const code = cause instanceof Error ? cause.message : 'w9_read_failed';
      setError(code === 'w9_ocr_not_supported'
        ? 'This browser does not expose local image OCR. ATLAS will not guess W-9 data; use a supported browser/device or enter the fields manually.'
        : friendlyError(cause));
    } finally {
      setWorking(false);
    }
  }

  async function handleW9Save(event: FormEvent) {
    event.preventDefault();
    if (!w9Classification) {
      setError('W-9 tax classification must be reviewed before saving.');
      return;
    }
    if (w9Classification === 'llc' && !w9LlcClassification) {
      setError('LLC tax classification C, S, or P is required.');
      return;
    }
    if (w9TaxIdType === 'unknown') {
      setError('TIN type must be reviewed as EIN or SSN before saving.');
      return;
    }
    if (w9TaxId.replace(/\D/g, '').length !== 9) {
      setError('A complete 9-digit TIN is required before saving the reviewed W-9.');
      return;
    }
    await runMutation(async () => {
      const displayName = vendorName.trim() || w9BusinessName.trim() || w9LegalName.trim();
      const code = vendorCode.trim() || suggestVendorCode(displayName);
      const vendor = await createPurchasingVendor({
        vendorCode: code,
        name: displayName,
        paymentTerms: vendorTerms
      });
      setVendorCode(code);
      setVendorName(displayName);
      setPoVendorId(vendor.id);
      await saveVendorW9Profile({
        vendorId: vendor.id,
        legalName: w9LegalName,
        businessName: w9BusinessName,
        federalTaxClassification: w9Classification,
        llcTaxClassification: w9Classification === 'llc' ? w9LlcClassification : undefined,
        addressLine1: w9AddressLine1,
        addressLine2: w9AddressLine2,
        city: w9City,
        state: w9State,
        postalCode: w9PostalCode,
        taxIdType: w9TaxIdType,
        taxId: w9TaxId,
        w9SignedDate,
        w9SourceFilename: w9FileName
      });
    }, 'W-9 vendor profile saved. Business address was normalized for Purchasing/Tax, the full TIN was encrypted in Supabase Vault, and 1099 reportability remains review-required.');
  }

  async function handleItem(event: FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      const created = await createInventoryItem({ sku: itemSku, name: itemName, unit: itemUnit });
      setItemSku('');
      setItemName('');
      setItemUnit('each');
      setPoLineItemId(created.id);
      setPricingItemId(created.id);
    }, 'Inventory item created.');
  }

  async function handleLocation(event: FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      const created = await createInventoryLocation({ code: locationCode, name: locationName });
      setLocationCode('');
      setLocationName('');
      setReceiptLocationId(created.id);
    }, 'Warehouse location created.');
  }

  async function handlePo(event: FormEvent) {
    event.preventDefault();
    let id = '';
    await runMutation(async () => {
      const created = await createPurchaseOrder({
        poNumber,
        vendorId: poVendorId,
        orderDate: poOrderDate,
        expectedDate: poExpectedDate
      });
      id = created.id;
      setPoNumber(suggestPoNumber());
      setPoExpectedDate('');
    }, 'Draft purchase order created.');
    if (id) setSelectedPoId(id);
  }

  async function handlePoLine(event: FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      await addPurchaseOrderLine({
        purchaseOrderId: selectedPoId,
        itemId: poLineItemId,
        description: poLineDescription || itemById.get(poLineItemId)?.name || 'Inventory item',
        quantity: Number(poLineQuantity),
        unitCost: Number(poLineUnitCost)
      });
      setPoLineDescription('');
      setPoLineQuantity('1');
      setPoLineUnitCost('');
    }, 'PO line added.');
  }

  async function handleReceipt(event: FormEvent) {
    event.preventDefault();
    await runMutation(async () => {
      await receivePurchaseOrder({
        purchaseOrderId: receiptPoId,
        locationId: receiptLocationId,
        packingSlipNumber,
        lines: receiptPoLines.map((line) => ({
          purchase_order_line_id: line.id,
          quantity: Number(receiptQuantities[line.id] || 0)
        })).filter((line) => line.quantity > 0)
      });
      setPackingSlipNumber('');
      setReceiptQuantities({});
    }, 'Packing slip posted. Inventory quantity and weighted-average cost were updated.');
  }

  async function handleMatch(event: FormEvent) {
    event.preventDefault();
    if (!selectedReceipt || !matchedReceiptPo) return;
    await runMutation(async () => {
      await registerMatchedApBill({
        purchaseOrderId: selectedReceipt.purchase_order_id,
        receiptId: selectedReceipt.id,
        billNumber,
        billDate,
        dueDate: billDueDate,
        tolerancePct: Number(tolerancePct),
        lines: selectedReceiptLines.map((line) => ({
          purchase_order_line_id: line.purchase_order_line_id,
          quantity: line.quantity,
          unit_cost: Number(invoiceCosts[line.purchase_order_line_id] || line.unit_cost),
          tax_amount: Number(invoiceTaxes[line.purchase_order_line_id] || 0)
        }))
      });
      setBillNumber('');
      setBillDueDate('');
    }, '3-way match passed. AP bill and Inventory/AP journal entry were posted.');
  }

  async function handleSalesProduct(event: FormEvent) {
    event.preventDefault();
    let productId = '';
    await runMutation(async () => {
      const product = await createSalesProductFromInventory({ itemId: pricingItemId });
      productId = product.id;
    }, 'Inventory item linked to the sales catalog.');
    if (productId) setPricingProductId(productId);
  }

  async function handleMargin(event: FormEvent) {
    event.preventDefault();
    await runMutation(
      () => setProductMargin({ productId: pricingProductId, targetMarginPct: Number(marginPct) }),
      'Target gross margin saved. ATLAS recalculated the sales price from the current inventory cost.'
    );
  }

  const openPoValue = (snapshot?.purchaseOrderLines || []).reduce((sum, line) => sum + ((line.quantity - line.received_quantity) * line.unit_cost), 0);
  const inventoryValue = (snapshot?.items || []).reduce((sum, item) => {
    const product = snapshot?.products.find((candidate) => candidate.inventory_item_id === item.id);
    return sum + ((product?.quantity || 0) * item.average_unit_cost);
  }, 0);
  const openAp = (snapshot?.bills || []).reduce((sum, bill) => sum + bill.balance_due, 0);

  return (
    <section className="page-stack">
      <header className="page-header split-header">
        <div>
          <p className="eyebrow">ATLAS Inventory · Purchasing · Accounting</p>
          <h1>Procure to Pay & Inventory</h1>
          <p>PO → warehouse receipt → packing slip → vendor invoice match → Accounts Payable → margin pricing → customer invoice → COGS.</p>
        </div>
        <div className="asof-card"><span>Source</span><strong>{snapshot ? 'Supabase RLS · live' : 'Loading'}</strong></div>
      </header>

      <div className="notice strong">
        Three-way match is fail-closed. A vendor bill cannot be registered through this workflow when PO quantity, received quantity, packing slip receipt, or invoice unit cost falls outside the selected tolerance.
      </div>

      <section className="metric-grid">
        <article><span>Open PO value</span><strong>{currency.format(openPoValue)}</strong><small>ordered but not received</small></article>
        <article><span>Receipts</span><strong>{snapshot?.receipts.length || 0}</strong><small>packing slips posted</small></article>
        <article><span>Open AP</span><strong>{currency.format(openAp)}</strong><small>matched vendor bills</small></article>
        <article><span>Inventory value</span><strong>{currency.format(inventoryValue)}</strong><small>catalog quantity × weighted cost</small></article>
      </section>

      {error && <div className="notice strong" role="alert">{error}</div>}
      {success && <div className="notice" role="status">{success}</div>}

      <section className="workspace-card">
        <div className="detail-heading"><div><p className="eyebrow">1 · Master data</p><h2>Vendor, item and warehouse</h2></div></div>
        <div className="notice">
          W-9 intake is source-aware: ATLAS extracts image text locally when the device supports it, requires human review, keeps the TIN memory-only until save, encrypts the full TIN in Supabase Vault, exposes only the last four digits to normal workflows, and does not treat a W-9 as a filed 1099.
        </div>
        <form className="toolbar" onSubmit={handleW9Save}>
          <label className="field wide-field"><span>W-9 photo</span><input type="file" accept="image/*" capture="environment" onChange={(e) => void handleW9File(e.target.files?.[0])} /></label>
          <label className="field"><span>Legal name</span><input value={w9LegalName} onChange={(e) => setW9LegalName(e.target.value)} required /></label>
          <label className="field"><span>Business / DBA</span><input value={w9BusinessName} onChange={(e) => setW9BusinessName(e.target.value)} /></label>
          <label className="field"><span>Federal tax classification</span><select value={w9Classification} onChange={(e) => setW9Classification(e.target.value as W9TaxClassification | '')} required>
            <option value="">Review classification</option>
            <option value="individual_sole_proprietor">Individual / sole proprietor</option>
            <option value="c_corporation">C corporation</option>
            <option value="s_corporation">S corporation</option>
            <option value="partnership">Partnership</option>
            <option value="trust_estate">Trust / estate</option>
            <option value="llc">LLC</option>
            <option value="other">Other</option>
          </select></label>
          {w9Classification === 'llc' && <label className="field"><span>LLC tax class</span><select value={w9LlcClassification} onChange={(e) => setW9LlcClassification(e.target.value as 'C' | 'S' | 'P' | '')} required><option value="">Select C / S / P</option><option value="C">C</option><option value="S">S</option><option value="P">P</option></select></label>}
          <label className="field wide-field"><span>Business address</span><input value={w9AddressLine1} onChange={(e) => setW9AddressLine1(e.target.value)} required /></label>
          <label className="field"><span>Suite / unit</span><input value={w9AddressLine2} onChange={(e) => setW9AddressLine2(e.target.value)} /></label>
          <label className="field"><span>City</span><input value={w9City} onChange={(e) => setW9City(e.target.value)} required /></label>
          <label className="field"><span>State</span><input value={w9State} onChange={(e) => setW9State(e.target.value.toUpperCase())} maxLength={2} required /></label>
          <label className="field"><span>ZIP</span><input value={w9PostalCode} onChange={(e) => setW9PostalCode(e.target.value)} required /></label>
          <label className="field"><span>TIN type</span><select value={w9TaxIdType} onChange={(e) => setW9TaxIdType(e.target.value as 'ein' | 'ssn' | 'unknown')} required><option value="unknown">Review EIN / SSN</option><option value="ein">EIN</option><option value="ssn">SSN</option></select></label>
          <label className="field"><span>TIN · encrypted on save</span><input type="password" inputMode="numeric" autoComplete="off" value={w9TaxId} onChange={(e) => { const value = e.target.value.replace(/[^0-9-]/g, '').slice(0, 11); setW9TaxId(value); setW9TaxIdLast4(value.replace(/\D/g, '').slice(-4)); }} required /></label>
          <label className="field"><span>TIN verification</span><input value={w9TaxIdLast4 ? 'Ending •••• ' + w9TaxIdLast4 : 'Not detected'} readOnly aria-label="TIN last four digits" /></label>
          <label className="field"><span>W-9 signed date</span><input type="date" value={w9SignedDate} onChange={(e) => setW9SignedDate(e.target.value)} /></label>
          <button className="primary-action" disabled={working || !w9LegalName || !w9Classification || !w9AddressLine1 || !w9City || !w9State || !w9PostalCode || w9TaxIdType === 'unknown' || w9TaxId.replace(/\D/g, '').length !== 9}>Review & save W-9 vendor</button>
        </form>
        <div className="notice strong">
          1099 handling stays fail-closed: the W-9 creates the vendor tax profile and address record, but ATLAS will not mark a vendor reportable or generate 1099-NEC/1099-MISC until payment facts and the applicable tax rules are evaluated.
        </div>
        <div className="module-grid">
          <form className="toolbar" onSubmit={handleVendor}>
            <label className="field"><span>Vendor code</span><input value={vendorCode} onChange={(e) => setVendorCode(e.target.value)} required /></label>
            <label className="field"><span>Vendor name</span><input value={vendorName} onChange={(e) => setVendorName(e.target.value)} required /></label>
            <label className="field"><span>Payment terms</span><input value={vendorTerms} onChange={(e) => setVendorTerms(e.target.value)} placeholder="Net 30" /></label>
            <button className="primary-action" disabled={working}>Save vendor</button>
          </form>
          <form className="toolbar" onSubmit={handleItem}>
            <label className="field"><span>SKU</span><input value={itemSku} onChange={(e) => setItemSku(e.target.value)} required /></label>
            <label className="field"><span>Item</span><input value={itemName} onChange={(e) => setItemName(e.target.value)} required /></label>
            <label className="field"><span>Unit</span><input value={itemUnit} onChange={(e) => setItemUnit(e.target.value)} required /></label>
            <button className="primary-action" disabled={working}>Create item</button>
          </form>
          <form className="toolbar" onSubmit={handleLocation}>
            <label className="field"><span>Warehouse code</span><input value={locationCode} onChange={(e) => setLocationCode(e.target.value)} required /></label>
            <label className="field"><span>Warehouse name</span><input value={locationName} onChange={(e) => setLocationName(e.target.value)} required /></label>
            <button className="primary-action" disabled={working}>Create warehouse</button>
          </form>
        </div>
      </section>

      <section className="workspace-card">
        <div className="detail-heading"><div><p className="eyebrow">2 · Purchasing</p><h2>Purchase order</h2></div></div>
        <form className="toolbar" onSubmit={handlePo}>
          <label className="field"><span>PO number</span><input value={poNumber} onChange={(e) => setPoNumber(e.target.value)} required /></label>
          <label className="field"><span>Vendor</span><select value={poVendorId} onChange={(e) => setPoVendorId(e.target.value)} required><option value="">Select vendor</option>{snapshot?.vendors.map((vendor) => <option key={vendor.id} value={vendor.id}>{vendor.name}</option>)}</select></label>
          <label className="field"><span>Order date</span><input type="date" value={poOrderDate} onChange={(e) => setPoOrderDate(e.target.value)} required /></label>
          <label className="field"><span>Expected</span><input type="date" value={poExpectedDate} onChange={(e) => setPoExpectedDate(e.target.value)} /></label>
          <button className="primary-action" disabled={working || !poVendorId}>Create draft PO</button>
        </form>

        <div className="table-wrap">
          <table>
            <thead><tr><th>PO</th><th>Vendor</th><th>Status</th><th>Order</th><th>Lines</th><th /></tr></thead>
            <tbody>{snapshot?.purchaseOrders.map((po) => (
              <tr key={po.id} className={selectedPoId === po.id ? 'selected-row' : ''}>
                <td><button className="link-button" type="button" onClick={() => setSelectedPoId(po.id)}>{po.po_number}</button></td>
                <td>{vendorById.get(po.vendor_id)?.name || 'Unknown vendor'}</td>
                <td><span className={`status-pill ${po.status}`}>{po.status.replaceAll('_', ' ')}</span></td>
                <td>{po.order_date}</td>
                <td>{(snapshot?.purchaseOrderLines || []).filter((line) => line.purchase_order_id === po.id).length}</td>
                <td>{['draft', 'submitted'].includes(po.status) && <button className="secondary-action" type="button" disabled={working} onClick={() => void runMutation(() => approvePurchaseOrder(po.id), 'Purchase order approved for receiving.')}>Approve</button>}</td>
              </tr>
            ))}</tbody>
          </table>
          {!loading && !snapshot?.purchaseOrders.length && <div className="empty-state"><strong>No purchase orders</strong><span>Create the first PO above.</span></div>}
        </div>

        {selectedPoId && ['draft', 'submitted'].includes(poById.get(selectedPoId)?.status || '') && (
          <form className="toolbar" onSubmit={handlePoLine}>
            <label className="field"><span>Inventory item</span><select value={poLineItemId} onChange={(e) => setPoLineItemId(e.target.value)} required><option value="">Select item</option>{snapshot?.items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name}</option>)}</select></label>
            <label className="field wide-field"><span>Description</span><input value={poLineDescription} onChange={(e) => setPoLineDescription(e.target.value)} placeholder={itemById.get(poLineItemId)?.name || ''} /></label>
            <label className="field"><span>Qty</span><input type="number" min="0.01" step="0.01" value={poLineQuantity} onChange={(e) => setPoLineQuantity(e.target.value)} required /></label>
            <label className="field"><span>Unit cost</span><input type="number" min="0" step="0.01" value={poLineUnitCost} onChange={(e) => setPoLineUnitCost(e.target.value)} required /></label>
            <button className="primary-action" disabled={working || !poLineItemId}>Add PO line</button>
          </form>
        )}

        {selectedPoLines.length > 0 && (
          <div className="table-wrap">
            <table><thead><tr><th>Item</th><th>Ordered</th><th>Received</th><th>Unit cost</th><th>Open</th></tr></thead>
              <tbody>{selectedPoLines.map((line) => <tr key={line.id}><td>{itemById.get(line.item_id || '')?.name || line.description}</td><td>{line.quantity}</td><td>{line.received_quantity}</td><td>{currency.format(line.unit_cost)}</td><td>{line.quantity - line.received_quantity}</td></tr>)}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="workspace-card">
        <div className="detail-heading"><div><p className="eyebrow">3 · Receiving</p><h2>PO + packing slip receipt</h2></div></div>
        <form className="toolbar" onSubmit={handleReceipt}>
          <label className="field"><span>Receivable PO</span><select value={receiptPoId} onChange={(e) => { setReceiptPoId(e.target.value); setReceiptQuantities({}); }} required><option value="">Select approved PO</option>{receivablePos.map((po) => <option key={po.id} value={po.id}>{po.po_number} · {vendorById.get(po.vendor_id)?.name}</option>)}</select></label>
          <label className="field"><span>Warehouse</span><select value={receiptLocationId} onChange={(e) => setReceiptLocationId(e.target.value)} required><option value="">Select warehouse</option>{snapshot?.locations.map((location) => <option key={location.id} value={location.id}>{location.code} · {location.name}</option>)}</select></label>
          <label className="field"><span>Packing slip</span><input value={packingSlipNumber} onChange={(e) => setPackingSlipNumber(e.target.value)} required /></label>
          <button className="primary-action" disabled={working || !receiptPoLines.length}>Post receipt</button>
        </form>
        {receiptPoLines.length > 0 && <div className="table-wrap"><table><thead><tr><th>Item</th><th>Open PO qty</th><th>Receive now</th><th>PO unit cost</th></tr></thead><tbody>
          {receiptPoLines.map((line) => <tr key={line.id}><td>{itemById.get(line.item_id || '')?.name || line.description}</td><td>{line.quantity - line.received_quantity}</td><td><input type="number" min="0" max={line.quantity-line.received_quantity} step="0.01" value={receiptQuantities[line.id] || ''} onChange={(e) => setReceiptQuantities((current) => ({ ...current, [line.id]: e.target.value }))} /></td><td>{currency.format(line.unit_cost)}</td></tr>)}
        </tbody></table></div>}
      </section>

      <section className="workspace-card">
        <div className="detail-heading"><div><p className="eyebrow">4 · Three-way match</p><h2>Vendor invoice → Accounts Payable</h2></div></div>
        <form className="toolbar" onSubmit={handleMatch}>
          <label className="field"><span>Packing-slip receipt</span><select value={matchReceiptId} onChange={(e) => { setMatchReceiptId(e.target.value); setInvoiceCosts({}); setInvoiceTaxes({}); }} required><option value="">Select receipt</option>{snapshot?.receipts.filter((receipt) => !(snapshot?.bills || []).some((bill) => bill.inventory_receipt_id === receipt.id && bill.status !== 'void')).map((receipt) => <option key={receipt.id} value={receipt.id}>{poById.get(receipt.purchase_order_id)?.po_number} · {receipt.packing_slip_number}</option>)}</select></label>
          <label className="field"><span>Vendor invoice #</span><input value={billNumber} onChange={(e) => setBillNumber(e.target.value)} required /></label>
          <label className="field"><span>Bill date</span><input type="date" value={billDate} onChange={(e) => setBillDate(e.target.value)} required /></label>
          <label className="field"><span>Due date</span><input type="date" value={billDueDate} onChange={(e) => setBillDueDate(e.target.value)} /></label>
          <label className="field"><span>Cost tolerance %</span><input type="number" min="0" max="99.99" step="0.01" value={tolerancePct} onChange={(e) => setTolerancePct(e.target.value)} required /></label>
          <button className="primary-action" disabled={working || !selectedReceiptLines.length}>Match & register AP</button>
        </form>
        {selectedReceiptLines.length > 0 && <div className="table-wrap"><table><thead><tr><th>Item</th><th>Received qty</th><th>PO cost</th><th>Invoice cost</th><th>Capitalized landed cost</th></tr></thead><tbody>
          {selectedReceiptLines.map((line) => {
            const poLine = snapshot?.purchaseOrderLines.find((candidate) => candidate.id === line.purchase_order_line_id);
            return <tr key={line.id}><td>{itemById.get(line.item_id)?.name || poLine?.description || 'Item'}</td><td>{line.quantity}</td><td>{currency.format(poLine?.unit_cost || line.unit_cost)}</td><td><input type="number" min="0" step="0.01" value={invoiceCosts[line.purchase_order_line_id] || ''} onChange={(e) => setInvoiceCosts((current) => ({ ...current, [line.purchase_order_line_id]: e.target.value }))} /></td><td><input type="number" min="0" step="0.01" value={invoiceTaxes[line.purchase_order_line_id] || '0'} onChange={(e) => setInvoiceTaxes((current) => ({ ...current, [line.purchase_order_line_id]: e.target.value }))} /></td></tr>;
          })}
        </tbody></table></div>}
        <div className="table-wrap"><table><thead><tr><th>Bill</th><th>PO</th><th>Match</th><th>Approval</th><th>Amount</th><th>Open AP</th></tr></thead><tbody>
          {snapshot?.bills.filter((bill) => bill.purchase_order_id).map((bill) => <tr key={bill.id}><td>{bill.bill_number}</td><td>{poById.get(bill.purchase_order_id || '')?.po_number || '—'}</td><td><span className="approval-chip">{bill.match_state.replaceAll('_',' ')}</span></td><td>{bill.approval_state}</td><td>{currency.format(bill.amount)}</td><td>{currency.format(bill.balance_due)}</td></tr>)}
        </tbody></table></div>
      </section>

      <section className="workspace-card">
        <div className="detail-heading"><div><p className="eyebrow">5 · Pricing</p><h2>Cost + target gross margin → sales price</h2></div></div>
        <div className="module-grid">
          <form className="toolbar" onSubmit={handleSalesProduct}>
            <label className="field"><span>Inventory item</span><select value={pricingItemId} onChange={(e) => setPricingItemId(e.target.value)} required><option value="">Select item</option>{snapshot?.items.map((item) => <option key={item.id} value={item.id}>{item.sku} · {item.name} · cost {currency.format(item.average_unit_cost)}</option>)}</select></label>
            <button className="primary-action" disabled={working || !pricingItemId}>Enable for sale</button>
          </form>
          <form className="toolbar" onSubmit={handleMargin}>
            <label className="field"><span>Sales product</span><select value={pricingProductId} onChange={(e) => setPricingProductId(e.target.value)} required><option value="">Select product</option>{snapshot?.products.map((product) => <option key={product.id} value={product.id}>{product.sku} · {product.name}</option>)}</select></label>
            <label className="field"><span>Target gross margin %</span><input type="number" min="0" max="99.99" step="0.01" value={marginPct} onChange={(e) => setMarginPct(e.target.value)} required /></label>
            <button className="primary-action" disabled={working || !pricingProductId}>Calculate & save price</button>
          </form>
        </div>
        {selectedPricingProduct && <div className="metric-grid">
          <article><span>Current cost</span><strong>{currency.format(selectedPricingProduct.unit_cost)}</strong><small>weighted inventory cost</small></article>
          <article><span>Target margin</span><strong>{selectedPricingProduct.target_margin_pct == null ? 'Not set' : `${selectedPricingProduct.target_margin_pct}%`}</strong><small>user-governed</small></article>
          <article><span>Sales price</span><strong>{currency.format(selectedPricingProduct.unit_price)}</strong><small>cost ÷ (1 − margin)</small></article>
          <article><span>Gross profit/unit</span><strong>{currency.format(selectedPricingProduct.unit_price-selectedPricingProduct.unit_cost)}</strong><small>before operating expenses</small></article>
        </div>}
      </section>
    </section>
  );
}
