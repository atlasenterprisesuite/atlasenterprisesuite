import { describe, expect, it } from 'vitest';
import {
  getYouTubeVideoState,
  initiateYouTubeResumableUpload,
  uploadYouTubeVideo,
} from '../../supabase/functions/_shared/youtube-data-api';

function jsonResponse(body: unknown, status = 200, headers: HeadersInit = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

describe('ATLAS YouTube Data API adapter', () => {
  it('initializes a private resumable upload with optional scheduled publishAt', async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl = (async (url: string | URL | Request, init?: RequestInit) => {
      calls.push({ url: String(url), init });
      return new Response(null, {
        status: 200,
        headers: { Location: 'https://upload.example/session-1' },
      });
    }) as typeof fetch;

    await expect(initiateYouTubeResumableUpload({
      accessToken: 'access-secret',
      mediaType: 'video/mp4',
      mediaSize: 1234,
      metadata: {
        title: 'ATLAS Test',
        description: 'Description',
        publishAt: '2026-12-01T15:00:00-05:00',
      },
      fetchImpl,
    })).resolves.toBe('https://upload.example/session-1');

    expect(calls).toHaveLength(1);
    const url = new URL(calls[0].url);
    expect(url.origin + url.pathname).toBe('https://www.googleapis.com/upload/youtube/v3/videos');
    expect(url.searchParams.get('part')).toBe('snippet,status');
    expect(url.searchParams.get('uploadType')).toBe('resumable');
    const payload = JSON.parse(String(calls[0].init?.body));
    expect(payload.status).toEqual({
      privacyStatus: 'private',
      publishAt: '2026-12-01T15:00:00-05:00',
    });
    expect(calls[0].init?.headers).toMatchObject({
      'X-Upload-Content-Type': 'video/mp4',
      'X-Upload-Content-Length': '1234',
    });
  });

  it('rejects unsafe schedule timestamps and missing provider upload session', async () => {
    const fetchImpl = (async () => new Response(null, { status: 200 })) as typeof fetch;
    await expect(initiateYouTubeResumableUpload({
      accessToken: 'a', mediaType: 'video/mp4', mediaSize: 1,
      metadata: { title: 'Title', publishAt: '2026-12-01 15:00' },
      fetchImpl,
    })).rejects.toThrow(/rfc3339|timezone/i);

    await expect(initiateYouTubeResumableUpload({
      accessToken: 'a', mediaType: 'video/mp4', mediaSize: 1,
      metadata: { title: 'Title' }, fetchImpl,
    })).rejects.toThrow(/location/i);
  });

  it('uploads media to the provider session and requires a video id', async () => {
    const calls: string[] = [];
    const fetchImpl = (async (url: string | URL | Request) => {
      calls.push(String(url));
      if (calls.length === 1) {
        return new Response(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session-2' },
        });
      }
      return jsonResponse({ id: 'video-123' });
    }) as typeof fetch;

    const result = await uploadYouTubeVideo({
      accessToken: 'access-secret',
      media: new Blob(['video-bytes'], { type: 'video/mp4' }),
      metadata: { title: 'ATLAS Video' },
      fetchImpl,
    });

    expect(result).toEqual({ videoId: 'video-123' });
    expect(calls[1]).toBe('https://upload.example/session-2');
  });

  it('never treats an upload response without video id as success', async () => {
    let call = 0;
    const fetchImpl = (async () => {
      call += 1;
      if (call === 1) {
        return new Response(null, {
          status: 200,
          headers: { Location: 'https://upload.example/session-3' },
        });
      }
      return jsonResponse({ kind: 'youtube#video' });
    }) as typeof fetch;

    await expect(uploadYouTubeVideo({
      accessToken: 'access-secret',
      media: new Blob(['video'], { type: 'video/mp4' }),
      metadata: { title: 'ATLAS Video' },
      fetchImpl,
    })).rejects.toThrow(/video id/i);
  });

  it('requires one exact provider read before accepting video state', async () => {
    const fetchImpl = (async () => jsonResponse({
      items: [{
        id: 'video-123',
        status: {
          privacyStatus: 'private',
          uploadStatus: 'processed',
          publishAt: '2026-12-01T20:00:00Z',
        },
      }],
    })) as typeof fetch;

    await expect(getYouTubeVideoState({
      accessToken: 'access-secret',
      videoId: 'video-123',
      fetchImpl,
    })).resolves.toEqual({
      id: 'video-123',
      privacyStatus: 'private',
      uploadStatus: 'processed',
      publishAt: '2026-12-01T20:00:00Z',
    });
  });

  it('rejects missing, duplicate or mismatched provider confirmation', async () => {
    for (const items of [
      [],
      [
        { id: 'video-123', status: { privacyStatus: 'private', uploadStatus: 'processed' } },
        { id: 'video-124', status: { privacyStatus: 'private', uploadStatus: 'processed' } },
      ],
      [{ id: 'different', status: { privacyStatus: 'private', uploadStatus: 'processed' } }],
    ]) {
      const fetchImpl = (async () => jsonResponse({ items })) as typeof fetch;
      await expect(getYouTubeVideoState({
        accessToken: 'access-secret',
        videoId: 'video-123',
        fetchImpl,
      })).rejects.toThrow(/ambiguous|missing|incomplete/i);
    }
  });
});
