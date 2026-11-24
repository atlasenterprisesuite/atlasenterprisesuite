export type SonicSpec = { bpm: number; bars: number; root: number; seed: number };
export type SonicNote = { voice: 'bass' | 'harmony' | 'lead'; midi: number; start: number; duration: number };
export type SonicScore = { duration: number; notes: SonicNote[] };
const validInt = (v: number, min: number, max: number) => Number.isInteger(v) && v >= min && v <= max;
export function composeSonic(spec: SonicSpec): SonicScore {
  if (!validInt(spec.bpm, 60, 180) || !validInt(spec.bars, 1, 8) ||
      !validInt(spec.root, 48, 71) || !validInt(spec.seed, 0, 2147483647)) throw new Error('Invalid composition settings');
  let state = spec.seed >>> 0;
  const next = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state; };
  const beat = 60 / spec.bpm;
  const notes: SonicNote[] = [];
  const progression = [[0,3,7],[5,8,12],[3,7,10],[7,10,14]];
  for (let bar = 0; bar < spec.bars; bar++) {
    const chord = progression[bar % progression.length];
    const start = bar * 4 * beat;
    for (const offset of chord) notes.push({ voice: 'harmony', midi: spec.root + offset, start, duration: beat * 3.8 });
    for (let i = 0; i < 4; i++) {
      const at = start + i * beat;
      notes.push({ voice: 'bass', midi: spec.root - 12 + chord[0], start: at, duration: beat * .8 });
      notes.push({ voice: 'lead', midi: spec.root + 12 + chord[next() % 3], start: at, duration: beat * .72 });
    }
  }
  return { duration: spec.bars * 4 * beat, notes };
}
export function renderSonicWav(score: SonicScore): Uint8Array {
  if (!Number.isFinite(score.duration) || score.duration <= 0 || score.duration > 32 ||
      !Array.isArray(score.notes) || score.notes.length > 88 ||
      score.notes.some(n => !validInt(n.midi, 24, 108) || !Number.isFinite(n.start) ||
        !Number.isFinite(n.duration) || n.start < 0 || n.duration <= 0 ||
        n.start + n.duration > score.duration + 1e-8 ||
        !['bass','harmony','lead'].includes(n.voice))) throw new Error('Invalid score');
  const rate = 22050;
  const frames = Math.ceil(score.duration * rate);
  const mix = new Float32Array(frames);
  for (const n of score.notes) {
    const f = 440 * 2 ** ((n.midi - 69) / 12);
    const begin = Math.floor(n.start * rate);
    const end = Math.min(frames, Math.ceil((n.start + n.duration) * rate));
    const gain = n.voice === 'bass' ? .10 : n.voice === 'harmony' ? .045 : .08;
    for (let i = begin; i < end; i++) {
      const t = (i - begin) / rate;
      const envelope = Math.max(0, Math.min(1, t / .02, (n.duration - t) / .06));
      const phase = 2 * Math.PI * f * t;
      mix[i] += gain * envelope * (Math.sin(phase) + .15 * Math.sin(2 * phase));
    }
  }
  const bytes = new Uint8Array(44 + frames * 2);
  const v = new DataView(bytes.buffer);
  const tag = (offset: number, value: string) => { for (let i = 0; i < value.length; i++) bytes[offset+i] = value.charCodeAt(i); };
  tag(0,'RIFF'); v.setUint32(4,bytes.length-8,true); tag(8,'WAVE'); tag(12,'fmt ');
  v.setUint32(16,16,true); v.setUint16(20,1,true); v.setUint16(22,1,true);
  v.setUint32(24,rate,true); v.setUint32(28,rate*2,true); v.setUint16(32,2,true); v.setUint16(34,16,true);
  tag(36,'data'); v.setUint32(40,frames*2,true);
  for (let i = 0; i < frames; i++) v.setInt16(44+i*2,Math.round(Math.max(-.5,Math.min(.5,mix[i]))*32767),true);
  return bytes;
}
