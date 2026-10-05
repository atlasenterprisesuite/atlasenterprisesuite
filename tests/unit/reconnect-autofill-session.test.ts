import { describe, expect, test } from 'vitest';

const sessionPath = '../../apps/reconnect-autofill-extension/src/core/session';
const messagesPath = '../../apps/reconnect-autofill-extension/src/core/messages';

async function loadSession() {
  let session: any;
  let messages: any;
  let loadError: unknown;
  try {
    session = await import(sessionPath);
    messages = await import(messagesPath);
  } catch (error) {
    loadError = error;
  }
  expect(loadError, 'Reconnect session modules must exist').toBeUndefined();
  return { session, messages };
}

function record(overrides: Record<string, unknown> = {}) {
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
    evidence: [{
      sourceType: 'gmail',
      sourceId: 'message-1',
      capturedAt: '2026-10-01T19:58:34Z',
      factPaths: ['contactDate','contactType','contactMethod','employerName','websiteUrl','workType','jobTitle','referenceNumber','result']
    }],
    verificationStatus: 'verified',
    ...overrides
  };
}

describe('ATLAS Reconnect session-local store', () => {
  test('imports valid canonical JSON and exposes validated ready counts', async () => {
    const { session } = await loadSession();
    const store = session.createSessionStore();

    const result = store.importRecords(JSON.stringify([record()]));
    const snapshot = store.getSnapshot();

    expect(result.ok).toBe(true);
    expect(snapshot.records).toHaveLength(1);
    expect(snapshot.readyCount).toBe(1);
    expect(snapshot.records[0].status).toBe('verified');
  });

  test('rejects malformed JSON and unknown top-level shapes without retaining prior input', async () => {
    const { session } = await loadSession();
    const store = session.createSessionStore();

    expect(store.importRecords('{broken').ok).toBe(false);
    expect(store.getSnapshot().records).toEqual([]);

    expect(store.importRecords(JSON.stringify({ contacts: [record()] })).ok).toBe(false);
    expect(store.getSnapshot().records).toEqual([]);
  });

  test('excludes duplicate and outside-week records from ready count', async () => {
    const { session } = await loadSession();
    const store = session.createSessionStore();
    const duplicate = record({ id: 'ws-2' });
    const outside = record({ id: 'ws-3', contactDate: '2026-10-04' });

    const result = store.importRecords(JSON.stringify([record(), duplicate, outside]));
    const snapshot = store.getSnapshot();

    expect(result.ok).toBe(true);
    expect(snapshot.records.map((entry: any) => entry.status)).toEqual(['verified', 'duplicate', 'outside_week']);
    expect(snapshot.readyCount).toBe(1);
  });

  test('clearSession removes records and diagnostics but does not mutate browser page data', async () => {
    const { session } = await loadSession();
    const store = session.createSessionStore();
    document.body.innerHTML = '<input id="employerName" value="User typed value">';
    store.importRecords(JSON.stringify([record()]));
    store.addDiagnostic({ level: 'info', message: 'test' });

    store.clearSession();

    expect(store.getSnapshot()).toEqual({ records: [], readyCount: 0, diagnostics: [] });
    expect((document.getElementById('employerName') as HTMLInputElement).value).toBe('User typed value');
  });

  test('rejects credential, MFA, SSN, bank, or security-answer fields instead of persisting them', async () => {
    const { session } = await loadSession();
    const store = session.createSessionStore();
    const sensitiveVariants = [
      { password: 'secret' },
      { mfaCode: '123456' },
      { ssn: '000-00-0000' },
      { bankAccount: '1234' },
      { securityAnswer: 'answer' }
    ];

    for (const extra of sensitiveVariants) {
      const result = store.importRecords(JSON.stringify([{ ...record(), ...extra }]));
      expect(result.ok).toBe(false);
      expect(store.getSnapshot().records).toEqual([]);
      expect(JSON.stringify(store.getSnapshot())).not.toContain(Object.values(extra)[0]);
    }
  });

  test('defines only bounded extension message types and no submit/certify command', async () => {
    const { messages } = await loadSession();
    expect(messages.RECONNECT_MESSAGE_TYPES).toEqual([
      'ATLAS_RECONNECT_STATUS',
      'ATLAS_RECONNECT_FILL_CURRENT',
      'ATLAS_RECONNECT_FILL_VERIFIED',
      'ATLAS_RECONNECT_CLEAR_REVIEW'
    ]);
    expect(messages.RECONNECT_MESSAGE_TYPES.join(' ').toLowerCase()).not.toMatch(/submit|certify|acknowledge/);
  });
});
