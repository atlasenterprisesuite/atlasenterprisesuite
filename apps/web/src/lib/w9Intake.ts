export type W9TaxClassification =
  | 'individual_sole_proprietor'
  | 'c_corporation'
  | 's_corporation'
  | 'partnership'
  | 'trust_estate'
  | 'llc'
  | 'other';

export type ParsedW9 = {
  legalName: string;
  businessName: string;
  classification: W9TaxClassification | '';
  llcTaxClassification: 'C' | 'S' | 'P' | '';
  addressLine1: string;
  addressLine2: string;
  city: string;
  state: string;
  postalCode: string;
  taxIdType: 'ein' | 'ssn' | 'unknown';
  taxIdLast4: string;
};

type TextDetectorInstance = {
  detect(source: ImageBitmap): Promise<Array<{ rawValue?: string }>>;
};

function nextMeaningfulLine(lines: string[], matcher: RegExp) {
  const index = lines.findIndex((line) => matcher.test(line));
  if (index < 0) return '';
  for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
    const candidate = lines[cursor].trim();
    if (!candidate) continue;
    if (/^(requester|list account|part i|part ii|signature|taxpayer identification|social security|employer identification)/i.test(candidate)) continue;
    return candidate;
  }
  return '';
}

function selected(text: string, label: string) {
  const value = text.toLowerCase().replace(/\s+/g, ' ');
  const target = label.toLowerCase();
  const prefixes = ['☒ ', '✓ ', '✔ ', '■ ', '[x] ', 'x '];
  const suffixes = [' ☒', ' ✓', ' ✔', ' ■', ' [x]', ' x'];
  return prefixes.some((prefix) => value.includes(prefix + target))
    || suffixes.some((suffix) => value.includes(target + suffix));
}

function classificationFromText(text: string): Pick<ParsedW9, 'classification' | 'llcTaxClassification'> {
  if (selected(text, 'Individual/sole proprietor') || selected(text, 'Individual')) return { classification: 'individual_sole_proprietor', llcTaxClassification: '' };
  if (selected(text, 'C corporation')) return { classification: 'c_corporation', llcTaxClassification: '' };
  if (selected(text, 'S corporation')) return { classification: 's_corporation', llcTaxClassification: '' };
  if (selected(text, 'Partnership')) return { classification: 'partnership', llcTaxClassification: '' };
  if (selected(text, 'Trust/estate') || selected(text, 'Trust')) return { classification: 'trust_estate', llcTaxClassification: '' };
  if (selected(text, 'Limited liability company') || selected(text, 'LLC')) {
    const llcMatch = text.match(/(?:LLC|limited liability company)[\s\S]{0,80}?tax classification\s*[:\-]?\s*([CSP])/i);
    return { classification: 'llc', llcTaxClassification: (llcMatch?.[1]?.toUpperCase() as 'C' | 'S' | 'P' | undefined) || '' };
  }
  if (selected(text, 'Other')) return { classification: 'other', llcTaxClassification: '' };
  return { classification: '', llcTaxClassification: '' };
}

function parseCityStateZip(value: string) {
  const match = value.trim().match(/^(.+?)[,\s]+([A-Z]{2})\s+(\d{5}(?:-\d{4})?)$/i);
  if (!match) return { city: '', state: '', postalCode: '' };
  return { city: match[1].trim().replace(/,$/, ''), state: match[2].toUpperCase(), postalCode: match[3] };
}

export function parseW9Text(source: string): ParsedW9 {
  const normalized = source.replace(/\u0000/g, '').replace(/\r/g, '\n');
  const lines = normalized.split(/\n+/).map((line) => line.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const legalName = nextMeaningfulLine(lines, /name.*shown.*income tax return/i);
  const businessName = nextMeaningfulLine(lines, /business name.*disregarded/i);
  const addressLine1 = nextMeaningfulLine(lines, /address.*number.*street/i);
  const cityStateZipLine = nextMeaningfulLine(lines, /city.*state.*zip/i);
  const location = parseCityStateZip(cityStateZipLine);
  const ein = normalized.match(/\b\d{2}-\d{7}\b/);
  const ssn = normalized.match(/\b\d{3}-\d{2}-\d{4}\b/);
  const tin = ein?.[0] || ssn?.[0] || '';
  const classification = classificationFromText(normalized);

  return {
    legalName,
    businessName,
    ...classification,
    addressLine1,
    addressLine2: '',
    ...location,
    taxIdType: ein ? 'ein' : ssn ? 'ssn' : 'unknown',
    taxIdLast4: tin ? tin.replace(/\D/g, '').slice(-4) : ''
  };
}

export async function extractW9FromImage(file: File): Promise<ParsedW9> {
  const TextDetectorCtor = (globalThis as unknown as {
    TextDetector?: new () => TextDetectorInstance;
  }).TextDetector;

  if (!TextDetectorCtor || typeof createImageBitmap !== 'function') {
    throw new Error('w9_ocr_not_supported');
  }

  const bitmap = await createImageBitmap(file);
  try {
    const blocks = await new TextDetectorCtor().detect(bitmap);
    const text = blocks.map((block) => String(block.rawValue || '').trim()).filter(Boolean).join('\n');
    if (!text.trim()) throw new Error('w9_no_text_found');
    return parseW9Text(text);
  } finally {
    bitmap.close();
  }
}

export function suggestVendorCode(name: string, now = new Date()) {
  const stem = name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 8) || 'VENDOR';
  const stamp = now.toISOString().slice(2, 10).replaceAll('-', '');
  const suffix = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID().slice(0, 4).toUpperCase()
    : Math.random().toString(16).slice(2, 6).toUpperCase();
  return 'VND-' + stem + '-' + stamp + '-' + suffix;
}
