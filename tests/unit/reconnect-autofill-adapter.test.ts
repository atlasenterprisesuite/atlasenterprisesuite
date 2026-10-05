import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const adapterPath = '../../apps/reconnect-autofill-extension/src/reconnect/adapter';
const fieldMapPath = '../../apps/reconnect-autofill-extension/src/reconnect/field-map';

async function loadAdapter() {
  let adapter: any;
  let fieldMap: any;
  let loadError: unknown;
  try {
    adapter = await import(adapterPath);
    fieldMap = await import(fieldMapPath);
  } catch (error) {
    loadError = error;
  }
  expect(loadError, 'Reconnect destination modules must exist').toBeUndefined();
  return { adapter, fieldMap };
}

function fixture(name: string) {
  return readFileSync(resolve(process.cwd(), `tests/fixtures/reconnect/${name}.html`), 'utf8');
}

function loadFixture(name: string) {
  document.documentElement.innerHTML = fixture(name);
  return document;
}

function record() {
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
      sourceType: 'gmail', sourceId: 'message-1', capturedAt: '2026-10-01T19:58:34Z',
      factPaths: ['contactDate','contactType','contactMethod','employerName','websiteUrl','workType','jobTitle','referenceNumber','result']
    }],
    verificationStatus: 'verified'
  };
}

describe('ATLAS Reconnect destination adapter', () => {
  beforeEach(() => {
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  test('recognizes only the official Reconnect origin and a supported work-search page', async () => {
    const { adapter } = await loadAdapter();
    const doc = loadFixture('work-search');

    expect(adapter.detectReconnectPage(doc, new URL('https://connect.myflorida.com/Claimant/Core/Login.ASPX'))).toEqual({
      supported: true,
      kind: 'work_search'
    });
    expect(adapter.detectReconnectPage(doc, new URL('https://example.com/Claimant/Core/Login.ASPX')).supported).toBe(false);
  });

  test('classifies a final certification surface as blocked', async () => {
    const { adapter } = await loadAdapter();
    const doc = loadFixture('final-certification');

    expect(adapter.detectReconnectPage(doc, new URL('https://connect.myflorida.com/Claimant/Core/Certification.ASPX'))).toEqual({
      supported: false,
      kind: 'final_certification'
    });
  });

  test('maps semantic work-search fields and reports ambiguity instead of guessing', async () => {
    const { fieldMap } = await loadAdapter();
    const good = loadFixture('work-search');
    const mapped = fieldMap.mapReconnectFields(good);
    expect(mapped.ambiguous).toEqual([]);
    expect(mapped.fields.employerName?.id).toBe('employerName');
    expect(mapped.fields.result?.id).toBe('result');

    const ambiguous = loadFixture('ambiguous-work-search');
    const result = fieldMap.mapReconnectFields(ambiguous);
    expect(result.ambiguous).toContain('employerName');
  });

  test('performs all mapping preflight before mutating any field', async () => {
    const { adapter } = await loadAdapter();
    const doc = loadFixture('ambiguous-work-search');
    const date = doc.getElementById('dateOfContact') as HTMLInputElement;

    const result = adapter.fillReconnectRecord(doc, record(), { origin: 'https://connect.myflorida.com' });

    expect(result.status).toBe('blocked');
    expect(result.reason).toBe('ambiguous_mapping');
    expect(date.value).toBe('');
  });

  test('preserves existing non-empty destination fields by default', async () => {
    const { adapter } = await loadAdapter();
    const doc = loadFixture('work-search');
    const employer = doc.getElementById('employerName') as HTMLInputElement;
    employer.value = 'Existing employer value';

    const result = adapter.fillReconnectRecord(doc, record(), { origin: 'https://connect.myflorida.com' });

    expect(result.status).toBe('filled');
    expect(employer.value).toBe('Existing employer value');
    expect(result.preserved).toContain('employerName');
  });

  test('dispatches native input/change events for inserted values', async () => {
    const { adapter } = await loadAdapter();
    const doc = loadFixture('work-search');
    const employer = doc.getElementById('employerName') as HTMLInputElement;
    const inputSpy = vi.fn();
    const changeSpy = vi.fn();
    employer.addEventListener('input', inputSpy);
    employer.addEventListener('change', changeSpy);

    adapter.fillReconnectRecord(doc, record(), { origin: 'https://connect.myflorida.com' });

    expect(employer.value).toBe('Ciera + Co.');
    expect(inputSpy).toHaveBeenCalledTimes(1);
    expect(changeSpy).toHaveBeenCalledTimes(1);
  });

  test('never activates Next, Submit, Acknowledge, or Certify controls', async () => {
    const { adapter } = await loadAdapter();
    const doc = loadFixture('work-search');
    const next = doc.getElementById('nextButton') as HTMLButtonElement;
    const clickSpy = vi.spyOn(next, 'click');

    const result = adapter.fillReconnectRecord(doc, record(), { origin: 'https://connect.myflorida.com' });

    expect(result.status).toBe('filled');
    expect(clickSpy).not.toHaveBeenCalled();

    const finalDoc = loadFixture('final-certification');
    const cert = finalDoc.getElementById('certifyButton') as HTMLButtonElement;
    const certifySpy = vi.spyOn(cert, 'click');
    const blocked = adapter.fillReconnectRecord(finalDoc, record(), { origin: 'https://connect.myflorida.com' });
    expect(blocked.status).toBe('blocked');
    expect(certifySpy).not.toHaveBeenCalled();
  });
});
