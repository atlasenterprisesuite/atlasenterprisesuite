import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test } from 'vitest';

const sessionPath = '../../apps/reconnect-autofill-extension/src/core/session';
const contentPath = '../../apps/reconnect-autofill-extension/src/content';

async function loadFlow() {
  let session: any;
  let content: any;
  let loadError: unknown;
  try {
    session = await import(sessionPath);
    content = await import(contentPath);
  } catch (error) {
    loadError = error;
  }
  expect(loadError, 'Reconnect flow modules must exist').toBeUndefined();
  return { session, content };
}

function fixture(name: string) {
  document.documentElement.innerHTML = readFileSync(resolve(process.cwd(), `tests/fixtures/reconnect/${name}.html`), 'utf8');
}

function record() {
  return {
    id: 'ws-1', claimWeekStart: '2026-09-27', claimWeekEnd: '2026-10-03', contactDate: '2026-10-01',
    contactType: 'website', contactMethod: 'online', employerName: 'Ciera + Co.', websiteUrl: 'https://www.indeed.com/',
    workType: 'Accounting', jobTitle: 'Accounting Specialist', referenceNumber: 'f325535cd06eff02',
    result: 'Application submitted / pending',
    evidence: [{ sourceType: 'gmail', sourceId: 'message-1', capturedAt: '2026-10-01T19:58:34Z',
      factPaths: ['contactDate','contactType','contactMethod','employerName','websiteUrl','workType','jobTitle','referenceNumber','result'] }],
    verificationStatus: 'verified'
  };
}

describe('ATLAS Reconnect import → validate → fill → review', () => {
  beforeEach(() => { document.documentElement.innerHTML = '<head></head><body></body>'; });

  test('fills one verified record on the safe fixture and renders a review status without advancing', async () => {
    const { session, content } = await loadFlow();
    const store = session.createSessionStore();
    const imported = store.importRecords(JSON.stringify([record()]));
    expect(imported.ok).toBe(true);
    const ready = store.getSnapshot().records.filter((entry: any) => entry.ready).map((entry: any) => entry.record);
    fixture('work-search');
    const next = document.getElementById('nextButton') as HTMLButtonElement;
    let nextClicks = 0;
    next.addEventListener('click', () => nextClicks++);

    const response = content.handleReconnectMessage(
      document,
      new URL('https://connect.myflorida.com/Claimant/Core/WorkSearch.ASPX'),
      { type: 'ATLAS_RECONNECT_FILL_CURRENT', record: ready[0] }
    );

    expect(response.ok).toBe(true);
    expect((document.getElementById('employerName') as HTMLInputElement).value).toBe('Ciera + Co.');
    expect((document.getElementById('jobTitle') as HTMLInputElement).value).toBe('Accounting Specialist');
    expect(nextClicks).toBe(0);
    const review = document.querySelector('[data-atlas-reconnect-review]') as HTMLElement;
    expect(review).not.toBeNull();
    expect(review.textContent).toMatch(/filled/i);
  });

  test('blocks final certification even when sent a verified record and renders no legal-action control', async () => {
    const { content } = await loadFlow();
    fixture('final-certification');
    const cert = document.getElementById('certifyButton') as HTMLButtonElement;
    let clicks = 0;
    cert.addEventListener('click', () => clicks++);

    const response = content.handleReconnectMessage(
      document,
      new URL('https://connect.myflorida.com/Claimant/Core/Certification.ASPX'),
      { type: 'ATLAS_RECONNECT_FILL_CURRENT', record: record() }
    );

    expect(response.ok).toBe(false);
    expect(response.status).toBe('blocked');
    expect(clicks).toBe(0);
    expect(document.querySelector('[data-atlas-reconnect-review] button')).toBeNull();
  });

  test('clear-review removes only the extension overlay, preserving work-search field values', async () => {
    const { content } = await loadFlow();
    fixture('work-search');
    const employer = document.getElementById('employerName') as HTMLInputElement;
    employer.value = 'Existing page data';
    document.body.insertAdjacentHTML('beforeend', '<div data-atlas-reconnect-review role="status">Review</div>');

    const response = content.handleReconnectMessage(
      document,
      new URL('https://connect.myflorida.com/Claimant/Core/WorkSearch.ASPX'),
      { type: 'ATLAS_RECONNECT_CLEAR_REVIEW' }
    );

    expect(response.ok).toBe(true);
    expect(document.querySelector('[data-atlas-reconnect-review]')).toBeNull();
    expect(employer.value).toBe('Existing page data');
  });
});
