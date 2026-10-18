export type CandidateImportRow = {
  fullName: string;
  email?: string;
  phone?: string;
};

export type CandidateImportResult = {
  candidates: CandidateImportRow[];
  unsupportedHeaders: string[];
};

const SUPPORTED = new Set(['name', 'full_name', 'email', 'phone']);

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
      continue;
    }
    if (char === ',' && !quoted) {
      cells.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  if (quoted) throw new Error('candidate_import_unclosed_quote');
  cells.push(current.trim());
  return cells;
}

export function parseCandidateImportCsv(text: string): CandidateImportResult {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) throw new Error('candidate_import_rows_required');

  const headers = parseCsvLine(lines[0]).map((value) => value.trim().toLowerCase());
  const nameIndex = headers.findIndex((header) => header === 'name' || header === 'full_name');
  if (nameIndex < 0) throw new Error('candidate_import_name_header_required');

  const emailIndex = headers.indexOf('email');
  const phoneIndex = headers.indexOf('phone');
  const unsupportedHeaders = headers.filter((header) => header && !SUPPORTED.has(header));

  const seen = new Set<string>();
  const candidates: CandidateImportRow[] = [];

  for (const line of lines.slice(1)) {
    const cells = parseCsvLine(line);
    const fullName = (cells[nameIndex] || '').trim();
    const email = emailIndex >= 0 ? (cells[emailIndex] || '').trim() : '';
    const phone = phoneIndex >= 0 ? (cells[phoneIndex] || '').trim() : '';

    if (!fullName) throw new Error('candidate_import_name_required');

    const dedupeKey = email ? `email:${email.toLowerCase()}` : `name:${fullName.toLowerCase()}|phone:${phone}`;
    if (seen.has(dedupeKey)) throw new Error('candidate_import_duplicate_row');
    seen.add(dedupeKey);

    candidates.push({
      fullName,
      ...(email ? { email } : {}),
      ...(phone ? { phone } : {})
    });
  }

  if (!candidates.length) throw new Error('candidate_import_rows_required');
  return { candidates, unsupportedHeaders };
}
