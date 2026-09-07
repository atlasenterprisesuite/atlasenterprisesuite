import { getPublishDestination } from './destinations';
import { fingerprintDraft } from './fingerprint';
import type { PermissionAdapter } from './permissions';
import { requirePermission } from './permissions';
import type { ConnectStore, ConnectStoreState } from './storage';
import { transitionPublication } from './state';
import type {
  PublicationAuditEvent,
  PublicationReceipt,
  PublishAttachment,
  PublishContentType,
  PublishDraft,
  PublishDestination
} from './types';
import { validateDraftForDestination } from './validation';

export interface SaveDraftInput {
  title: string;
  body: string;
  link: string | null;
  contentType: PublishContentType;
  attachment: PublishAttachment | null;
  destinationId: string;
}

export interface PublicationServiceOptions {
  store: ConnectStore;
  permissions: PermissionAdapter;
  actor: string;
  now: () => string;
}

function replaceDraft(state: ConnectStoreState, draft: PublishDraft): ConnectStoreState {
  return {
    ...state,
    drafts: state.drafts.map((item) => item.id === draft.id ? draft : item)
  };
}

function requireDraft(state: ConnectStoreState, id: string): PublishDraft {
  const draft = state.drafts.find((item) => item.id === id);
  if (!draft) throw new Error(`Publication draft not found: ${id}`);
  return draft;
}

function requireDestination(draft: PublishDraft): PublishDestination {
  const destination = getPublishDestination(draft.destinationId);
  if (!destination) throw new Error(`Publish destination not found: ${draft.destinationId}`);
  return destination;
}

export function createPublicationService({ store, permissions, actor, now }: PublicationServiceOptions) {
  function appendAudit(
    state: ConnectStoreState,
    event: Omit<PublicationAuditEvent, 'id'>
  ): ConnectStoreState {
    const auditEvent: PublicationAuditEvent = {
      id: `audit-${state.auditEvents.length + 1}`,
      ...event
    };
    return { ...state, auditEvents: [...state.auditEvents, auditEvent] };
  }

  function saveDraft(input: SaveDraftInput): PublishDraft {
    requirePermission(permissions, 'studio.draft.create');
    const state = store.read();
    const timestamp = now();
    const draft: PublishDraft = {
      id: `draft-${state.drafts.length + 1}`,
      ...input,
      status: 'draft',
      fingerprint: null,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    let nextState: ConnectStoreState = { ...state, drafts: [...state.drafts, draft] };
    const destination = getPublishDestination(draft.destinationId);
    nextState = appendAudit(nextState, {
      publicationId: draft.id,
      destinationId: draft.destinationId,
      capability: destination?.capability ?? 'unavailable',
      fingerprint: null,
      action: 'draft_saved',
      actor,
      timestamp,
      outcome: 'success',
      verification: null,
      providerReference: null,
      error: null
    });
    store.write(nextState);
    return draft;
  }

  function markReady(id: string): PublishDraft {
    requirePermission(permissions, 'connect.publish.request');
    let state = store.read();
    const current = requireDraft(state, id);
    const destination = requireDestination(current);
    const validation = validateDraftForDestination(current, destination);
    if (!validation.valid) throw new Error(validation.errors.join(' '));

    const fingerprint = fingerprintDraft(current);
    const updated: PublishDraft = {
      ...current,
      status: transitionPublication(current.status, 'mark_ready'),
      fingerprint,
      updatedAt: now()
    };
    state = replaceDraft(state, updated);
    state = appendAudit(state, {
      publicationId: updated.id,
      destinationId: destination.id,
      capability: destination.capability,
      fingerprint,
      action: 'marked_ready',
      actor,
      timestamp: updated.updatedAt,
      outcome: 'success',
      verification: null,
      providerReference: null,
      error: null
    });
    store.write(state);
    return updated;
  }

  function startManualHandoff(id: string): PublishDraft {
    requirePermission(permissions, 'connect.publish.request');
    let state = store.read();
    const current = requireDraft(state, id);
    const destination = requireDestination(current);
    if (destination.capability !== 'manual_handoff') {
      throw new Error(`Destination does not support manual handoff: ${destination.id}`);
    }
    if (!destination.publicUrl) {
      throw new Error(`Destination has no public handoff URL: ${destination.id}`);
    }

    const updated: PublishDraft = {
      ...current,
      status: transitionPublication(current.status, 'start_manual_handoff'),
      updatedAt: now()
    };
    state = replaceDraft(state, updated);
    state = appendAudit(state, {
      publicationId: updated.id,
      destinationId: destination.id,
      capability: destination.capability,
      fingerprint: updated.fingerprint,
      action: 'handoff_started',
      actor,
      timestamp: updated.updatedAt,
      outcome: 'success',
      verification: null,
      providerReference: null,
      error: null
    });
    store.write(state);
    return updated;
  }

  function confirmManualPublication(id: string, providerReference: string | null = null): PublishDraft {
    requirePermission(permissions, 'connect.publish.confirm_manual');
    let state = store.read();
    const current = requireDraft(state, id);
    const destination = requireDestination(current);
    if (!current.fingerprint) throw new Error('Publication fingerprint is missing');

    const timestamp = now();
    const updated: PublishDraft = {
      ...current,
      status: transitionPublication(current.status, 'confirm_manual_publish'),
      updatedAt: timestamp
    };
    const receipt: PublicationReceipt = {
      id: `receipt-${state.receipts.length + 1}`,
      publicationId: updated.id,
      destinationId: destination.id,
      verification: 'manual_confirmation',
      fingerprint: current.fingerprint,
      actor,
      createdAt: timestamp,
      providerReference: providerReference?.trim() || null
    };

    state = replaceDraft(state, updated);
    state = { ...state, receipts: [...state.receipts, receipt] };
    state = appendAudit(state, {
      publicationId: updated.id,
      destinationId: destination.id,
      capability: destination.capability,
      fingerprint: current.fingerprint,
      action: 'manual_publish_confirmed',
      actor,
      timestamp,
      outcome: 'success',
      verification: 'manual_confirmation',
      providerReference: receipt.providerReference,
      error: null
    });
    store.write(state);
    return updated;
  }

  function startProviderPublish(): never {
    throw new Error('Automated provider publishing is not configured');
  }

  return {
    saveDraft,
    markReady,
    startManualHandoff,
    confirmManualPublication,
    startProviderPublish,
    getDraft(id: string): PublishDraft | null {
      return store.read().drafts.find((item) => item.id === id) ?? null;
    },
    listPublications(): PublishDraft[] {
      return store.read().drafts;
    },
    listReceipts(): PublicationReceipt[] {
      return store.read().receipts;
    },
    listAuditEvents(): PublicationAuditEvent[] {
      return store.read().auditEvents;
    }
  };
}
