import { createDuplicateFingerprint } from './duplicates';
import type {
  VerificationStatus,
  WorkSearchBatchValidationResult,
  WorkSearchRecord,
  WorkSearchValidationResult
} from './types';

const REQUIRED_STRING_FIELDS = [
  'id',
  'claimWeekStart',
  'claimWeekEnd',
  'contactDate',
  'contactType',
  'contactMethod',
  'employerName',
  'workType',
  'result'
] as const;

const FACT_FIELDS = [
  'contactDate',
  'contactType',
  'contactMethod',
  'employerName',
  'referralSource',
  'streetAddress',
  'city',
  'state',
  'postalCode',
  'websiteUrl',
  'emailAddress',
  'telephone',
  'fax',
  'personContacted',
  'workType',
  'jobTitle',
  'referenceNumber',
  'result'
] as const;

const EMPLOYER_CONTACT_FIELDS = ['streetAddress', 'websiteUrl', 'emailAddress', 'telephone', 'fax'] as const;

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validIsoDate(value: unknown): value is string {
  if (!isNonEmptyString(value) || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function unionEvidencePaths(record: WorkSearchRecord): Set<string> {
  const paths = new Set<string>();
  for (const evidence of Array.isArray(record.evidence) ? record.evidence : []) {
    for (const path of Array.isArray(evidence.factPaths) ? evidence.factPaths : []) paths.add(path);
  }
  return paths;
}

function conflictIssues(record: WorkSearchRecord): string[] {
  const issues: string[] = [];
  for (const evidence of Array.isArray(record.evidence) ? record.evidence : []) {
    for (const field of evidence.conflicts ?? []) issues.push(`evidence_conflict:${field}`);
  }
  return [...new Set(issues)];
}

export function validateWorkSearchRecord(record: WorkSearchRecord): WorkSearchValidationResult {
  const issues: string[] = [];

  for (const field of REQUIRED_STRING_FIELDS) {
    if (!isNonEmptyString(record?.[field])) issues.push(`missing_required:${field}`);
  }

  if (!validIsoDate(record?.claimWeekStart)) issues.push('invalid_claim_week_start');
  if (!validIsoDate(record?.claimWeekEnd)) issues.push('invalid_claim_week_end');
  if (!validIsoDate(record?.contactDate)) issues.push('invalid_contact_date');
  if (validIsoDate(record?.claimWeekStart) && validIsoDate(record?.claimWeekEnd) && record.claimWeekStart > record.claimWeekEnd) {
    issues.push('invalid_claim_week_range');
  }

  if (!Array.isArray(record?.evidence) || record.evidence.length === 0) issues.push('missing_evidence');

  const conflicts = conflictIssues(record);
  issues.push(...conflicts);

  const evidencePaths = unionEvidencePaths(record);
  for (const field of FACT_FIELDS) {
    const value = record?.[field];
    if (isNonEmptyString(value) && !evidencePaths.has(field)) issues.push(`unverified_field:${field}`);
  }

  const hasEmployerContact = EMPLOYER_CONTACT_FIELDS.some((field) => isNonEmptyString(record?.[field]));
  if (!hasEmployerContact) issues.push('missing_employer_contact_detail');

  if (!isNonEmptyString(record?.jobTitle) && !isNonEmptyString(record?.referenceNumber)) {
    issues.push('missing_job_title_or_reference');
  }

  const structuralFailure = issues.some((issue) =>
    issue.startsWith('missing_required:') ||
    issue.startsWith('invalid_') ||
    issue === 'missing_evidence' ||
    issue.startsWith('evidence_conflict:')
  );

  let status: VerificationStatus;
  if (structuralFailure) {
    status = 'unsupported';
  } else if (
    validIsoDate(record.contactDate) &&
    validIsoDate(record.claimWeekStart) &&
    validIsoDate(record.claimWeekEnd) &&
    (record.contactDate < record.claimWeekStart || record.contactDate > record.claimWeekEnd)
  ) {
    issues.push('contact_date_outside_claim_week');
    status = 'outside_week';
  } else if (
    issues.some((issue) =>
      issue.startsWith('unverified_field:') ||
      issue === 'missing_employer_contact_detail' ||
      issue === 'missing_job_title_or_reference'
    )
  ) {
    status = 'partial';
  } else {
    status = 'verified';
  }

  return {
    record,
    status,
    ready: status === 'verified',
    issues: [...new Set(issues)]
  };
}

export function validateWorkSearchBatch(records: WorkSearchRecord[]): WorkSearchBatchValidationResult {
  const seen = new Set<string>();
  const validated = records.map((record) => {
    const result = validateWorkSearchRecord(record);
    const fingerprint = createDuplicateFingerprint(record);

    if (seen.has(fingerprint)) {
      return {
        ...result,
        status: 'duplicate' as const,
        ready: false,
        issues: [...new Set([...result.issues, 'duplicate_record'])]
      };
    }

    seen.add(fingerprint);
    return result;
  });

  return {
    records: validated,
    readyCount: validated.filter((record) => record.ready).length
  };
}
