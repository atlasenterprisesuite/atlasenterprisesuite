import type { WorkSearchRecord, WorkSearchValidationResult } from './types';
import { validateWorkSearchBatch } from './validation';

export interface ReconnectDiagnostic {
  level: 'info' | 'warning' | 'error';
  message: string;
}

export interface ReconnectSessionSnapshot {
  records: WorkSearchValidationResult[];
  readyCount: number;
  diagnostics: ReconnectDiagnostic[];
}

export interface ReconnectImportResult {
  ok: boolean;
  error?: 'malformed_json' | 'invalid_shape' | 'sensitive_field' | 'invalid_record';
  snapshot: ReconnectSessionSnapshot;
}

const SENSITIVE_KEY = /(password|passcode|mfa|otp|securityanswer|securityquestion|ssn|socialsecurity|bank|routingnumber|accountnumber|cardnumber|cvv|pin)/i;

const RECORD_KEYS = new Set([
  'id','claimWeekStart','claimWeekEnd','contactDate','contactType','contactMethod','employerName','referralSource',
  'streetAddress','city','state','postalCode','websiteUrl','emailAddress','telephone','fax','personContacted','workType',
  'jobTitle','referenceNumber','result','notes','evidence','verificationStatus'
]);
const EVIDENCE_KEYS = new Set(['sourceType','sourceId','capturedAt','factPaths','conflicts']);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasSensitiveKey);
  if (!isObject(value)) return false;
  return Object.entries(value).some(([key, nested]) => SENSITIVE_KEY.test(key) || hasSensitiveKey(nested));
}

function canonicalizeEvidence(value: unknown): WorkSearchRecord['evidence'] | null {
  if (!Array.isArray(value)) return null;
  const evidence: WorkSearchRecord['evidence'] = [];
  for (const item of value) {
    if (!isObject(item)) return null;
    const clean: Record<string, unknown> = {};
    for (const key of EVIDENCE_KEYS) if (key in item) clean[key] = item[key];
    if (typeof clean.sourceType !== 'string' || typeof clean.capturedAt !== 'string' || !Array.isArray(clean.factPaths)) return null;
    evidence.push(clean as unknown as WorkSearchRecord['evidence'][number]);
  }
  return evidence;
}

function canonicalizeRecord(value: unknown): WorkSearchRecord | null {
  if (!isObject(value)) return null;
  const evidence = canonicalizeEvidence(value.evidence);
  if (!evidence) return null;
  const clean: Record<string, unknown> = { evidence };
  for (const key of RECORD_KEYS) {
    if (key === 'evidence') continue;
    if (key in value) clean[key] = value[key];
  }
  return clean as unknown as WorkSearchRecord;
}

function parseRecords(jsonText: string): { ok: true; records: WorkSearchRecord[] } | { ok: false; error: ReconnectImportResult['error'] } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return { ok: false, error: 'malformed_json' };
  }
  if (hasSensitiveKey(parsed)) return { ok: false, error: 'sensitive_field' };

  const candidate = Array.isArray(parsed)
    ? parsed
    : isObject(parsed) && Array.isArray(parsed.records)
      ? parsed.records
      : null;
  if (!candidate) return { ok: false, error: 'invalid_shape' };

  const records: WorkSearchRecord[] = [];
  for (const item of candidate) {
    const record = canonicalizeRecord(item);
    if (!record) return { ok: false, error: 'invalid_record' };
    records.push(record);
  }
  return { ok: true, records };
}

export function createSessionStore() {
  let snapshot: ReconnectSessionSnapshot = { records: [], readyCount: 0, diagnostics: [] };

  function getSnapshot(): ReconnectSessionSnapshot {
    return {
      records: snapshot.records.map((record) => ({ ...record, issues: [...record.issues] })),
      readyCount: snapshot.readyCount,
      diagnostics: snapshot.diagnostics.map((entry) => ({ ...entry }))
    };
  }

  function clearSession(): ReconnectSessionSnapshot {
    snapshot = { records: [], readyCount: 0, diagnostics: [] };
    return getSnapshot();
  }

  function importRecords(jsonText: string): ReconnectImportResult {
    const parsed = parseRecords(jsonText);
    if (!parsed.ok) {
      clearSession();
      return { ok: false, error: parsed.error, snapshot: getSnapshot() };
    }

    const validated = validateWorkSearchBatch(parsed.records);
    snapshot = {
      records: validated.records,
      readyCount: validated.readyCount,
      diagnostics: []
    };
    return { ok: true, snapshot: getSnapshot() };
  }

  function addDiagnostic(entry: ReconnectDiagnostic): void {
    snapshot = { ...snapshot, diagnostics: [...snapshot.diagnostics, { ...entry }] };
  }

  return { importRecords, clearSession, getSnapshot, addDiagnostic };
}
