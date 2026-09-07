import { beforeEach, describe, expect, it } from 'vitest';
import { ATLAS_NEWS_WHATSAPP_CHANNEL } from '../../packages/connect/destinations';
import { createDevelopmentPermissionAdapter } from '../../packages/connect/permissions';
import { createPublicationService } from '../../packages/connect/service';
import { BrowserConnectStore, MemoryConnectStore } from '../../packages/connect/storage';
import type { ConnectStoreState } from '../../packages/connect/storage';

const now = () => '2026-09-06T20:45:00-04:00';

beforeEach(() => localStorage.clear());

describe('ATLAS Connect persistence and service', () => {
  it('does not mark a handoff as published until explicit confirmation', () => {
    const store = new MemoryConnectStore();
    const service = createPublicationService({
      store,
      permissions: createDevelopmentPermissionAdapter(),
      actor: 'development-user',
      now
    });

    const saved = service.saveDraft({
      title: 'News',
      body: 'Update',
      link: null,
      contentType: 'text',
      attachment: null,
      destinationId: ATLAS_NEWS_WHATSAPP_CHANNEL.id
    });
    const ready = service.markReady(saved.id);
    const handoff = service.startManualHandoff(ready.id);

    expect(handoff.status).toBe('awaiting_manual_publish');
    expect(service.listReceipts()).toHaveLength(0);

    const published = service.confirmManualPublication(handoff.id, 'wa-update-reference');
    expect(published.status).toBe('published');
    expect(service.listReceipts()).toHaveLength(1);
    expect(service.listReceipts()[0].verification).toBe('manual_confirmation');
    expect(service.listReceipts()[0].fingerprint).toBe(ready.fingerprint);
  });

  it('records handoff_started separately from manual_publish_confirmed', () => {
    const store = new MemoryConnectStore();
    const service = createPublicationService({
      store,
      permissions: createDevelopmentPermissionAdapter(),
      actor: 'development-user',
      now
    });

    const draft = service.saveDraft({
      title: 'A',
      body: 'B',
      link: null,
      contentType: 'text',
      attachment: null,
      destinationId: ATLAS_NEWS_WHATSAPP_CHANNEL.id
    });
    service.startManualHandoff(service.markReady(draft.id).id);

    const actions = service.listAuditEvents().map((event) => event.action);
    expect(actions).toContain('handoff_started');
    expect(actions).not.toContain('manual_publish_confirmed');
  });

  it('round-trips versioned browser-local state', () => {
    const store = new BrowserConnectStore(localStorage);
    const initial = store.read();
    expect(initial).toEqual({ schemaVersion: 1, drafts: [], receipts: [], auditEvents: [] });
    store.write(initial);
    expect(new BrowserConnectStore(localStorage).read()).toEqual(initial);
  });

  it('rejects sensitive material before browser persistence', () => {
    const store = new BrowserConnectStore(localStorage);
    const unsafe = {
      schemaVersion: 1,
      drafts: [],
      receipts: [],
      auditEvents: [],
      accessToken: 'must-not-persist'
    } as unknown as ConnectStoreState;

    expect(() => store.write(unsafe)).toThrow(/sensitive material/i);
    expect(localStorage.getItem('atlas.connect.dev.v1')).toBeNull();
  });
});
