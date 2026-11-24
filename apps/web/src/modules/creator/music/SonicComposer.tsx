import { useEffect, useState } from 'react';
import { composeSonic, renderSonicWav } from '../../../../../../packages/creator/audio/sonic_engine';

export function SonicComposer() {
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(4);
  const [root, setRoot] = useState(60);
  const [seed, setSeed] = useState(777);
  const [url, setUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('Choose settings and generate a local instrumental.');
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  function clear() { setUrl(null); setMessage('Settings changed. Generate a new instrumental.'); }
  function generate() {
    setUrl(null);
    try {
      const score = composeSonic({ bpm, bars, root, seed });
      const bytes = renderSonicWav(score);
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      setUrl(URL.createObjectURL(new Blob([copy.buffer], { type: 'audio/wav' })));
      setMessage('Local instrumental generated: ' + score.duration.toFixed(1) + ' seconds. Playback is manual.');
    } catch {
      setMessage('Generation blocked: invalid settings or unavailable browser capability.');
    }
  }
  return <section className="atlas-dj-panel" aria-label="SONIC local composer">
    <h2>ATLAS SONIC Engine 777</h2>
    <p>Original rule-based instrumental sketches with bass, harmony and lead. No neural model, voice generation, upload or paid provider.</p>
    <div className="atlas-dj-controls">
      <label>Tempo (BPM)<input type="number" min="60" max="180" step="1" value={bpm} onChange={e => { setBpm(e.target.valueAsNumber); clear(); }} /></label>
      <label>Bars<input type="number" min="1" max="8" step="1" value={bars} onChange={e => { setBars(e.target.valueAsNumber); clear(); }} /></label>
      <label>Root (MIDI note)<input type="number" min="48" max="71" step="1" value={root} onChange={e => { setRoot(e.target.valueAsNumber); clear(); }} /></label>
      <label>Variation seed<input type="number" min="0" max="2147483647" step="1" value={seed} onChange={e => { setSeed(e.target.valueAsNumber); clear(); }} /></label>
      <div className="atlas-dj-buttons"><button type="button" onClick={generate}>Generate instrumental</button></div>
    </div>
    <p role="status">{message}</p>
    {url && <div>
      <audio key={url} controls preload="none" src={url} aria-label="SONIC instrumental preview" />
      <p><a href={url} download="atlas-sonic-instrumental.wav">Download instrumental WAV</a></p>
    </div>}
    <p>Rule-based synthesis, not Suno-equivalent AI. No guarantee of uniqueness, copyright clearance or commercial suitability.</p>
  </section>;
}
