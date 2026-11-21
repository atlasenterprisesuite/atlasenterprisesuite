/**
 * Offline, stateless Spotify URL recognition. No redirects or network calls.
 * Short links are NEVER treated as evidence of a song, profile, or playlist.
 */
export type SpotifyResourceType = 'track' | 'album' | 'artist' | 'playlist' | 'episode' | 'show' | 'audiobook';
export type SpotifyLinkAnalysis =
  | { kind: 'resource'; resourceType: SpotifyResourceType; id: string; canonicalUrl: string }
  | { kind: 'short-link'; code: string; destinationVerified: false }
  | { kind: 'unresolved'; reason: string };

const TYPES = new Set<SpotifyResourceType>(['track', 'album', 'artist', 'playlist', 'episode', 'show', 'audiobook']);
const SPOTIFY_ID = /^[a-zA-Z0-9]{22}$/;
const SHORT_CODE = /^[a-zA-Z0-9_-]{4,64}$/;

export function analyzeSpotifyLink(input: string): SpotifyLinkAnalysis {
  if (input.length > 2048) return { kind: 'unresolved', reason: 'URL exceeds 2048 characters' };
  let url: URL;
  try { url = new URL(input.trim()); }
  catch { return { kind: 'unresolved', reason: 'Invalid URL' }; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) {
    return { kind: 'unresolved', reason: 'Only plain HTTPS Spotify URLs are supported' };
  }
  if (url.hostname === 'spotify.app.link') {
    const code = url.pathname.slice(1);
    if (!SHORT_CODE.test(code) || url.pathname !== '/' + code) {
      return { kind: 'unresolved', reason: 'Unrecognized Spotify short-link format' };
    }
    return { kind: 'short-link', code, destinationVerified: false };
  }
  if (url.hostname !== 'open.spotify.com') {
    return { kind: 'unresolved', reason: 'Not an allowed Spotify content host' };
  }
  const parts = url.pathname.split('/').filter(Boolean);
  if (parts[0]?.startsWith('intl-')) parts.shift();
  if (parts.length !== 2 || !TYPES.has(parts[0] as SpotifyResourceType) || !SPOTIFY_ID.test(parts[1] ?? '')) {
    return { kind: 'unresolved', reason: 'No verifiable Spotify resource type and ID' };
  }
  const resourceType = parts[0] as SpotifyResourceType;
  const id = parts[1]!;
  return { kind: 'resource', resourceType, id, canonicalUrl: 'https://open.spotify.com/' + resourceType + '/' + id };
}
