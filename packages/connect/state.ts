import type { PublicationAction, PublicationStatus } from './types';

const transitions: Record<PublicationStatus, Partial<Record<PublicationAction, PublicationStatus>>> = {
  draft: { mark_ready: 'ready' },
  ready: {
    start_manual_handoff: 'awaiting_manual_publish',
    start_provider_publish: 'publishing',
    fail: 'failed'
  },
  awaiting_manual_publish: {
    confirm_manual_publish: 'published',
    fail: 'failed'
  },
  publishing: {
    provider_succeeded: 'published',
    fail: 'failed'
  },
  failed: { retry: 'ready' },
  published: {}
};

export function transitionPublication(status: PublicationStatus, action: PublicationAction): PublicationStatus {
  const next = transitions[status][action];
  if (!next) {
    throw new Error(`Invalid publication transition: ${status} -> ${action}`);
  }
  return next;
}
