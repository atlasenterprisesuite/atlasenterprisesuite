import type { SocialInboxStatus, SocialInboxThread } from '../../../../../../packages/social/src/inbox';
import type { SocialScheduledPost } from '../../../../../../packages/social/src/scheduling';
import type { PlatformId } from '../../../../../../packages/social/src/platforms';
import { authorizedAtlasFetch, getActiveAtlasOrganization } from '../../../lib/atlasSession';

async function parseJson<T>(response: Response): Promise<T> {
  const text = await response.text();
  let body: unknown = null;
  try { body = text ? JSON.parse(text) : null; } catch { body = null; }
  if (!response.ok) {
    const message = body && typeof body === 'object' && 'message' in body
      ? String((body as { message?: unknown }).message || '')
      : '';
    throw new Error(message || `social_api_failed_${response.status}`);
  }
  return body as T;
}

type InboxRow = {
  id: string;
  org_id: string;
  platform: PlatformId;
  external_thread_id: string | null;
  contact_name: string;
  handle: string | null;
  preview: string;
  last_message_at: string;
  unread_count: number;
  status: SocialInboxStatus;
  source: 'imported' | 'provider';
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

type ScheduleRow = {
  id: string;
  org_id: string;
  platform: PlatformId;
  caption: string;
  scheduled_for: string;
  status: SocialScheduledPost['status'];
  provider_connection_state: SocialScheduledPost['providerConnectionState'];
  media_manifest: Array<Record<string, unknown>> | null;
  last_error_code: string | null;
  created_at: string;
  updated_at: string;
};

function inbox(row: InboxRow): SocialInboxThread {
  return {
    id: row.id,
    organizationId: row.org_id,
    platform: row.platform,
    externalThreadId: row.external_thread_id,
    contactName: row.contact_name,
    handle: row.handle,
    preview: row.preview,
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count || 0),
    status: row.status,
    source: row.source,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function scheduled(row: ScheduleRow): SocialScheduledPost {
  return {
    id: row.id,
    organizationId: row.org_id,
    platform: row.platform,
    caption: row.caption,
    scheduledFor: row.scheduled_for,
    status: row.status,
    providerConnectionState: row.provider_connection_state,
    mediaManifest: row.media_manifest ?? [],
    lastErrorCode: row.last_error_code,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function orgFilter(orgId: string): string {
  return encodeURIComponent(`eq.${orgId}`);
}

export async function listSocialInboxThreads(): Promise<SocialInboxThread[]> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    `/rest/v1/atlas_social_inbox_threads?org_id=${orgFilter(organization.id)}&select=*&order=last_message_at.desc`,
    { method: 'GET' }
  );
  return (await parseJson<InboxRow[]>(response)).map(inbox);
}

export async function createImportedSocialThread(input: {
  platform: PlatformId;
  contactName: string;
  handle?: string;
  preview: string;
}): Promise<SocialInboxThread> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/atlas_social_inbox_threads', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      platform: input.platform,
      contact_name: input.contactName.trim(),
      handle: input.handle?.trim() || null,
      preview: input.preview.trim(),
      last_message_at: new Date().toISOString(),
      unread_count: 1,
      status: 'open',
      source: 'imported',
      metadata: { imported_by: 'atlas_social_command_center' }
    })
  });
  const rows = await parseJson<InboxRow[]>(response);
  if (!rows[0]) throw new Error('social_inbox_create_failed');
  return inbox(rows[0]);
}

export async function updateSocialThreadStatus(
  id: string,
  status: SocialInboxStatus
): Promise<SocialInboxThread> {
  const organization = await getActiveAtlasOrganization();
  const idFilter = encodeURIComponent(`eq.${id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/atlas_social_inbox_threads?id=${idFilter}&org_id=${orgFilter(organization.id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status, updated_at: new Date().toISOString() })
    }
  );
  const rows = await parseJson<InboxRow[]>(response);
  if (!rows[0]) throw new Error('social_inbox_update_failed');
  return inbox(rows[0]);
}

export async function listSocialSchedules(): Promise<SocialScheduledPost[]> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch(
    `/rest/v1/atlas_social_scheduled_posts?org_id=${orgFilter(organization.id)}&select=*&order=scheduled_for.asc`,
    { method: 'GET' }
  );
  return (await parseJson<ScheduleRow[]>(response)).map(scheduled);
}

export async function createSocialSchedule(input: {
  platform: PlatformId;
  caption: string;
  scheduledFor: string;
  status: SocialScheduledPost['status'];
  providerConnectionState: SocialScheduledPost['providerConnectionState'];
}): Promise<SocialScheduledPost> {
  const organization = await getActiveAtlasOrganization();
  const response = await authorizedAtlasFetch('/rest/v1/atlas_social_scheduled_posts', {
    method: 'POST',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      org_id: organization.id,
      platform: input.platform,
      caption: input.caption.trim(),
      scheduled_for: input.scheduledFor,
      status: input.status,
      provider_connection_state: input.providerConnectionState,
      media_manifest: []
    })
  });
  const rows = await parseJson<ScheduleRow[]>(response);
  if (!rows[0]) throw new Error('social_schedule_create_failed');
  return scheduled(rows[0]);
}

export async function cancelSocialSchedule(id: string): Promise<SocialScheduledPost> {
  const organization = await getActiveAtlasOrganization();
  const idFilter = encodeURIComponent(`eq.${id}`);
  const response = await authorizedAtlasFetch(
    `/rest/v1/atlas_social_scheduled_posts?id=${idFilter}&org_id=${orgFilter(organization.id)}`,
    {
      method: 'PATCH',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({ status: 'cancelled', updated_at: new Date().toISOString() })
    }
  );
  const rows = await parseJson<ScheduleRow[]>(response);
  if (!rows[0]) throw new Error('social_schedule_cancel_failed');
  return scheduled(rows[0]);
}
