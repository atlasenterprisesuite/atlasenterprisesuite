import { describe, expect, test } from 'vitest';

const validationPath = '../../apps/reconnect-autofill-extension/src/core/validation';
const duplicatesPath = '../../apps/reconnect-autofill-extension/src/core/duplicates';

async function loadCore() {
  let validation: any;
  let duplicates: any;
  let loadError: unknown;

  try {
    validation = await import(validationPath);
    duplicates = await import(duplicatesPath);
  } catch (error) {
    loadError = error;
  }

  expect(loadError, 'Reconnect core modules must exist').toBeUndefined();
  return { validation, duplicates };
}

function verifiedRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws-1',
    claimWeekStart: '2026-09-27',
    claimWeekEnd: '2026-10-03',
    contactDate: '2026-10-01',
    contactType: 'website',
    contactMethod: 'online',
    employerName: 'Ciera + Co.',
    websiteUrl: 'https://www.indeed.com/',
    workType: 'Accounting',
    jobTitle: 'Accounting Specialist',
    referenceNumber: 'f325535cd06eff02',
    result: 'Application submitted / pending',
    evidence: [
      {
        sourceType: 'gmail',
        sourceId: 'message-1',
        capturedAt: '2026-10-01T19:58:34Z',
        factPaths: [
          'contactDate',
          'contactType',
          'contactMethod',
          'employerName',
          'websiteUrl',
          'workType',
          'jobTitle',
          'referenceNumber',
          'result'
        ]
      }
    ],
    verificationStatus: 'verified',
    ...overrides
  };
}

describe('ATLAS Reconnect work-search validation', () => {
  test('accepts a fully evidence-backed record inside inclusive claim-week bounds', async () => {
    const { validation } = await loadCore();

    const middle = validation.validateWorkSearchRecord(verifiedRecord());
    const firstDay = validation.validateWorkSearchRecord(verifiedRecord({ contactDate: '2026-09-27' }));
    const lastDay = validation.validateWorkSearchRecord(verifiedRecord({ contactDate: '2026-10-03' }));

    expect(middle.status).toBe('verified');
    expect(middle.ready).toBe(true);
    expect(firstDay.status).toBe('verified');
    expect(lastDay.status).toBe('verified');
  });

  test('marks a contact outside the explicit claim week as outside_week', async () => {
    const { validation } = await loadCore();

    const result = validation.validateWorkSearchRecord(
      verifiedRecord({ contactDate: '2026-10-04' })
    );

    expect(result.status).toBe('outside_week');
    expect(result.ready).toBe(false);
    expect(result.issues).toContain('contact_date_outside_claim_week');
  });

  test('downgrades records with populated facts that have no evidence provenance', async () => {
    const { validation } = await loadCore();
    const record = verifiedRecord({ telephone: '407-555-0100' });

    const result = validation.validateWorkSearchRecord(record);

    expect(result.status).toBe('partial');
    expect(result.ready).toBe(false);
    expect(result.issues).toContain('unverified_field:telephone');
  });

  test('marks missing destination-critical information as partial instead of inventing it', async () => {
    const { validation } = await loadCore();
    const record = verifiedRecord({
      websiteUrl: undefined,
      emailAddress: undefined,
      telephone: undefined,
      fax: undefined,
      streetAddress: undefined,
      jobTitle: undefined,
      referenceNumber: undefined,
      evidence: [
        {
          sourceType: 'gmail',
          sourceId: 'message-1',
          capturedAt: '2026-10-01T19:58:34Z',
          factPaths: ['contactDate', 'contactType', 'contactMethod', 'employerName', 'workType', 'result']
        }
      ]
    });

    const result = validation.validateWorkSearchRecord(record);

    expect(result.status).toBe('partial');
    expect(result.ready).toBe(false);
    expect(result.issues).toContain('missing_employer_contact_detail');
    expect(result.issues).toContain('missing_job_title_or_reference');
  });

  test('blocks records whose evidence explicitly reports a factual conflict', async () => {
    const { validation } = await loadCore();
    const record = verifiedRecord({
      evidence: [
        {
          sourceType: 'gmail',
          sourceId: 'message-1',
          capturedAt: '2026-10-01T19:58:34Z',
          factPaths: ['contactDate', 'contactType', 'contactMethod', 'employerName', 'websiteUrl', 'workType', 'jobTitle', 'referenceNumber', 'result'],
          conflicts: ['employerName']
        }
      ]
    });

    const result = validation.validateWorkSearchRecord(record);

    expect(result.status).toBe('unsupported');
    expect(result.ready).toBe(false);
    expect(result.issues).toContain('evidence_conflict:employerName');
  });

  test('rejects manipulated contact, status, and evidence enum values instead of trusting imported JSON', async () => {
    const { validation } = await loadCore();
    const cases = [
      [verifiedRecord({ contactType: 'carrier_pigeon' }), 'invalid_contact_type'],
      [verifiedRecord({ contactMethod: 'telepathy' }), 'invalid_contact_method'],
      [verifiedRecord({ verificationStatus: 'approved' }), 'invalid_verification_status'],
      [verifiedRecord({ evidence: [{ sourceType: 'unknown-provider', capturedAt: '2026-10-01T19:58:34Z', factPaths: ['contactDate','contactType','contactMethod','employerName','websiteUrl','workType','jobTitle','referenceNumber','result'] }] }), 'invalid_evidence_source']
    ] as const;

    for (const [record, issue] of cases) {
      const result = validation.validateWorkSearchRecord(record as any);
      expect(result.status).toBe('unsupported');
      expect(result.ready).toBe(false);
      expect(result.issues).toContain(issue);
    }
  });

  test('normalizes duplicate fingerprints and marks later equivalents duplicate', async () => {
    const { validation, duplicates } = await loadCore();
    const first = verifiedRecord();
    const equivalent = verifiedRecord({
      id: 'ws-2',
      employerName: '  CIERA CO  ',
      jobTitle: 'Accounting   Specialist',
      referenceNumber: 'F325535CD06EFF02'
    });

    expect(duplicates.createDuplicateFingerprint(first)).toBe(
      duplicates.createDuplicateFingerprint(equivalent)
    );

    const batch = validation.validateWorkSearchBatch([first, equivalent]);
    expect(batch.records[0].status).toBe('verified');
    expect(batch.records[1].status).toBe('duplicate');
    expect(batch.readyCount).toBe(1);
  });
});
