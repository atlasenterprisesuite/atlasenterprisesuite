import type { TenantScope } from './scope';

export type TransferAction = 'bring' | 'upload' | 'share';
export type TransferSource = 'device' | 'url' | 'google-drive' | 'dropbox' | 'connector' | 'atlas-drive';
export type ShareVisibility = 'private' | 'organization' | 'specific-users' | 'public-link';

export type TransferIntent = {
  action: TransferAction;
  source: TransferSource;
  actorId: string;
  scope: TenantScope;
  items: string[];
  createdAt: string;
};

export function createTransferIntent(input: Omit<TransferIntent, 'createdAt'> & { createdAt?: string }): TransferIntent {
  if (!input.actorId?.trim()) throw new Error('transfer_actor_required');
  if (!input.scope?.tenantId?.trim() || !input.scope?.organizationId?.trim()) throw new Error('transfer_scope_required');
  if (!input.items?.length || input.items.some(item => !item?.trim())) throw new Error('transfer_items_required');
  return { ...input, actorId: input.actorId.trim(), items: input.items.map(item => item.trim()), createdAt: input.createdAt ?? new Date().toISOString() };
}

export function evaluateSharePolicy(input: {
  visibility: ShareVisibility;
  permissions: readonly string[];
  expiresAt?: string;
  now?: string;
}): { allowed: true } | { allowed: false; reason: string } {
  if (!input.permissions.includes('transfer.share')) return { allowed: false, reason: 'share_permission_required' };
  if (input.visibility !== 'public-link') return { allowed: true };
  if (!input.permissions.includes('transfer.share.public')) return { allowed: false, reason: 'public_link_permission_required' };
  if (!input.expiresAt) return { allowed: false, reason: 'public_link_expiration_required' };
  const expiresAt = Date.parse(input.expiresAt);
  const now = Date.parse(input.now ?? new Date().toISOString());
  if (!Number.isFinite(expiresAt) || !Number.isFinite(now) || expiresAt <= now) return { allowed: false, reason: 'public_link_expiration_invalid' };
  return { allowed: true };
}
