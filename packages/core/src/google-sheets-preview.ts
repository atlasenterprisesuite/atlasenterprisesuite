/** Pure preview only: no provider access, persistence or authorization claims.
 * Request Sheets FORMATTED_VALUE strings; this initial contract supports USD only.
 */
export type SheetTransaction = {
  rowNumber: number;
  reference: string;
  date: string;
  description: string;
  amountMinor: number;
  currency: 'USD';
};

export type SheetPreviewIssue = {
  rowNumber: number;
  code: 'invalid_row' | 'missing_reference' | 'duplicate_reference' | 'invalid_date' | 'invalid_amount' | 'unsupported_currency';
};

export function previewGoogleSheetTransactions(values: readonly (readonly unknown[])[]): {
  rows: SheetTransaction[];
  issues: SheetPreviewIssue[];
} {
  if (!Array.isArray(values) || values.length > 10001) throw new Error('Preview requires at most 10000 data rows');
  const header = values[0]?.map((value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '');
  const required = ['reference', 'date', 'description', 'amount', 'currency'];
  if (!header || new Set(header).size !== header.length || required.some(column => !header.includes(column))) {
    throw new Error('Required columns: reference, date, description, amount, currency; columns must be unique');
  }
  const indexes = required.map(column => header.indexOf(column));
  const rows: SheetTransaction[] = [];
  const issues: SheetPreviewIssue[] = [];
  const references = new Set<string>();
  for (let index = 1; index < values.length; index++) {
    const source = values[index];
    const rowNumber = index + 1;
    const issue = (code: SheetPreviewIssue['code']) => issues.push({ rowNumber, code });
    if (!Array.isArray(source)) { issue('invalid_row'); continue; }
    if (source.every(value => value === '' || value === null || value === undefined)) continue;
    const cells = indexes.map(column => source[column] ?? '');
    if (cells.some(value => typeof value !== 'string')) { issue('invalid_row'); continue; }
    const [reference, date, description, amount, currency] = (cells as string[]).map(value => value.trim());
    if (!reference) { issue('missing_reference'); continue; }
    const parsedDate = new Date(`${date}T00:00:00.000Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsedDate.getTime()) || parsedDate.toISOString().slice(0, 10) !== date) {
      issue('invalid_date'); continue;
    }
    if (currency !== 'USD') { issue('unsupported_currency'); continue; }
    if (!/^-?\d{1,14}(?:\.\d{1,2})?$/.test(amount)) { issue('invalid_amount'); continue; }
    const [whole, fraction = ''] = amount.replace(/^-/, '').split('.');
    const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, '0'));
    if (minor > BigInt(Number.MAX_SAFE_INTEGER)) { issue('invalid_amount'); continue; }
    if (references.has(reference)) { issue('duplicate_reference'); continue; }
    references.add(reference);
    rows.push({ rowNumber, reference, date, description, amountMinor: Number(minor) * (amount.startsWith('-') ? -1 : 1), currency });
  }
  return { rows, issues };
}
