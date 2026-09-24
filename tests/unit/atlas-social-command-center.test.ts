import { describe, expect, it } from 'vitest';
import { buildSocialCrmHandoff, filterSocialInbox, type SocialInboxThread } from '../../packages/social/src/inbox';
import { initialScheduleStatus, validateSocialScheduleInput } from '../../packages/social/src/scheduling';

const thread: SocialInboxThread = {
  id: '11111111-1111-4111-8111-111111111111',
  organizationId: '22222222-2222-4222-8222-222222222222',
  platform: 'instagram',
  externalThreadId: null,
  contactName: 'Ada Lovelace',
  handle: '@ada',
  preview: 'Interested in ATLAS',
  lastMessageAt: '2026-09-19T04:00:00Z',
  unreadCount: 1,
  status: 'open',
  source: 'imported',
  metadata: {},
  createdAt: '2026-09-19T04:00:00Z',
  updatedAt: '2026-09-19T04:00:00Z'
};

describe('ATLAS Social Command Center domain', () => {
  it('filters inbox records without inventing provider data', () => {
    expect(filterSocialInbox([thread], { platform: 'instagram', status: 'open', query: 'atlas' })).toEqual([thread]);
    expect(filterSocialInbox([thread], { platform: 'facebook' })).toEqual([]);
  });

  it('builds traceable CRM handoff payloads from a persisted thread', () => {
    expect(buildSocialCrmHandoff(thread, 'ticket')).toEqual({
      source: 'atlas-social',
      threadId: thread.id,
      platform: 'instagram',
      contactName: 'Ada Lovelace',
      handle: '@ada',
      preview: 'Interested in ATLAS',
      receivedAt: '2026-09-19T04:00:00Z',
      suggestedObjectType: 'ticket'
    });
  });

  it('blocks dispatch truthfully while provider authorization is missing', () => {
    expect(initialScheduleStatus('not_configured')).toBe('blocked_connection');
    expect(initialScheduleStatus('unavailable')).toBe('blocked_connection');
    expect(initialScheduleStatus('ready')).toBe('scheduled');
  });

  it('rejects past schedule times', () => {
    expect(validateSocialScheduleInput({
      platform: 'instagram',
      caption: 'ATLAS launch',
      scheduledFor: '2026-09-19T03:00:00Z'
    }, Date.parse('2026-09-19T04:00:00Z'))).toContain('Scheduled time must be in the future.');
  });
});
