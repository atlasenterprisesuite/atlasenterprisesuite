/**
 * Narrow Spotify Connect transport. An authenticated ATLAS provider boundary
 * must inject a legitimately obtained, authorized token; no credentials are
 * discovered, logged, stored, refreshed, or acquired by this client.
 * Never treats HTTP 204 as proof that playback actually changed.
 */
export interface SpotifyDevice {
  id: string | null;
  name: string;
  type: string;
  is_active: boolean;
  is_restricted: boolean;
  supports_volume?: boolean;
}
export class SpotifyApiError extends Error {
  constructor(public readonly status: number) {
    super('Spotify request failed (HTTP ' + status + ')');
    this.name = 'SpotifyApiError';
  }
}
export type SpotifyAccessTokenProvider = () => Promise<string>;
export type SpotifyTransport = typeof fetch;

export class SpotifyConnectClient {
  constructor(
    private readonly getAccessToken: SpotifyAccessTokenProvider,
    private readonly transport: SpotifyTransport = fetch
  ) {}

  private async request<T>(path: '/me/player/devices' | '/me/player', method: 'GET' | 'PUT' = 'GET', body?: unknown): Promise<T | undefined> {
    const token = await this.getAccessToken();
    if (!token || /[\r\n]/.test(token)) throw new Error('Spotify access token unavailable');
    const response = await this.transport('https://api.spotify.com/v1' + path, {
      method,
      headers: {
        authorization: 'Bearer ' + token,
        ...(body === undefined ? {} : { 'content-type': 'application/json' })
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      redirect: 'error',
      cache: 'no-store'
    });
    if (!response.ok) throw new SpotifyApiError(response.status);
    if (response.status === 204) return undefined;
    return await response.json() as T;
  }

  async listDevices(): Promise<SpotifyDevice[]> {
    const response = await this.request<{ devices?: SpotifyDevice[] }>('/me/player/devices');
    return Array.isArray(response?.devices)
      ? response.devices.filter(device => !!device && typeof device.name === 'string' && typeof device.type === 'string')
      : [];
  }

  /** Explicit single-device action; never autoplays unless the caller asks. */
  async transferPlayback(deviceId: string, play = false): Promise<void> {
    if (!/^[A-Za-z0-9_-]{1,256}$/.test(deviceId)) throw new Error('Invalid Spotify device ID');
    await this.request<void>('/me/player', 'PUT', { device_ids: [deviceId], play });
  }

  async getPlaybackState(): Promise<{ device?: SpotifyDevice; is_playing?: boolean } | null> {
    return await this.request<{ device?: SpotifyDevice; is_playing?: boolean }>('/me/player') ?? null;
  }
}
