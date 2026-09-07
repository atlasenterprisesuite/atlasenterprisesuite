import type { PublicationAuditEvent, PublicationReceipt, PublishDraft } from './types';

export interface ConnectStoreState {
  schemaVersion: 1;
  drafts: PublishDraft[];
  receipts: PublicationReceipt[];
  auditEvents: PublicationAuditEvent[];
}

export interface ConnectStore {
  read(): ConnectStoreState;
  write(state: ConnectStoreState): void;
}

export const CONNECT_DEV_STORAGE_KEY = 'atlas.connect.dev.v1';

const sensitiveKeyPattern = /(token|password|cookie|secret|session|authorization|credential)/i;

function emptyState(): ConnectStoreState {
  return { schemaVersion: 1, drafts: [], receipts: [], auditEvents: [] };
}

function cloneState(state: ConnectStoreState): ConnectStoreState {
  return JSON.parse(JSON.stringify(state)) as ConnectStoreState;
}

function containsSensitiveKey(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(containsSensitiveKey);
  if (!value || typeof value !== 'object') return false;

  return Object.entries(value as Record<string, unknown>).some(([key, nested]) => {
    return sensitiveKeyPattern.test(key) || containsSensitiveKey(nested);
  });
}

function isConnectStoreState(value: unknown): value is ConnectStoreState {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<ConnectStoreState>;
  return candidate.schemaVersion === 1
    && Array.isArray(candidate.drafts)
    && Array.isArray(candidate.receipts)
    && Array.isArray(candidate.auditEvents);
}

export class MemoryConnectStore implements ConnectStore {
  private state: ConnectStoreState;

  constructor(initialState: ConnectStoreState = emptyState()) {
    this.state = cloneState(initialState);
  }

  read(): ConnectStoreState {
    return cloneState(this.state);
  }

  write(state: ConnectStoreState): void {
    if (containsSensitiveKey(state)) {
      throw new Error('Sensitive material is not allowed in ATLAS Connect development storage');
    }
    this.state = cloneState(state);
  }
}

export class BrowserConnectStore implements ConnectStore {
  constructor(private readonly storage: Storage) {}

  read(): ConnectStoreState {
    const raw = this.storage.getItem(CONNECT_DEV_STORAGE_KEY);
    if (!raw) return emptyState();

    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isConnectStoreState(parsed) || containsSensitiveKey(parsed)) {
        return emptyState();
      }
      return cloneState(parsed);
    } catch {
      return emptyState();
    }
  }

  write(state: ConnectStoreState): void {
    if (containsSensitiveKey(state)) {
      throw new Error('Sensitive material is not allowed in ATLAS Connect development storage');
    }
    this.storage.setItem(CONNECT_DEV_STORAGE_KEY, JSON.stringify(cloneState(state)));
  }
}
