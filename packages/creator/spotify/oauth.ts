/**
 * Opt-in Spotify OAuth PKCE primitives. NOT a connected account or complete token
 * exchange. ATLAS authenticated, organization-scoped provider custody must own
 * short-lived verifier/state, token exchange, encryption, expiry and revocation.
 * Never persist provider tokens or OAuth state in this library.
 */
const DEVICE_SCOPES = ['user-read-playback-state', 'user-modify-playback-state'] as const;
const ALLOWED_SCOPES = new Set<string>(DEVICE_SCOPES);

function base64Url(bytes: Uint8Array): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  let value = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!, b = bytes[i + 1], c = bytes[i + 2];
    value += alphabet[a >> 2] + alphabet[((a & 3) << 4) | ((b ?? 0) >> 4)];
    if (b !== undefined) value += alphabet[((b & 15) << 2) | ((c ?? 0) >> 6)];
    if (c !== undefined) value += alphabet[c & 63];
  }
  return value;
}
function secureRedirect(input: string): URL {
  const url = new URL(input);
  const loopback = url.protocol === 'http:' && (url.hostname === '127.0.0.1' || url.hostname === '[::1]');
  if (!(url.protocol === 'https:' || loopback) || url.username || url.password || url.hash) {
    throw new Error('Redirect URI must be HTTPS or approved IP loopback');
  }
  return url;
}
export interface SpotifyPkceAuthorization {
  authorizeUrl: string;
  verifier: string;
  state: string;
  scopes: readonly string[];
}
export async function createSpotifyPkceAuthorization(
  clientId: string, redirectUri: string, scopes: readonly string[] = DEVICE_SCOPES
): Promise<SpotifyPkceAuthorization> {
  if (!/^[A-Za-z0-9]{16,64}$/.test(clientId)) throw new Error('Invalid Spotify client ID');
  if (!scopes.length || scopes.some(scope => !ALLOWED_SCOPES.has(scope)) || new Set(scopes).size !== scopes.length) {
    throw new Error('Unsupported or duplicate Spotify OAuth scope');
  }
  const redirect = secureRedirect(redirectUri);
  const verifierBytes = new Uint8Array(64), stateBytes = new Uint8Array(24);
  crypto.getRandomValues(verifierBytes);
  crypto.getRandomValues(stateBytes);
  const verifier = base64Url(verifierBytes), state = base64Url(stateBytes);
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier));
  const url = new URL('https://accounts.spotify.com/authorize');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', clientId);
  url.searchParams.set('redirect_uri', redirect.toString());
  url.searchParams.set('scope', scopes.join(' '));
  url.searchParams.set('state', state);
  url.searchParams.set('code_challenge_method', 'S256');
  url.searchParams.set('code_challenge', base64Url(new Uint8Array(digest)));
  return { authorizeUrl: url.toString(), verifier, state, scopes };
}
/** Validates origin/path and unique state/code; does not initiate network access. */
export function validateSpotifyCallback(callbackUrl: string, configuredRedirectUri: string, expectedState: string): string {
  const callback = new URL(callbackUrl), expected = secureRedirect(configuredRedirectUri);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname || callback.hash) {
    throw new Error('Spotify OAuth redirect mismatch');
  }
  if (!expectedState || callback.searchParams.getAll('state').length !== 1 ||
      callback.searchParams.get('state') !== expectedState) throw new Error('Spotify OAuth state mismatch');
  if (callback.searchParams.has('error')) throw new Error('Spotify authorization denied or failed');
  const codes = callback.searchParams.getAll('code');
  if (codes.length !== 1 || !codes[0]) throw new Error('Missing or duplicate Spotify OAuth code');
  return codes[0];
}
