import { beforeEach, describe, expect, test, vi } from 'vitest';

const popupPath = '../../apps/reconnect-autofill-extension/src/popup';
const sessionPath = '../../apps/reconnect-autofill-extension/src/core/session';
const overlayPath = '../../apps/reconnect-autofill-extension/src/reconnect/review-overlay';

async function loadUi() {
  let popup: any;
  let session: any;
  let overlay: any;
  let loadError: unknown;
  try {
    popup = await import(popupPath);
    session = await import(sessionPath);
    overlay = await import(overlayPath);
  } catch (error) {
    loadError = error;
  }
  expect(loadError, 'Reconnect UI modules must exist').toBeUndefined();
  return { popup, session, overlay };
}

function record(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ws-1', claimWeekStart: '2026-09-27', claimWeekEnd: '2026-10-03', contactDate: '2026-10-01',
    contactType: 'website', contactMethod: 'online', employerName: 'Ciera + Co.', websiteUrl: 'https://www.indeed.com/',
    workType: 'Accounting', jobTitle: 'Accounting Specialist', referenceNumber: 'f325535cd06eff02',
    result: 'Application submitted / pending',
    evidence: [{ sourceType: 'gmail', sourceId: 'message-1', capturedAt: '2026-10-01T19:58:34Z',
      factPaths: ['contactDate','contactType','contactMethod','employerName','websiteUrl','workType','jobTitle','referenceNumber','result'] }],
    verificationStatus: 'verified', ...overrides
  };
}

function shell() {
  document.body.innerHTML = `
    <main id="atlas-reconnect-app">
      <label for="recordsJson">Evidence Records JSON</label>
      <textarea id="recordsJson"></textarea>
      <button id="importRecords" type="button">Import</button>
      <button id="fillCurrent" type="button">Fill current record</button>
      <button id="fillVerified" type="button">Fill verified contacts</button>
      <button id="clearSession" type="button">Clear Session Data</button>
      <div id="claimWeek"></div>
      <div id="summary"></div>
      <div id="recordList"></div>
      <div id="popupStatus" role="status" aria-live="polite" tabindex="-1"></div>
    </main>`;
  return document.getElementById('atlas-reconnect-app') as HTMLElement;
}

