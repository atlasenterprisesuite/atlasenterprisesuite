import { createSessionStore } from './core/session';
import type { ReconnectExtensionResponse } from './core/messages';
import type { WorkSearchRecord } from './core/types';

export interface PopupBridge {
  fillRecord(record: WorkSearchRecord): Promise<ReconnectExtensionResponse>;
  fillRecords(records: WorkSearchRecord[]): Promise<ReconnectExtensionResponse>;
  clearReview(): Promise<ReconnectExtensionResponse>;
}

type Store = ReturnType<typeof createSessionStore>;

function requiredElement<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const element = root.querySelector<T>(selector);
  if (!element) throw new Error(`Missing popup element: ${selector}`);
  return element;
}

function setStatus(root: HTMLElement, message: string, state: string): void {
  const status = requiredElement<HTMLElement>(root, '#popupStatus');
  status.textContent = message;
  status.setAttribute('data-state', state);
}

function render(root: HTMLElement, store: Store): void {
  const snapshot = store.getSnapshot();
  const list = requiredElement<HTMLElement>(root, '#recordList');
  const claimWeek = requiredElement<HTMLElement>(root, '#claimWeek');
  const summary = requiredElement<HTMLElement>(root, '#summary');
  const fillCurrent = requiredElement<HTMLButtonElement>(root, '#fillCurrent');
  const fillVerified = requiredElement<HTMLButtonElement>(root, '#fillVerified');

  list.replaceChildren();
  const first = snapshot.records[0]?.record;
  claimWeek.textContent = first ? `Claim Week: ${first.claimWeekStart} – ${first.claimWeekEnd}` : '';
  summary.textContent = snapshot.records.length ? `${snapshot.readyCount} ready of ${snapshot.records.length} record(s)` : '';

  for (const entry of snapshot.records) {
    const card = document.createElement('article');
    card.className = 'record-card';
    card.setAttribute('data-state', entry.status);
    const evidenceCount = entry.record.evidence?.length ?? 0;
    card.textContent = `${entry.status.toUpperCase()} — ${entry.record.employerName} — ${entry.record.jobTitle ?? entry.record.referenceNumber ?? 'Position not provided'} — ${evidenceCount} evidence${evidenceCount === 1 ? '' : 's'}`;
    if (entry.issues.length) {
      const issues = document.createElement('div');
      issues.className = 'record-issues';
      issues.textContent = `Needs review: ${entry.issues.join(', ')}`;
      card.append(issues);
    }
    list.append(card);
  }

  fillCurrent.disabled = snapshot.readyCount === 0;
  fillVerified.disabled = snapshot.readyCount === 0;
}

function readyRecords(store: Store): WorkSearchRecord[] {
  return store.getSnapshot().records.filter((entry) => entry.ready).map((entry) => entry.record);
}

export function mountReconnectPopup(root: HTMLElement, store: Store, bridge: PopupBridge): void {
  const jsonInput = requiredElement<HTMLTextAreaElement>(root, '#recordsJson');
  const importButton = requiredElement<HTMLButtonElement>(root, '#importRecords');
  const fillCurrent = requiredElement<HTMLButtonElement>(root, '#fillCurrent');
  const fillVerified = requiredElement<HTMLButtonElement>(root, '#fillVerified');
  const clearSession = requiredElement<HTMLButtonElement>(root, '#clearSession');
  const status = requiredElement<HTMLElement>(root, '#popupStatus');

  render(root, store);
  setStatus(root, 'Import verified work-search records to begin.', 'empty');

  importButton.addEventListener('click', () => {
    setStatus(root, 'Validating imported records…', 'loading');
    const result = store.importRecords(jsonInput.value);
    render(root, store);
    if (!result.ok) {
      setStatus(root, `Could not import records: ${result.error ?? 'invalid data'}.`, 'error');
      return;
    }
    const hasPartial = result.snapshot.records.some((entry) => !entry.ready);
    setStatus(
      root,
      hasPartial
        ? `Imported with review required. ${result.snapshot.readyCount} record(s) ready.`
        : `${result.snapshot.readyCount} verified record(s) ready to fill.`,
      hasPartial ? 'partial' : 'verified'
    );
  });

  fillCurrent.addEventListener('click', async () => {
    const [record] = readyRecords(store);
    if (!record) return;
    setStatus(root, 'Filling current verified record…', 'loading');
    const response = await bridge.fillRecord(record);
    setStatus(root, response.ok ? 'Current record filled. Review the Reconnect page before continuing.' : `Blocked: ${response.reason}`, response.ok ? 'filled' : 'blocked');
    status.focus({ preventScroll: true });
  });

  fillVerified.addEventListener('click', async () => {
    const records = readyRecords(store);
    if (!records.length) return;
    setStatus(root, 'Filling the current form from verified records…', 'loading');
    const response = await bridge.fillRecords(records);
    setStatus(root, response.ok ? 'Verified record filled. Review Reconnect; remaining records require another Add Work Search form.' : `Blocked: ${response.reason}`, response.ok ? 'filled' : 'blocked');
    status.focus({ preventScroll: true });
  });

  clearSession.addEventListener('click', async () => {
    store.clearSession();
    jsonInput.value = '';
    render(root, store);
    await bridge.clearReview();
    setStatus(root, 'Session data cleared. Reconnect page data was not changed.', 'empty');
    status.focus({ preventScroll: true });
  });
}

type ChromeTabsApi = {
  query(query: { active: boolean; currentWindow: boolean }, callback: (tabs: Array<{ id?: number }>) => void): void;
  sendMessage(tabId: number, message: unknown, callback: (response: ReconnectExtensionResponse) => void): void;
};

function createChromeBridge(): PopupBridge {
  const chromeTabs = (globalThis as unknown as { chrome?: { tabs?: ChromeTabsApi } }).chrome?.tabs;

  function send(message: unknown): Promise<ReconnectExtensionResponse> {
    if (!chromeTabs) return Promise.resolve({ ok: false, status: 'error', reason: 'browser_api_unavailable' });
    return new Promise((resolve) => {
      chromeTabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tabId = tabs[0]?.id;
        if (typeof tabId !== 'number') {
          resolve({ ok: false, status: 'error', reason: 'active_tab_unavailable' });
          return;
        }
        chromeTabs.sendMessage(tabId, message, (response) => resolve(response ?? { ok: false, status: 'error', reason: 'no_content_response' }));
      });
    });
  }

  return {
    fillRecord: (record) => send({ type: 'ATLAS_RECONNECT_FILL_CURRENT', record }),
    fillRecords: (records) => send({ type: 'ATLAS_RECONNECT_FILL_VERIFIED', records }),
    clearReview: () => send({ type: 'ATLAS_RECONNECT_CLEAR_REVIEW' })
  };
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', () => {
    const root = document.getElementById('atlas-reconnect-app');
    if (root) mountReconnectPopup(root, createSessionStore(), createChromeBridge());
  });
}
