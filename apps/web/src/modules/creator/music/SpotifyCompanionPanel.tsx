import { useState } from 'react';
import { analyzeSpotifyLink } from '../../../../../../packages/creator/spotify/link';

/**
 * An offline Spotify link inspector and device guide inside the existing
 * authenticated Studio. No Spotify OAuth, user data, provider token, network
 * request, audio streaming, or state transfer takes place in this component.
 */
export function SpotifyCompanionPanel() {
  const [input, setInput] = useState('');
  const analysis = input.trim() ? analyzeSpotifyLink(input) : null;

  return <section className="atlas-dj-panel" aria-label="Spotify companion">
    <h2>Spotify links &amp; Connect · Companion</h2>
    <p>Inspect a shared Spotify URL locally. This is separate from ATLAS Local DJ; Spotify recordings are not downloaded, decoded, mixed or exported.</p>
    <div style={{ display: 'grid', gap: '0.75rem', maxWidth: '42rem' }}>
      <label htmlFor="atlas-spotify-link">Spotify URL</label>
      <input id="atlas-spotify-link" type="url" inputMode="url" autoComplete="off"
        placeholder="https://open.spotify.com/track/…"
        value={input} maxLength={2048} onChange={event => setInput(event.target.value)}
        style={{ width: '100%', minWidth: 0, padding: '0.75rem', borderRadius: '0.5rem' }} />
      <div aria-live="polite" role="status">
        {!analysis && <p>Paste a link to identify its public Spotify resource type.</p>}
        {analysis?.kind === 'resource' && <p>Recognized Spotify {analysis.resourceType} ID. <a href={analysis.canonicalUrl} target="_blank" rel="noopener noreferrer">Open on Spotify</a>. No private Spotify information was accessed.</p>}
        {analysis?.kind === 'short-link' && <p>Spotify short link recognized (code: {analysis.code}). Its final destination is unverified; a specific track, account or playlist cannot be inferred.</p>}
        {analysis?.kind === 'unresolved' && <p>Cannot identify this link: {analysis.reason}.</p>}
      </div>
    </div>
    <h3>Listen across devices</h3>
    <p>Open Spotify on your phone and computer using the same Spotify account. In the Spotify app, open the device picker and select an available player. Playback transfers to one selected device; simultaneous independent streams are not promised.</p>
    <p><strong>ATLAS authorization:</strong> Spotify account not connected. Automated device discovery and transfer remain disabled until the account owner separately authorizes Spotify, the app is registered, and runtime entitlements and provider readiness are verified.</p>
  </section>;
}