describe('ATLAS Reconnect popup and review UI', () => {
  beforeEach(() => { document.body.innerHTML = ''; });

  test('renders empty state with native accessible actions and disabled fill controls', async () => {
    const { popup, session } = await loadUi();
    const root = shell();
    const bridge = { fillRecord: vi.fn(), fillRecords: vi.fn(), clearReview: vi.fn() };

    popup.mountReconnectPopup(root, session.createSessionStore(), bridge);

    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/import verified work-search records/i);
    expect((root.querySelector('#fillCurrent') as HTMLButtonElement).disabled).toBe(true);
    expect((root.querySelector('#fillVerified') as HTMLButtonElement).disabled).toBe(true);
    expect(root.querySelectorAll('button')).toHaveLength(4);
  });

  test('imports verified and partial records, shows claim week, evidence counts and status text', async () => {
    const { popup, session } = await loadUi();
    const root = shell();
    popup.mountReconnectPopup(root, session.createSessionStore(), { fillRecord: vi.fn(), fillRecords: vi.fn(), clearReview: vi.fn() });
    const partial = record({ id: 'ws-2', telephone: '407-555-0100' });
    (root.querySelector('#recordsJson') as HTMLTextAreaElement).value = JSON.stringify([record(), partial]);

    (root.querySelector('#importRecords') as HTMLButtonElement).click();

    expect(root.querySelector('#claimWeek')?.textContent).toContain('2026-09-27');
    expect(root.querySelector('#claimWeek')?.textContent).toContain('2026-10-03');
    expect(root.querySelector('#summary')?.textContent).toMatch(/1 ready/i);
    expect(root.querySelector('#recordList')?.textContent).toContain('Ciera + Co.');
    expect(root.querySelector('#recordList')?.textContent).toMatch(/1 evidence/i);
    expect(root.querySelector('#recordList')?.textContent).toMatch(/VERIFIED/i);
    expect(root.querySelector('#recordList')?.textContent).toMatch(/PARTIAL/i);
    expect((root.querySelector('#fillCurrent') as HTMLButtonElement).disabled).toBe(false);
  });

  test('reports malformed import as an error state without enabling fill', async () => {
    const { popup, session } = await loadUi();
    const root = shell();
    popup.mountReconnectPopup(root, session.createSessionStore(), { fillRecord: vi.fn(), fillRecords: vi.fn(), clearReview: vi.fn() });
    (root.querySelector('#recordsJson') as HTMLTextAreaElement).value = '{bad';

    (root.querySelector('#importRecords') as HTMLButtonElement).click();

    expect(root.querySelector('[role="status"]')?.textContent).toMatch(/could not import/i);
    expect(root.querySelector('[role="status"]')?.getAttribute('data-state')).toBe('error');
    expect((root.querySelector('#fillCurrent') as HTMLButtonElement).disabled).toBe(true);
  });

  test('fill current and fill verified use only ready canonical records and return focus to live status', async () => {
    const { popup, session } = await loadUi();
    const root = shell();
    const bridge = {
      fillRecord: vi.fn().mockResolvedValue({ ok: true, status: 'filled' }),
      fillRecords: vi.fn().mockResolvedValue({ ok: true, status: 'filled' }),
      clearReview: vi.fn().mockResolvedValue({ ok: true, status: 'cleared' })
    };
    popup.mountReconnectPopup(root, session.createSessionStore(), bridge);
    (root.querySelector('#recordsJson') as HTMLTextAreaElement).value = JSON.stringify([record(), record({ id: 'outside', contactDate: '2026-10-04' })]);
    (root.querySelector('#importRecords') as HTMLButtonElement).click();

    (root.querySelector('#fillCurrent') as HTMLButtonElement).click();
    await Promise.resolve(); await Promise.resolve();
    expect(bridge.fillRecord).toHaveBeenCalledTimes(1);
    expect(bridge.fillRecord.mock.calls[0][0].id).toBe('ws-1');

    (root.querySelector('#fillVerified') as HTMLButtonElement).click();
    await Promise.resolve(); await Promise.resolve();
    expect(bridge.fillRecords).toHaveBeenCalledTimes(1);
    expect(bridge.fillRecords.mock.calls[0][0]).toHaveLength(1);
    expect(document.activeElement).toBe(root.querySelector('#popupStatus'));
  });

  test('clear session removes extension data and asks content script only to clear the review overlay', async () => {
    const { popup, session } = await loadUi();
    const root = shell();
    const bridge = { fillRecord: vi.fn(), fillRecords: vi.fn(), clearReview: vi.fn().mockResolvedValue({ ok: true, status: 'cleared' }) };
    const store = session.createSessionStore();
    popup.mountReconnectPopup(root, store, bridge);
    (root.querySelector('#recordsJson') as HTMLTextAreaElement).value = JSON.stringify([record()]);
    (root.querySelector('#importRecords') as HTMLButtonElement).click();

    (root.querySelector('#clearSession') as HTMLButtonElement).click();
    await Promise.resolve();

    expect(store.getSnapshot().records).toEqual([]);
    expect(bridge.clearReview).toHaveBeenCalledTimes(1);
    expect(root.querySelector('#recordList')?.textContent).toBe('');
  });

  test('review overlay exposes filled, preserved, missing and blocked states through an accessible status region', async () => {
    const { overlay } = await loadUi();
    overlay.renderReviewOverlay(document, {
      state: 'blocked',
      filled: ['contactDate'],
      preserved: ['employerName'],
      missing: ['telephone'],
      reason: 'mapping_changed'
    });

    const region = document.querySelector('[data-atlas-reconnect-review]') as HTMLElement;
    expect(region.getAttribute('role')).toBe('status');
    expect(region.getAttribute('aria-live')).toBe('polite');
    expect(region.textContent).toMatch(/blocked/i);
    expect(region.textContent).toContain('contactDate');
    expect(region.textContent).toContain('employerName');
    expect(region.textContent).toContain('telephone');
    expect(region.querySelector('button')).toBeNull();
  });
});
