export type YouTubeVideoMetadata = {
  title: string;
  description?: string;
  publishAt?: string;
  categoryId?: string;
};

export type YouTubeUploadInput = {
  accessToken: string;
  media: Blob;
  metadata: YouTubeVideoMetadata;
  fetchImpl?: typeof fetch;
};

export type YouTubeProviderVideoState = {
  id: string;
  privacyStatus: string;
  uploadStatus: string;
  publishAt: string | null;
};

const API_ROOT = 'https://www.googleapis.com/youtube/v3';
const UPLOAD_ROOT = 'https://www.googleapis.com/upload/youtube/v3';
const DATE_WITH_ZONE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

function required(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function validatePublishAt(value: string | undefined): string | undefined {
  if (value === undefined) return undefined;
  const normalized = value.trim();
  if (!DATE_WITH_ZONE.test(normalized) || !Number.isFinite(Date.parse(normalized))) {
    throw new Error('YouTube publishAt must be RFC3339 with timezone');
  }
  return normalized;
}

async function safeJson(response: Response): Promise<Record<string, unknown>> {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export async function initiateYouTubeResumableUpload(input: {
  accessToken: string;
  mediaType: string;
  mediaSize: number;
  metadata: YouTubeVideoMetadata;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  const accessToken = required(input.accessToken, 'YouTube access token');
  const title = required(input.metadata.title, 'YouTube title');
  if (!Number.isSafeInteger(input.mediaSize) || input.mediaSize <= 0) {
    throw new Error('YouTube media size must be positive');
  }
  const mediaType = required(input.mediaType, 'YouTube media MIME type');
  const publishAt = validatePublishAt(input.metadata.publishAt);

  const url = new URL(`${UPLOAD_ROOT}/videos`);
  url.searchParams.set('part', 'snippet,status');
  url.searchParams.set('uploadType', 'resumable');

  const body = {
    snippet: {
      title,
      description: input.metadata.description?.trim() ?? '',
      ...(input.metadata.categoryId?.trim()
        ? { categoryId: input.metadata.categoryId.trim() }
        : {}),
    },
    status: {
      privacyStatus: 'private',
      ...(publishAt ? { publishAt } : {}),
    },
  };

  const response = await (input.fetchImpl ?? fetch)(url.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json; charset=utf-8',
      'X-Upload-Content-Type': mediaType,
      'X-Upload-Content-Length': String(input.mediaSize),
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) throw new Error('YouTube resumable upload initialization failed');
  const location = response.headers.get('Location')?.trim() ?? '';
  if (!location.startsWith('https://')) {
    throw new Error('YouTube resumable upload location missing');
  }
  return location;
}

export async function uploadYouTubeVideo(input: YouTubeUploadInput): Promise<{ videoId: string }> {
  const accessToken = required(input.accessToken, 'YouTube access token');
  if (!(input.media instanceof Blob) || input.media.size <= 0) {
    throw new Error('YouTube media payload is required');
  }

  const uploadUrl = await initiateYouTubeResumableUpload({
    accessToken,
    mediaType: input.media.type || 'application/octet-stream',
    mediaSize: input.media.size,
    metadata: input.metadata,
    fetchImpl: input.fetchImpl,
  });

  const response = await (input.fetchImpl ?? fetch)(uploadUrl, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': input.media.type || 'application/octet-stream',
      'Content-Length': String(input.media.size),
    },
    body: input.media,
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error('YouTube media upload failed');
  const videoId = typeof body.id === 'string' ? body.id.trim() : '';
  if (!videoId) throw new Error('YouTube upload did not return a video ID');
  return { videoId };
}

export async function getYouTubeVideoState(input: {
  accessToken: string;
  videoId: string;
  fetchImpl?: typeof fetch;
}): Promise<YouTubeProviderVideoState> {
  const accessToken = required(input.accessToken, 'YouTube access token');
  const videoId = required(input.videoId, 'YouTube video ID');
  const url = new URL(`${API_ROOT}/videos`);
  url.searchParams.set('part', 'id,status');
  url.searchParams.set('id', videoId);

  const response = await (input.fetchImpl ?? fetch)(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const body = await safeJson(response);
  if (!response.ok) throw new Error('YouTube video verification failed');

  const items = Array.isArray(body.items) ? body.items : [];
  if (items.length !== 1) throw new Error('YouTube video confirmation is ambiguous or missing');
  const item = items[0] as Record<string, unknown>;
  const id = typeof item.id === 'string' ? item.id.trim() : '';
  const status = item.status && typeof item.status === 'object'
    ? item.status as Record<string, unknown>
    : {};
  const privacyStatus = typeof status.privacyStatus === 'string' ? status.privacyStatus.trim() : '';
  const uploadStatus = typeof status.uploadStatus === 'string' ? status.uploadStatus.trim() : '';
  const publishAt = typeof status.publishAt === 'string' ? status.publishAt.trim() : null;

  if (id !== videoId || !privacyStatus || !uploadStatus) {
    throw new Error('YouTube video confirmation is incomplete');
  }
  return { id, privacyStatus, uploadStatus, publishAt };
}
