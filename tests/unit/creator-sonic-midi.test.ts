import { describe, expect, it } from 'vitest';
import { composeSonic } from '../../packages/creator/audio/sonic_engine';
import { editSonicPitch, renderSonicMidi } from '../../packages/creator/audio/sonic_midi';

describe('SONIC MIDI', () => {
  const score = composeSonic({ bpm: 120, bars: 2, root: 60, seed: 777 });
  it('encodes format 1, conductor and three instrument tracks at 480 PPQ', () => {
    const bytes = renderSonicMidi(score,120);
    const view = new DataView(bytes.buffer);
    const tag = (i: number) => String.fromCharCode(...bytes.slice(i,i+4));
    expect(tag(0)).toBe('MThd');
    expect(view.getUint32(4)).toBe(6);
    expect(view.getUint16(8)).toBe(1);
    expect(view.getUint16(10)).toBe(4);
    expect(view.getUint16(12)).toBe(480);
    let pos = 14;
    for (let i=0;i<4;i++) {
      expect(tag(pos)).toBe('MTrk');
      const length = view.getUint32(pos+4);
      pos += 8+length;
      expect(Array.from(bytes.slice(pos-3,pos))).toEqual([255,47,0]);
    }
    expect(pos).toBe(bytes.length);
    expect(Array.from(bytes.slice(22,29))).toEqual([0,255,81,3,7,161,32]);
  });
  it('edits pitch immutably and changes exported bytes', () => {
    const changed = editSonicPitch(score,0,61);
    expect(score.notes[0].midi).toBe(60);
    expect(changed.notes[0].midi).toBe(61);
    expect(renderSonicMidi(changed,120)).not.toEqual(renderSonicMidi(score,120));
  });
  it('rejects invalid pitch, note index, tempo and malformed scores', () => {
    expect(() => editSonicPitch(score,-1,60)).toThrow();
    expect(() => editSonicPitch(score,0,128)).toThrow();
    expect(() => renderSonicMidi(score,NaN)).toThrow();
    expect(() => renderSonicMidi({...score,duration:Infinity},120)).toThrow();
    expect(() => renderSonicMidi({...score,notes:[{...score.notes[0],start:-1}]},120)).toThrow();
  });
});
