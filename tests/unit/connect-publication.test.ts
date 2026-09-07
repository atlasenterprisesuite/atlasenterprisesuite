import { describe, expect, it } from 'vitest';
import { ATLAS_NEWS_WHATSAPP_CHANNEL, getPublishDestination } from '../../packages/connect/destinations';
import { fingerprintDraft } from '../../packages/connect/fingerprint';
import { createDevelopmentPermissionAdapter, requirePermission } from '../../packages/connect/permissions';
import { transitionPublication } from '../../packages/connect/state';
import { validateDraftForDestination } from '../../packages/connect/validation';
import type { PublishDestination, PublishDraft } from '../../packages/connect/types';

const destination: PublishDestination = {
  id: 'whatsapp-channel-atlas-news',
  platform: 'whatsapp_channel',
  name: 'Atlas Enterprise Suite News',
  capability: 'manual_handoff',
  publicUrl: 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32',
  provider: 'none_verified_for_channel_publish',
  supportedContentTypes: ['text', 'link', 'image', 'video']
};

const draft: PublishDraft = {
  id: 'draft-1',
  title: 'Launch update',
  body: 'ATLAS Connect is entering review.',
  link: 'https://atlasenterprisesuite.com',
  contentType: 'link',
  attachment: null,
  destinationId: destination.id,
  status: 'draft',
  fingerprint: null,
  createdAt: '2026-09-06T20:30:00-04:00',
  updatedAt: '2026-09-06T20:30:00-04:00'
};

describe('ATLAS Connect publication domain', () => {
  it('creates the same fingerprint for equivalent reviewed content', () => {
    expect(fingerprintDraft(draft)).toBe(fingerprintDraft({ ...draft }));
  });

  it('allows draft -> ready -> awaiting_manual_publish -> published only through explicit actions', () => {
    expect(transitionPublication('draft', 'mark_ready')).toBe('ready');
    expect(transitionPublication('ready', 'start_manual_handoff')).toBe('awaiting_manual_publish');
    expect(transitionPublication('awaiting_manual_publish', 'confirm_manual_publish')).toBe('published');
    expect(() => transitionPublication('ready', 'confirm_manual_publish')).toThrow(/invalid publication transition/i);
  });

  it('rejects empty content and accepts a valid link draft', () => {
    expect(validateDraftForDestination({ ...draft, body: '', link: null }, destination).valid).toBe(false);
    expect(validateDraftForDestination(draft, destination).valid).toBe(true);
  });

  it('registers the official channel as manual handoff only', () => {
    expect(ATLAS_NEWS_WHATSAPP_CHANNEL.publicUrl).toBe('https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32');
    expect(ATLAS_NEWS_WHATSAPP_CHANNEL.capability).toBe('manual_handoff');
    expect(ATLAS_NEWS_WHATSAPP_CHANNEL.provider).toBe('none_verified_for_channel_publish');
    expect(getPublishDestination(ATLAS_NEWS_WHATSAPP_CHANNEL.id)).toEqual(ATLAS_NEWS_WHATSAPP_CHANNEL);
  });

  it('uses an explicit permission boundary and fails closed when permission is absent', () => {
    const permissions = createDevelopmentPermissionAdapter();
    expect(permissions.has('connect.publish.request')).toBe(true);
    expect(() => requirePermission({ has: () => false }, 'connect.publish.request')).toThrow(/permission denied/i);
  });
});
