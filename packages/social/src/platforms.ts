export type MediaKind = 'image' | 'video';

export type PlatformId = 'instagram' | 'facebook' | 'x' | 'linkedin' | 'tiktok' | 'youtube';
export type ProviderConnectionState = 'not_configured' | 'ready' | 'unavailable';

export type SocialFormat = {
  id: string;
  label: string;
  aspectRatio: string;
  width: number;
  height: number;
  media: readonly MediaKind[];
  maxFiles: number;
};

export type PlatformDefinition = {
  id: PlatformId;
  name: string;
  connectionStatus: ProviderConnectionState;
  formats: readonly SocialFormat[];
};

export const socialPlatforms: readonly PlatformDefinition[] = [
  {
    id: 'instagram', name: 'Instagram', connectionStatus: 'not_configured',
    formats: [
      { id: 'feed-portrait', label: 'Feed portrait', aspectRatio: '4:5', width: 1080, height: 1350, media: ['image', 'video'], maxFiles: 10 },
      { id: 'square', label: 'Square post', aspectRatio: '1:1', width: 1080, height: 1080, media: ['image', 'video'], maxFiles: 10 },
      { id: 'story-reel', label: 'Story / Reel', aspectRatio: '9:16', width: 1080, height: 1920, media: ['image', 'video'], maxFiles: 1 }
    ]
  },
  {
    id: 'facebook', name: 'Facebook', connectionStatus: 'not_configured',
    formats: [
      { id: 'feed', label: 'Feed', aspectRatio: '4:5', width: 1080, height: 1350, media: ['image', 'video'], maxFiles: 10 },
      { id: 'landscape', label: 'Landscape', aspectRatio: '1.91:1', width: 1200, height: 628, media: ['image', 'video'], maxFiles: 10 },
      { id: 'story-reel', label: 'Story / Reel', aspectRatio: '9:16', width: 1080, height: 1920, media: ['image', 'video'], maxFiles: 1 }
    ]
  },
  {
    id: 'x', name: 'X', connectionStatus: 'not_configured',
    formats: [
      { id: 'single-landscape', label: 'Single landscape', aspectRatio: '16:9', width: 1600, height: 900, media: ['image', 'video'], maxFiles: 1 },
      { id: 'single-square', label: 'Single square', aspectRatio: '1:1', width: 1200, height: 1200, media: ['image', 'video'], maxFiles: 1 },
      { id: 'multi', label: 'Multi-image', aspectRatio: '1:1', width: 1200, height: 1200, media: ['image'], maxFiles: 4 }
    ]
  },
  {
    id: 'linkedin', name: 'LinkedIn', connectionStatus: 'not_configured',
    formats: [
      { id: 'portrait', label: 'Portrait post', aspectRatio: '4:5', width: 1200, height: 1500, media: ['image'], maxFiles: 9 },
      { id: 'landscape', label: 'Landscape post', aspectRatio: '1.91:1', width: 1200, height: 627, media: ['image', 'video'], maxFiles: 9 },
      { id: 'square', label: 'Square post', aspectRatio: '1:1', width: 1200, height: 1200, media: ['image', 'video'], maxFiles: 9 }
    ]
  },
  {
    id: 'tiktok', name: 'TikTok', connectionStatus: 'not_configured',
    formats: [
      { id: 'vertical-video', label: 'Vertical video', aspectRatio: '9:16', width: 1080, height: 1920, media: ['video'], maxFiles: 1 },
      { id: 'photo-post', label: 'Photo post', aspectRatio: '9:16', width: 1080, height: 1920, media: ['image'], maxFiles: 35 }
    ]
  },
  {
    id: 'youtube', name: 'YouTube', connectionStatus: 'not_configured',
    formats: [
      { id: 'video', label: 'Video', aspectRatio: '16:9', width: 1920, height: 1080, media: ['video'], maxFiles: 1 },
      { id: 'short', label: 'Short', aspectRatio: '9:16', width: 1080, height: 1920, media: ['video'], maxFiles: 1 },
      { id: 'community', label: 'Community post', aspectRatio: '1:1', width: 1080, height: 1080, media: ['image'], maxFiles: 5 }
    ]
  }
];

export function getPlatform(id: PlatformId): PlatformDefinition {
  const platform = socialPlatforms.find((item) => item.id === id);
  if (!platform) throw new Error(`Unknown social platform: ${id}`);
  return platform;
}

export function validateMedia(files: readonly Pick<File, 'type'>[], format: SocialFormat): string[] {
  const errors: string[] = [];
  if (files.length > format.maxFiles) errors.push(`This format accepts up to ${format.maxFiles} file(s).`);
  for (const file of files) {
    const kind: MediaKind | null = file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : null;
    if (!kind || !format.media.includes(kind)) errors.push(`${file.type || 'Unknown file'} is not supported for ${format.label}.`);
  }
  return errors;
}
