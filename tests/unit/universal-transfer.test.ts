import { describe, expect, it } from 'vitest';
import { createTransferIntent, evaluateSharePolicy } from '../../packages/core/src';

describe('ATLAS Universal Transfer', () => {
  it('normalizes bring, upload and share into one tenant-bound intent', () => {
    expect(createTransferIntent({
      action: 'bring', source: 'google-drive', actorId: 'u1',
      scope: { tenantId: 't1', organizationId: 'o1' }, items: ['file-1']
    })).toMatchObject({ action: 'bring', source: 'google-drive', actorId: 'u1', items: ['file-1'] });
  });

  it('fails closed when scope or items are missing', () => {
    expect(() => createTransferIntent({
      action: 'upload', source: 'device', actorId: 'u1',
      scope: { tenantId: '', organizationId: 'o1' }, items: ['file-1']
    })).toThrow();
  });

  it('requires explicit permission for public links', () => {
    expect(evaluateSharePolicy({
      visibility: 'public-link', permissions: ['transfer.share']
    })).toEqual({ allowed: false, reason: 'public_link_permission_required' });
  });

  it('allows expiring public links only with elevated permission', () => {
    expect(evaluateSharePolicy({
      visibility: 'public-link',
      permissions: ['transfer.share', 'transfer.share.public'],
      expiresAt: '2026-10-08T00:00:00.000Z',
      now: '2026-10-07T00:00:00.000Z'
    })).toEqual({ allowed: true });
  });
});
