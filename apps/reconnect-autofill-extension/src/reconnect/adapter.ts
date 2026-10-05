import { validateWorkSearchRecord } from '../core/validation';
import type { WorkSearchRecord } from '../core/types';
import {
  mapReconnectFields,
  type ReconnectControl,
  type ReconnectFieldName
} from './field-map';

const OFFICIAL_ORIGIN = 'https://connect.myflorida.com';
const CORE_FIELDS: ReconnectFieldName[] = [
  'contactDate',
  'contactType',
  'contactMethod',
  'employerName',
  'workType',
  'result'
];

export type ReconnectPageKind = 'work_search' | 'final_certification' | 'unsupported';

export interface ReconnectPageDetection {
  supported: boolean;
  kind: ReconnectPageKind;
}

export interface FillReconnectOptions {
  origin: string;
  overwrite?: boolean;
}

export type FillReconnectResult =
  | { status: 'blocked'; reason: string; filled: []; preserved: [] }
  | { status: 'filled'; filled: ReconnectFieldName[]; preserved: ReconnectFieldName[] };

function normalizeOrigin(input: string | URL): string | null {
  try {
    return input instanceof URL ? input.origin : new URL(input).origin;
  } catch {
    return null;
  }
}

function pageText(document: Document): string {
  return (document.body?.textContent ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function isFinalCertificationPage(document: Document): boolean {
  const text = pageText(document);
  const actionLabels = Array.from(document.querySelectorAll('button, input[type="submit"]'))
    .map((element) => `${element.textContent ?? ''} ${(element as HTMLInputElement).value ?? ''}`.toLowerCase())
    .join(' ');
  return (
    text.includes('weekly certification') ||
    actionLabels.includes('certify') ||
    actionLabels.includes('submit certification') ||
    (text.includes('i certify') && text.includes('claim'))
  );
}

export function detectReconnectPage(document: Document, location: string | URL): ReconnectPageDetection {
  if (normalizeOrigin(location) !== OFFICIAL_ORIGIN) return { supported: false, kind: 'unsupported' };
  if (isFinalCertificationPage(document)) return { supported: false, kind: 'final_certification' };

  const text = pageText(document);
  const mapping = mapReconnectFields(document);
  const hasCoreFields = CORE_FIELDS.every((field) => Boolean(mapping.fields[field]));
  if (text.includes('work search') && hasCoreFields && mapping.ambiguous.length === 0) {
    return { supported: true, kind: 'work_search' };
  }
  if (text.includes('work search')) return { supported: true, kind: 'work_search' };
  return { supported: false, kind: 'unsupported' };
}

function recordValues(record: WorkSearchRecord): Partial<Record<ReconnectFieldName, string>> {
  return {
    contactDate: record.contactDate,
    contactType: record.contactType,
    contactMethod: record.contactMethod,
    employerName: record.employerName,
    streetAddress: record.streetAddress,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    websiteUrl: record.websiteUrl,
    emailAddress: record.emailAddress,
    telephone: record.telephone,
    fax: record.fax,
    personContacted: record.personContacted,
    workType: record.workType,
    jobTitle: record.jobTitle,
    referenceNumber: record.referenceNumber,
    result: record.result
  };
}

function populated(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function normalized(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function selectValue(control: HTMLSelectElement, requested: string): string | null {
  const requestedNormalized = normalized(requested);
  for (const option of Array.from(control.options)) {
    if (normalized(option.value) === requestedNormalized || normalized(option.textContent ?? '') === requestedNormalized) {
      return option.value;
    }
  }
  return null;
}

function currentValue(control: ReconnectControl): string {
  return control.value ?? '';
}

function setControlValue(control: ReconnectControl, value: string): void {
  control.value = value;
  control.setAttribute('data-atlas-reconnect-filled', 'true');
  control.dispatchEvent(new Event('input', { bubbles: true }));
  control.dispatchEvent(new Event('change', { bubbles: true }));
}

function blocked(reason: string): FillReconnectResult {
  return { status: 'blocked', reason, filled: [], preserved: [] };
}

export function fillReconnectRecord(
  document: Document,
  record: WorkSearchRecord,
  options: FillReconnectOptions
): FillReconnectResult {
  const page = detectReconnectPage(document, options.origin);
  if (!page.supported) return blocked(page.kind === 'final_certification' ? 'final_certification' : 'unsupported_page');

  const validation = validateWorkSearchRecord(record);
  if (!validation.ready) return blocked('record_not_verified');

  const mapping = mapReconnectFields(document);
  if (mapping.ambiguous.length > 0) return blocked('ambiguous_mapping');

  const values = recordValues(record);
  const required = new Set<ReconnectFieldName>(CORE_FIELDS);
  if (populated(record.jobTitle)) required.add('jobTitle');
  if (populated(record.referenceNumber)) required.add('referenceNumber');
  for (const field of ['streetAddress', 'websiteUrl', 'emailAddress', 'telephone', 'fax'] as ReconnectFieldName[]) {
    if (populated(values[field])) required.add(field);
  }

  for (const field of required) {
    if (!mapping.fields[field]) return blocked('missing_mapping');
  }

  const operations: Array<{ field: ReconnectFieldName; control: ReconnectControl; value: string }> = [];
  const preserved: ReconnectFieldName[] = [];

  for (const [field, value] of Object.entries(values) as [ReconnectFieldName, string | undefined][]) {
    if (!populated(value)) continue;
    const control = mapping.fields[field];
    if (!control) continue;

    if (!options.overwrite && populated(currentValue(control))) {
      preserved.push(field);
      continue;
    }

    let resolvedValue = value;
    if (control instanceof HTMLSelectElement) {
      const resolved = selectValue(control, value);
      if (resolved === null) return blocked('unsupported_select_value');
      resolvedValue = resolved;
    }
    operations.push({ field, control, value: resolvedValue });
  }

  const filled: ReconnectFieldName[] = [];
  for (const operation of operations) {
    setControlValue(operation.control, operation.value);
    filled.push(operation.field);
  }

  return { status: 'filled', filled, preserved };
}
