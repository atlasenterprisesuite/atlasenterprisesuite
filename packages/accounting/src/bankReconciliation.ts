/** Local comparison proposals only: no bank connection, ledger posting or approval. */
export type ReconciliationCurrency = 'USD' | 'EUR' | 'GBP' | 'CAD' | 'AUD';
export type ReconciliationEntry = {
  id: string;
  date: string;
  amountMinor: number;
  currency: ReconciliationCurrency;
  reference: string;
  description: string;
};
export type ReconciliationOptions = { dateWindowDays: number };
export type ReconciliationSource = { fileName: string; sha256: string; entries: ReconciliationEntry[] };
export type ReconciliationException = { id: string; reason: 'missing_reference' | 'no_candidate' | 'ambiguous' };
export type ReconciliationResult = {
  proposals: { bankId: string; ledgerId: string; amountMinor: number; currency: ReconciliationCurrency; dateDeltaDays: number }[];
  bankExceptions: ReconciliationException[];
  ledgerExceptions: ReconciliationException[];
  totals: { currency: ReconciliationCurrency; bankMinor: number; ledgerMinor: number; differenceMinor: number };
};

export const RECONCILIATION_MAX_BYTES = 2 * 1024 * 1024;
const MAX_ROWS = 10_000;
const CURRENCIES: readonly string[] = ['USD', 'EUR', 'GBP', 'CAD', 'AUD'];
const DAY = 86_400_000;

function calendarDay(value: string): number {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(value) ? Date.parse(`${value}T00:00:00.000Z`) : NaN;
  if (!Number.isFinite(time) || new Date(time).toISOString().slice(0, 10) !== value) throw new Error('Fecha inválida: utiliza un día real en formato YYYY-MM-DD.');
  return time / DAY;
}

function safeMinor(value: bigint): number {
  if (value > BigInt(Number.MAX_SAFE_INTEGER) || value < -BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Importe o total fuera del rango seguro.');
  return Number(value);
}

function parseMinor(value: string): number {
  if (!/^-?\d+(?:\.\d{1,2})?$/.test(value)) throw new Error('Importe inválido: utiliza decimales con punto, hasta dos cifras y sin separadores de miles.');
  const [whole, fraction = ''] = value.replace(/^-/, '').split('.');
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
  return safeMinor(value.startsWith('-') ? -minor : minor);
}

function csvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let closedQuote = false;
  let recordProvided = false;
  const endField = () => { row.push(field); field = ''; closedQuote = false; };
  const endRow = () => {
    endField();
    if (recordProvided) rows.push(row);
    if (rows.length > MAX_ROWS + 1) throw new Error('El archivo supera 10.000 movimientos.');
    row = [];
    recordProvided = false;
  };
  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char !== '\r' && char !== '\n') recordProvided = true;
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (char === '"') { quoted = false; closedQuote = true; }
      else field += char;
    } else if (char === ',') endField();
    else if (char === '\r' || char === '\n') {
      endRow();
      if (char === '\r' && text[i + 1] === '\n') i++;
    } else if (closedQuote) throw new Error('CSV inválido: hay contenido después de una comilla de cierre.');
    else if (char === '"') {
      if (field !== '') throw new Error('CSV inválido: comilla dentro de un campo sin delimitar.');
      quoted = true;
    } else field += char;
  }
  if (quoted) throw new Error('CSV inválido: falta cerrar una comilla.');
  if (field !== '' || row.length || closedQuote) endRow();
  return rows;
}

function validateEntries(entries: readonly ReconciliationEntry[]): void {
  if (!entries.length || entries.length > MAX_ROWS) throw new Error('Selecciona entre 1 y 10.000 movimientos por archivo.');
  const ids = new Set<string>();
  for (const entry of entries) {
    if (typeof entry.id !== 'string' || !entry.id.trim() || entry.id !== entry.id.trim() || ids.has(entry.id)) throw new Error('Cada movimiento necesita un id único y no vacío.');
    ids.add(entry.id);
    calendarDay(entry.date);
    if (!Number.isSafeInteger(entry.amountMinor)) throw new Error('Importe inválido: se requieren unidades menores enteras y seguras.');
    if (!CURRENCIES.includes(entry.currency)) throw new Error('Moneda no admitida: utiliza USD, EUR, GBP, CAD o AUD.');
    if (typeof entry.reference !== 'string' || typeof entry.description !== 'string') throw new Error('Referencia o descripción inválida.');
  }
  if (new Set(entries.map(entry => entry.currency)).size !== 1) throw new Error('Cada archivo debe utilizar una sola moneda.');
}

export function parseReconciliationCsv(text: string): ReconciliationEntry[] {
  if (text.length > RECONCILIATION_MAX_BYTES || new TextEncoder().encode(text).byteLength > RECONCILIATION_MAX_BYTES) throw new Error('El archivo supera 2 MiB.');
  const [header, ...rows] = csvRows(text.replace(/^\ufeff/, ''));
  if (!header) throw new Error('Falta la cabecera CSV.');
  const names = header.map(name => name.trim().toLowerCase());
  const required = ['id', 'date', 'amount', 'currency'];
  const allowed = [...required, 'reference', 'description'];
  if (new Set(names).size !== names.length || names.some(name => !allowed.includes(name)) || required.some(name => !names.includes(name))) throw new Error('Cabecera inválida. Requeridos: id,date,amount,currency; opcionales: reference,description.');
  const entries = rows.map((row, index): ReconciliationEntry => {
    if (row.length !== names.length) throw new Error(`Fila ${index + 2}: cantidad de columnas inválida.`);
    const cell = (name: string) => { const position = names.indexOf(name); return position < 0 ? '' : row[position].trim(); };
    try {
      return { id: cell('id'), date: cell('date'), amountMinor: parseMinor(cell('amount')), currency: cell('currency') as ReconciliationCurrency, reference: cell('reference'), description: cell('description') };
    } catch (cause) {
      throw new Error(`Fila ${index + 2}: ${cause instanceof Error ? cause.message : 'datos inválidos'}`);
    }
  });
  validateEntries(entries);
  return entries;
}

