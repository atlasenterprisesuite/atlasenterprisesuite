import type { PublishDestination } from './types';

export const ATLAS_NEWS_WHATSAPP_CHANNEL: PublishDestination = {
  id: 'whatsapp-channel-atlas-news',
  platform: 'whatsapp_channel',
  name: 'Atlas Enterprise Suite News',
  capability: 'manual_handoff',
  publicUrl: 'https://whatsapp.com/channel/0029VbDVlpzFcowFQpPHTR32',
  provider: 'none_verified_for_channel_publish',
  supportedContentTypes: ['text', 'link', 'image', 'video']
};

const destinations: readonly PublishDestination[] = [ATLAS_NEWS_WHATSAPP_CHANNEL];

export function listPublishDestinations(): PublishDestination[] {
  return destinations.map((destination) => ({
    ...destination,
    supportedContentTypes: [...destination.supportedContentTypes]
  }));
}

export function getPublishDestination(id: string): PublishDestination | null {
  const destination = destinations.find((item) => item.id === id);
  return destination
    ? { ...destination, supportedContentTypes: [...destination.supportedContentTypes] }
    : null;
}
