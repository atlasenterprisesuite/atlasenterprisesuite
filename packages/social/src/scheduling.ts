import type { PlatformConnectionStatus, PlatformId } from './platforms';

export type SocialScheduleStatus =
  | 'draft'
  | 'scheduled'
  | 'blocked_connection'
  | 'ready'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export type SocialScheduledPost = {
  id: string;
  organizationId: string;
  platform: PlatformId;
  caption: string;
  scheduledFor: string;
  status: SocialScheduleStatus;
  providerConnectionState: PlatformConnectionStatus;
  mediaManifest: Array<Record<string, unknown>>;
  lastErrorCode: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SocialScheduleInput = {
  platform: PlatformId;
  caption: string;
  scheduledFor: string;
};

export function validateSocialScheduleInput(
  input: SocialScheduleInput,
  now = Date.now()
): string[] {
  const errors: string[] = [];
  if (!input.caption.trim()) errors.push('Caption is required.');
  const scheduled = Date.parse(input.scheduledFor);
  if (!Number.isFinite(scheduled)) errors.push('Scheduled time must be valid.');
  else if (scheduled <= now) errors.push('Scheduled time must be in the future.');
  return errors;
}

export function initialScheduleStatus(
  connectionState: PlatformConnectionStatus
): SocialScheduleStatus {
  return connectionState === 'ready' ? 'scheduled' : 'blocked_connection';
}
