import { useEffect, useState } from 'react';
import { composeSonic, renderSonicWav, type SonicScore } from '../../../../../../packages/creator/audio/sonic_engine';

import { editSonicPitch, renderSonicMidi } from '../../../../../../packages/creator/audio/sonic_midi';

export function SonicComposer() {
  const [bpm, setBpm] = useState(120);
  const [bars, setBars] = useState(4);
  const [root, setRoot] = useState(60);
  const [seed, setSeed] = useState(777);
  const [url, setUrl] = useState<string | null>(null);
  const [score, setScore] = useState<SonicScore | null>(null);
  const [midiUrl, setMidiUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('Choose settings and generate a local instrumental.');
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);
  useEffect(() => () => { if (midiUrl) URL.revokeObjectURL(midiUrl); }, [midiUrl]);
  function clear() { setScore(null); setMidiUrl(null); setUrl(null); setMessage('Settings changed. Generate a new instrumental.'); }
  function generate() {
    setUrl(null); setMidiUrl(null); setScore(null);
    try {
      const score = composeSonic({ bpm, bars, root, seed });
      const bytes = renderSonicWav(score);
      const copy = new Uint8Array(bytes.length);
      copy.set(bytes);
      setUrl(URL.createObjectURL(new Blob([copy.buffer], { type: 'audio/wav' })));
      setScore(score);
      setMessage('Local instrumental generated: ' + score.duration.toFixed(1) + ' seconds. Playback is manual.');
    } catch {
      setMessage('Generation blocked: invalid settings or unavailable browser capability.');
    }
  }
  function editPitch(index: number, pitch: number) {
    if (!score) return;
    try {
      setScore(editSonicPitch(score, index, pitch));
      setUrl(null); setMidiUrl(null);
      setMessage('Note changed. Render the edited WAV or prepare a new MIDI file.');
    } catch { setMessage('Invalid pitch. Choose a note from 24 to 108.'); }
  }
  function exportScore(format: 'wav' | 'midi') {
    if (!score) return;
    if (format === 'wav') setUrl(null); else setMidiUrl(null);
    try {
      const bytes = format === 'wav' ? renderSonicWav(score) : renderSonicMidi(score, bpm);
      const copy = new Uint8Array(bytes.length); copy.set(bytes);
      const nextUrl = URL.createObjectURL(new Blob([copy.buffer], { type: format === 'wav' ? 'audio/wav' : 'audio/midi' }));
      if (format === 'wav') setUrl(nextUrl); else setMidiUrl(nextUrl);
      setMessage(format === 'wav' ? 'Edited WAV ready. Playback is manual.' : 'MIDI file ready for download.');
    } catch { setMessage('Export blocked: invalid score or unavailable browser capability.'); }
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
    {score && <div>
      <h3>Local note sequencer</h3>
      <p>Three tracks. Edit individual pitches; timing is fixed in this version. MIDI preserves notes, not synthesized audio.</p>
      <details>
        <summary>Edit {score.notes.length} notes</summary>
        <div className="atlas-dj-controls">
          {score.notes.map((note, index) => <label key={index}>
            {note.voice} · {note.start.toFixed(2)}s
            <select aria-label={`Pitch for note ${index + 1}`} value={note.midi} onChange={e => editPitch(index, Number(e.target.value))}>
              {Array.from({length:85}, (_,i)=>i+24).map(pitch => <option key={pitch} value={pitch}>{pitch}</option>)}
            </select>
          </label>)}
        </div>
      </details>
      <div className="atlas-dj-buttons">
        <button type="button" onClick={() => exportScore('wav')}>Render edited WAV</button>
        <button type="button" onClick={() => exportScore('midi')}>Prepare MIDI</button>
      </div>
      {midiUrl && <p><a href={midiUrl} download="atlas-sonic-instrumental.mid">Download instrumental MIDI</a></p>}
    </div>}
    {url && <div>
      <audio key={url} controls preload="none" src={url} aria-label="SONIC instrumental preview" />
      <p><a href={url} download="atlas-sonic-instrumental.wav">Download instrumental WAV</a></p>
    </div>}
    <p>Rule-based synthesis, not Suno-equivalent AI. No guarantee of uniqueness, copyright clearance or commercial suitability.</p>
  </section>;
}
