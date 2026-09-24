import type { PlatformId } from './platforms';

export type SocialInboxStatus = 'open' | 'waiting' | 'resolved';
export type SocialInboxSource = 'imported' | 'provider';

export type SocialInboxThread = {
  id: string;
  organizationId: string;
  platform: PlatformId;
  externalThreadId: string | null;
  contactName: string;
  handle: string | null;
  preview: string;
  lastMessageAt: string;
  unreadCount: number;
  status: SocialInboxStatus;
  source: SocialInboxSource;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type SocialCrmObjectType = 'contact' | 'deal' | 'ticket';

export type SocialCrmHandoff = {
  source: 'atlas-social';
  threadId: string;
  platform: PlatformId;
  contactName: string;
  handle: string | null;
  preview: string;
  receivedAt: string;
  suggestedObjectType: SocialCrmObjectType;
};

export function filterSocialInbox(
  threads: readonly SocialInboxThread[],
  filters: { platform?: PlatformId | 'all'; status?: SocialInboxStatus | 'all'; query?: string }
): SocialInboxThread[] {
  const query = filters.query?.trim().toLowerCase() ?? '';
  return threads.filter((thread) => {
    if (filters.platform && filters.platform !== 'all' && thread.platform !== filters.platform) return false;
    if (filters.status && filters.status !== 'all' && thread.status !== filters.status) return false;
    if (!query) return true;
    return [thread.contactName, thread.handle ?? '', thread.preview, thread.platform]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });
}

export function buildSocialCrmHandoff(
  thread: SocialInboxThread,
  suggestedObjectType: SocialCrmObjectType
): SocialCrmHandoff {
  return {
    source: 'atlas-social',
    threadId: thread.id,
    platform: thread.platform,
    contactName: thread.contactName,
    handle: thread.handle,
    preview: thread.preview,
    receivedAt: thread.lastMessageAt,
    suggestedObjectType
  };
}