// Date buckets bound a lookup to at most 61 days, even for repeated references.
type EntryIndex = Map<string, Map<number, ReconciliationEntry[]>>;
const matchKey = (entry: ReconciliationEntry) => JSON.stringify([entry.currency, entry.amountMinor, entry.reference.trim().toUpperCase()]);
function indexEntries(entries: readonly ReconciliationEntry[]): EntryIndex {
  const index: EntryIndex = new Map();
  for (const entry of entries) {
    if (!entry.reference.trim()) continue;
    const key = matchKey(entry);
    const dates = index.get(key) ?? new Map<number, ReconciliationEntry[]>();
    const day = calendarDay(entry.date);
    const bucket = dates.get(day) ?? [];
    bucket.push(entry);
    dates.set(day, bucket);
    index.set(key, dates);
  }
  return index;
}

function candidates(entry: ReconciliationEntry, index: EntryIndex, window: number): { count: number; one?: ReconciliationEntry } {
  const dates = index.get(matchKey(entry));
  if (!entry.reference.trim() || !dates) return { count: 0 };
  const day = calendarDay(entry.date);
  let one: ReconciliationEntry | undefined;
  for (let candidateDay = day - window; candidateDay <= day + window; candidateDay++) {
    const rows = dates.get(candidateDay);
    if (!rows?.length) continue;
    if (rows.length > 1 || one) return { count: 2 };
    one = rows[0];
  }
  return one ? { count: 1, one } : { count: 0 };
}

export function reconcileStatements(bank: readonly ReconciliationEntry[], ledger: readonly ReconciliationEntry[], options: ReconciliationOptions): ReconciliationResult {
  validateEntries(bank);
  validateEntries(ledger);
  if (bank[0].currency !== ledger[0].currency) throw new Error('Banco y libro deben utilizar la misma moneda.');
  const window = options.dateWindowDays;
  if (!Number.isInteger(window) || window < 0 || window > 30) throw new Error('La ventana debe ser un número entero entre 0 y 30 días.');
  const bankIndex = indexEntries(bank);
  const ledgerIndex = indexEntries(ledger);
  const proposals: ReconciliationResult['proposals'] = [];
  const bankExceptions: ReconciliationException[] = [];
  const matchedLedger = new Set<string>();
  for (const entry of bank) {
    const match = candidates(entry, ledgerIndex, window);
    if (match.one && candidates(match.one, bankIndex, window).count === 1) {
      proposals.push({ bankId: entry.id, ledgerId: match.one.id, amountMinor: entry.amountMinor, currency: entry.currency, dateDeltaDays: Math.abs(calendarDay(entry.date) - calendarDay(match.one.date)) });
      matchedLedger.add(match.one.id);
    } else bankExceptions.push({ id: entry.id, reason: !entry.reference.trim() ? 'missing_reference' : match.count ? 'ambiguous' : 'no_candidate' });
  }
  const ledgerExceptions: ReconciliationException[] = ledger.filter(entry => !matchedLedger.has(entry.id)).map(entry => ({ id: entry.id, reason: !entry.reference.trim() ? 'missing_reference' : candidates(entry, bankIndex, window).count ? 'ambiguous' : 'no_candidate' }));
  const bankTotal = bank.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n);
  const ledgerTotal = ledger.reduce((sum, entry) => sum + BigInt(entry.amountMinor), 0n);
  return { proposals, bankExceptions, ledgerExceptions, totals: { currency: bank[0].currency, bankMinor: safeMinor(bankTotal), ledgerMinor: safeMinor(ledgerTotal), differenceMinor: safeMinor(bankTotal - ledgerTotal) } };
}

export function buildReconciliationEvidence(sources: { bank: ReconciliationSource; ledger: ReconciliationSource }, options: ReconciliationOptions, createdAt: string) {
  for (const source of [sources.bank, sources.ledger]) {
    if (!source.fileName.trim() || !/^[a-f0-9]{64}$/i.test(source.sha256)) throw new Error('Falta el nombre o SHA-256 del archivo original.');
  }
  if (!Number.isFinite(Date.parse(createdAt))) throw new Error('Fecha de evidencia inválida.');
  return {
    schemaVersion: 1,
    mode: 'local_file_comparison' as const,
    reviewState: 'requires_human_review' as const,
    bankConnected: false,
    posted: false,
    createdAt,
    integrity: 'SHA-256 of source bytes; unsigned local report; identity and source authenticity are unverified.',
    method: { reference: 'trimmed_case_insensitive', amount: 'exact_signed_minor_units', uniqueness: 'mutual', dateWindowDays: options.dateWindowDays },
    sources: { bank: { ...sources.bank, entries: sources.bank.entries.map(entry => ({ ...entry })) }, ledger: { ...sources.ledger, entries: sources.ledger.entries.map(entry => ({ ...entry })) } },
    result: reconcileStatements(sources.bank.entries, sources.ledger.entries, options)
  };
}

export type ReconciliationEvidence = ReturnType<typeof buildReconciliationEvidence>;
