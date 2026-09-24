export type PurchasingDocumentKind = 'purchase_order' | 'packing_slip' | 'vendor_invoice' | 'unknown';

export type ParsedPurchasingLine = {
  sku: string;
  description: string;
  quantity: number | null;
  unitCost: number | null;
  taxAmount: number | null;
};

export type ParsedPurchasingDocument = {
  kind: PurchasingDocumentKind;
  confidence: number;
  documentNumber: string;
  poNumber: string;
  vendorName: string;
  documentDate: string;
  dueDate: string;
  packingSlipNumber: string;
  lines: ParsedPurchasingLine[];
};

type TextDetectorInstance = {
  detect(source: ImageBitmap): Promise<Array<{ rawValue?: string }>>;
};

function normalizeDate(value: string) {
  const raw = value.trim();
  const iso = raw.match(/\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const us = raw.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](20\d{2})\b/);
  if (!us) return '';
  return `${us[3]}-${String(us[1]).padStart(2, '0')}-${String(us[2]).padStart(2, '0')}`;
}

function firstMatch(source: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[|]+$/, '');
  }
  return '';
}

function classify(text: string): PurchasingDocumentKind {
  const value = text.toLowerCase();
  const invoice = /(vendor\s+invoice|invoice\s*(?:no|number|#)|amount\s+due|bill\s+to)/i.test(value);
  const packing = /(packing\s+slip|packing\s+list|ship(?:ment)?\s*(?:no|number|#)|received\s+qty)/i.test(value);
  const po = /(purchase\s+order|po\s*(?:no|number|#)|purchase\s+order\s*(?:no|number|#))/i.test(value);
  if (invoice) return 'vendor_invoice';
  if (packing) return 'packing_slip';
  if (po) return 'purchase_order';
  return 'unknown';
}

function parseLines(text: string) {
  const lines = text
    .replace(/\u0000/g, '')
    .split(/\r?\n+/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  const parsed: ParsedPurchasingLine[] = [];
  for (const line of lines) {
    if (/^(subtotal|total|tax|freight|shipping|amount due|balance due)/i.test(line)) continue;
    const numbers = [...line.matchAll(/(?:^|\s)(\d+(?:\.\d{1,4})?)(?=\s|$|\$)/g)].map((m) => Number(m[1]));
    const money = [...line.matchAll(/\$?\s*(\d+(?:,\d{3})*(?:\.\d{2,4}))/g)].map((m) => Number(m[1].replace(/,/g, '')));
    const skuMatch = line.match(/\b([A-Z0-9][A-Z0-9._\/-]{2,})\b/i);
    if (!skuMatch || (!numbers.length && !money.length)) continue;

    const sku = skuMatch[1].trim();
    if (/^(invoice|purchase|packing|order|total|date|vendor|ship|bill)$/i.test(sku)) continue;
    const quantity = numbers.find((n) => n > 0 && Number.isFinite(n)) ?? null;
    const unitCost = money.length ? money[money.length - 1] : null;
    const description = line.replace(sku, '').replace(/\$?\s*\d+(?:,\d{3})*(?:\.\d{1,4})?/g, ' ').replace(/\s+/g, ' ').trim();
    parsed.push({ sku, description, quantity, unitCost, taxAmount: null });
  }
  return parsed.slice(0, 100);
}

function confidenceFor(document: Omit<ParsedPurchasingDocument, 'confidence'>) {
  let score = 0;
  if (document.kind !== 'unknown') score += 0.2;
  if (document.poNumber) score += 0.25;
  if (document.documentNumber || document.packingSlipNumber) score += 0.2;
  if (document.documentDate) score += 0.1;
  if (document.vendorName) score += 0.1;
  if (document.lines.length) score += 0.15;
  return Math.min(1, Number(score.toFixed(2)));
}

export function parsePurchasingDocumentText(source: string): ParsedPurchasingDocument {
  const text = source.replace(/\u0000/g, '');
  const kind = classify(text);

  const poNumber = firstMatch(text, [
    /(?:purchase\s+order|po)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i,
    /\bPO\s*[:#-]\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i
  ]);

  const invoiceNumber = firstMatch(text, [
    /invoice\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i,
    /invoice\s*[:#-]\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i
  ]);

  const packingSlipNumber = firstMatch(text, [
    /packing\s+(?:slip|list)\s*(?:no\.?|number|#)?\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i,
    /shipment\s*(?:no\.?|number|#)\s*[:#-]?\s*([A-Z0-9][A-Z0-9._\/-]{2,})/i
  ]);

  const vendorName = firstMatch(text, [
    /(?:vendor|supplier|sold\s+by)\s*[:#-]\s*([^\n\r]{2,80})/i
  ]);

  const dateText = firstMatch(text, [
    /(?:invoice\s+date|order\s+date|date)\s*[:#-]\s*([^\n\r]{6,20})/i
  ]);

  const dueDateText = firstMatch(text, [
    /(?:due\s+date|payment\s+due)\s*[:#-]\s*([^\n\r]{6,20})/i
  ]);

  const base = {
    kind,
    documentNumber: kind === 'vendor_invoice' ? invoiceNumber : kind === 'packing_slip' ? packingSlipNumber : poNumber,
    poNumber,
    vendorName,
    documentDate: normalizeDate(dateText),
    dueDate: normalizeDate(dueDateText),
    packingSlipNumber,
    lines: parseLines(text)
  };

  return { ...base, confidence: confidenceFor(base) };
}

export async function extractPurchasingDocumentFromImage(file: File): Promise<ParsedPurchasingDocument> {
  const TextDetectorCtor = (globalThis as unknown as {
    TextDetector?: new () => TextDetectorInstance;
  }).TextDetector;

  if (!file.type.startsWith('image/')) throw new Error('purchasing_document_image_required');
  if (file.size > 12_000_000) throw new Error('purchasing_document_image_too_large');
  if (!TextDetectorCtor || typeof createImageBitmap !== 'function') {
    throw new Error('purchasing_document_ocr_not_supported');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const blocks = await new TextDetectorCtor().detect(bitmap);
    const text = blocks.map((block) => String(block.rawValue || '').trim()).filter(Boolean).join('\n');
    if (!text.trim()) throw new Error('purchasing_document_no_text_found');
    return parsePurchasingDocumentText(text);
  } finally {
    bitmap.close();
  }
}
